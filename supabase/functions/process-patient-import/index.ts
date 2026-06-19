// Process patient import in batches. Updates import_jobs progress along the way.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type IncomingPatient = {
  row: number;
  name: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
  gender: string | null;
  dob: string | null;
};

type ErrorDetail = {
  row: number;
  name: string;
  phone: string;
  reason: string;
  type: "duplicate" | "error";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let job_id: string | null = null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    job_id = body.job_id;
    const patients: IncomingPatient[] = body.patients ?? [];
    const clinic_id: string = body.clinic_id;

    if (!job_id || !clinic_id || !Array.isArray(patients)) {
      return new Response(JSON.stringify({ error: "invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("import_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", job_id);

    // Process in background using EdgeRuntime.waitUntil so HTTP returns immediately
    const work = (async () => {
      let processed = 0;
      let success = 0;
      let duplicates = 0;
      let errors = 0;
      const errorDetails: ErrorDetail[] = [];
      const batchSize = 100;

      for (let i = 0; i < patients.length; i += batchSize) {
        const batch = patients.slice(i, i + batchSize);

        // Bulk duplicate check by phone
        const phones = batch.map((p) => p.phone).filter(Boolean);
        const { data: existing } = await supabase
          .from("patients")
          .select("phone")
          .eq("clinic_id", clinic_id)
          .in("phone", phones);
        const existingPhones = new Set((existing ?? []).map((r: any) => r.phone));

        const seenInBatch = new Set<string>();
        const toInsert: any[] = [];
        const insertMeta: IncomingPatient[] = [];

        for (const p of batch) {
          if (existingPhones.has(p.phone) || seenInBatch.has(p.phone)) {
            duplicates++;
            errorDetails.push({
              row: p.row,
              name: p.name,
              phone: p.phone,
              reason: "Duplicate phone",
              type: "duplicate",
            });
            continue;
          }
          seenInBatch.add(p.phone);
          toInsert.push({
            clinic_id,
            name: p.name,
            first_name: p.first_name,
            last_name: p.last_name,
            phone: p.phone,
            email: p.email,
            gender: p.gender,
            dob: p.dob,
            lead_status: "current",
            call_due_date: null,
          });
          insertMeta.push(p);
        }

        if (toInsert.length) {
          const { error, data } = await supabase
            .from("patients")
            .insert(toInsert)
            .select("id");
          if (error) {
            // Fallback: insert one by one to capture per-row errors
            for (let k = 0; k < toInsert.length; k++) {
              const { error: e1 } = await supabase
                .from("patients")
                .insert(toInsert[k])
                .select("id")
                .single();
              if (e1) {
                errors++;
                errorDetails.push({
                  row: insertMeta[k].row,
                  name: insertMeta[k].name,
                  phone: insertMeta[k].phone,
                  reason: e1.message,
                  type: "error",
                });
              } else {
                success++;
              }
            }
          } else {
            success += data?.length ?? toInsert.length;
          }
        }

        processed += batch.length;

        await supabase
          .from("import_jobs")
          .update({
            processed_rows: processed,
            success_rows: success,
            duplicate_rows: duplicates,
            error_rows: errors,
            error_details: errorDetails,
          })
          .eq("id", job_id!);
      }

      const finalStatus =
        errors > 0 && success === 0
          ? "failed"
          : errors > 0 || duplicates > 0
            ? "partial"
            : "completed";

      await supabase
        .from("import_jobs")
        .update({
          status: finalStatus,
          processed_rows: processed,
          success_rows: success,
          duplicate_rows: duplicates,
          error_rows: errors,
          error_details: errorDetails,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job_id!);

      // Get clinic for notification
      await supabase.from("notifications").insert({
        clinic_id,
        type: "patient_import_completed",
        message: `Patient import completed: ${success} imported, ${duplicates} skipped, ${errors} errors`,
      });
    })();

    // @ts-ignore EdgeRuntime is provided by Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work);
    } else {
      // Fallback: don't await — fire & forget
      work.catch((e) => console.error("import work failed", e));
    }

    return new Response(JSON.stringify({ ok: true, job_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("process-patient-import error", e);
    if (job_id) {
      await supabase
        .from("import_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_details: [{ reason: e?.message ?? String(e) }] as any,
        })
        .eq("id", job_id);
    }
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
