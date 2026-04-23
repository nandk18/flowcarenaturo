import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: jobs } = await supabase
      .from("background_jobs")
      .select("*")
      .eq("status", "queued")
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(5);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const job of jobs) {
      await supabase
        .from("background_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
        })
        .eq("id", job.id);

      try {
        let result: any = null;

        switch (job.job_type) {
          case "transcribe_audio":
            result = await processTranscription(supabase, job.payload);
            break;
          case "format_notes":
            result = await processFormatting(supabase, job.payload);
            break;
          case "generate_pdf":
            result = await processPDF(job.payload);
            break;
        }

        await supabase
          .from("background_jobs")
          .update({
            status: "completed",
            result,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        processed++;
      } catch (err) {
        const isFinal = job.attempts + 1 >= (job.max_attempts || 3);
        await supabase
          .from("background_jobs")
          .update({
            status: isFinal ? "failed" : "queued",
            error_message: String(err),
          })
          .eq("id", job.id);
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processTranscription(supabase: any, payload: any) {
  const { visit_id, audio_path, template_name, template_fields, patient_context, doctor_id } = payload;

  const { data: audioData, error: dlErr } = await supabase.storage
    .from("audio-recordings")
    .download(audio_path);
  if (dlErr) throw new Error(`Audio download failed: ${dlErr.message}`);

  const formData = new FormData();
  formData.append("file", audioData, "audio.webm");
  formData.append("model", "whisper-1");
  formData.append(
    "prompt",
    "Medical consultation. Patient symptoms, diagnosis, medications, treatment plan."
  );

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: formData,
  });
  if (!whisperRes.ok) throw new Error(`Whisper failed: ${whisperRes.status}`);
  const { text: transcript } = await whisperRes.json();

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `Format medical transcript into structured clinical notes. Return only valid JSON.`,
      messages: [
        {
          role: "user",
          content: `Template: ${template_name}\nFields: ${JSON.stringify(
            template_fields
          )}\nTranscript: ${transcript}\nPatient: ${patient_context}\n\nReturn JSON with exactly these fields plus medications[], investigations[], follow_up_days.`,
        },
      ],
    }),
  });
  if (!claudeRes.ok) throw new Error(`Claude failed: ${claudeRes.status}`);
  const claudeData = await claudeRes.json();
  const notesText = claudeData.content?.[0]?.text?.trim() || "{}";
  const notes = JSON.parse(notesText.replace(/```json|```/g, "").trim());

  const { data: existingNote } = await supabase
    .from("clinical_notes")
    .select("id")
    .eq("visit_id", visit_id)
    .maybeSingle();

  if (existingNote) {
    await supabase
      .from("clinical_notes")
      .update({
        raw_transcript: transcript,
        soap_notes: { ...notes, _template: template_name },
        language_detected: "auto",
      })
      .eq("visit_id", visit_id);
  } else {
    await supabase.from("clinical_notes").insert({
      visit_id,
      doctor_id,
      raw_transcript: transcript,
      soap_notes: { ...notes, _template: template_name },
      language_detected: "auto",
    });
  }

  return { transcript, notes };
}

async function processFormatting(_supabase: any, payload: any) {
  const { existing_notes, target_template, target_fields } = payload;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: "Reformat clinical notes to new template. Preserve all details. Return only valid JSON.",
      messages: [
        {
          role: "user",
          content: `Existing: ${JSON.stringify(
            existing_notes
          )}\nTarget template: ${target_template}\nFields: ${JSON.stringify(
            target_fields
          )}\nReturn JSON with exactly these fields.`,
        },
      ],
    }),
  });
  if (!claudeRes.ok) throw new Error(`Claude failed: ${claudeRes.status}`);
  const data = await claudeRes.json();
  const text = data.content?.[0]?.text?.trim() || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function processPDF(payload: any) {
  const { visit_id, prescription_id } = payload;

  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-prescription-pdf`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ visit_id, prescription_id }),
    }
  );
  if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`);
  return await res.json();
}