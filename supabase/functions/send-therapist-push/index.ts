import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:notify@flowcare.app", VAPID_PUBLIC, VAPID_PRIVATE);

type Payload = {
  kind: "assigned" | "available";
  session_id: string;
  clinic_id: string;
  therapist_id: string | null;
  service_name: string;
  room: string | null;
  patient_id: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const p = (await req.json()) as Payload;
    if (!p?.session_id || !p?.clinic_id) {
      return new Response(JSON.stringify({ error: "bad payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve target profile_ids
    let profileIds: string[] = [];
    if (p.kind === "assigned" && p.therapist_id) {
      profileIds = [p.therapist_id];
    } else if (p.kind === "available") {
      const { data } = await sb.from("profiles").select("id").eq("clinic_id", p.clinic_id).eq("is_therapist", true);
      profileIds = (data ?? []).map((r: any) => r.id);
    }
    if (!profileIds.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Look up patient name
    const { data: pat } = await sb.from("patients").select("first_name,last_name,name").eq("id", p.patient_id).maybeSingle();
    const patientName = (pat?.name || `${pat?.first_name ?? ""} ${pat?.last_name ?? ""}`.trim()) || "Patient";

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("id, endpoint, p256dh_key, auth_key, profile_id")
      .in("profile_id", profileIds);

    const title = p.kind === "assigned" ? "New session assigned" : "Session available";
    const body = `${patientName} · ${p.service_name}${p.room ? " · " + p.room : ""}`;
    const notif = JSON.stringify({ title, body, url: "/treatment/therapist", id: p.session_id });

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(
      (subs ?? []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
            notif,
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(s.id);
        }
      }),
    );
    if (stale.length) await sb.from("push_subscriptions").delete().in("id", stale);

    return new Response(JSON.stringify({ sent, pruned: stale.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
