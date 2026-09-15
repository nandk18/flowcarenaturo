import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  encryptToken,
  resolveSender,
  sendTwilioTemplate,
  type WhatsAppEvent,
} from "../_shared/whatsappSender.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MODES = ["default", "own_number", "own_account"];
const TEMPLATE_FIELDS = [
  "template_booked",
  "template_rescheduled",
  "template_cancelled",
  "template_reminder",
  "template_review",
  "template_followup",
];

function clean(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function e164(raw: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (!d.startsWith("+")) d = "+" + d.replace(/\D/g, "");
  return /^\+\d{10,15}$/.test(d) ? d : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not signed in" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not signed in" }, 401);

    const { data: profile } = await admin
      .from("profiles")
      .select("clinic_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: superAdmin } = await admin.rpc("is_super_admin", { _user_id: user.id });
    const isSuper = superAdmin === true;
    const isClinicAdmin = profile?.role === "admin" || profile?.role === "doctor";

    const body = (await req.json()) as Record<string, any>;
    const action = String(body.action ?? "");
    const clinicId: string | null = isSuper
      ? (clean(body.clinic_id) ?? profile?.clinic_id ?? null)
      : (profile?.clinic_id ?? null);

    if (!clinicId) return json({ error: "No clinic for this user" }, 400);
    if (!isSuper && !isClinicAdmin) {
      return json({ error: "Only a clinic admin or doctor can change this" }, 403);
    }

    // ---------------- save ----------------
    if (action === "save") {
      const mode = String(body.mode ?? "default");
      if (!MODES.includes(mode)) return json({ error: "Invalid sending mode" }, 400);

      const fromRaw = clean(body.from_number);
      const fromNumber = fromRaw ? e164(fromRaw) : null;
      if (mode !== "default" && !fromNumber) {
        return json({ error: "Enter a valid WhatsApp number with country code" }, 400);
      }

      const accountSid = clean(body.account_sid);
      if (mode === "own_account" && (!accountSid || !accountSid.startsWith("AC"))) {
        return json({ error: "Enter a valid Twilio Account SID (starts with AC)" }, 400);
      }

      const patch: Record<string, unknown> = {
        clinic_id: clinicId,
        mode,
        from_number: fromNumber,
        account_sid: mode === "own_account" ? accountSid : null,
        verified_at: null,
      };
      for (const f of TEMPLATE_FIELDS) patch[f] = clean(body[f]);

      const newToken = clean(body.auth_token);
      if (mode !== "own_account") {
        patch.auth_token_encrypted = null;
      } else if (newToken) {
        patch.auth_token_encrypted = await encryptToken(newToken);
      }
      // No new token supplied in own_account mode: keep whatever is stored.

      const { error } = await admin
        .from("clinic_whatsapp_settings")
        .upsert(patch, { onConflict: "clinic_id" });
      if (error) return json({ error: error.message }, 400);

      if (mode === "own_account" && !newToken) {
        const { data: row } = await admin
          .from("clinic_whatsapp_settings")
          .select("auth_token_encrypted")
          .eq("clinic_id", clinicId)
          .maybeSingle();
        if (!row?.auth_token_encrypted) {
          return json({ saved: true, warning: "Saved, but no auth token is stored yet." });
        }
      }

      return json({ saved: true });
    }

    // ---------------- reset ----------------
    if (action === "reset") {
      const { error } = await admin
        .from("clinic_whatsapp_settings")
        .upsert(
          {
            clinic_id: clinicId,
            mode: "default",
            from_number: null,
            account_sid: null,
            auth_token_encrypted: null,
            template_booked: null,
            template_rescheduled: null,
            template_cancelled: null,
            template_reminder: null,
            template_review: null,
            template_followup: null,
            verified_at: null,
          },
          { onConflict: "clinic_id" },
        );
      if (error) return json({ error: error.message }, 400);
      return json({ reset: true });
    }

    // ---------------- test ----------------
    if (action === "test") {
      const to = e164(clean(body.to_phone));
      if (!to) return json({ error: "Enter a valid test number with country code" }, 400);

      const event = (clean(body.event) ?? "booked") as WhatsAppEvent;
      const sender = await resolveSender(admin, clinicId, event);
      if (!sender.accountSid || !sender.authToken || !sender.fromNumber || !sender.contentSid) {
        return json({ error: "This clinic's WhatsApp sending is not fully configured yet" }, 400);
      }

      const { data: clinic } = await admin
        .from("clinics")
        .select("name")
        .eq("id", clinicId)
        .maybeSingle();

      const result = await sendTwilioTemplate(sender, to, {
        "1": "Test",
        "2": clinic?.name ?? "our clinic",
        "3": "01/01/2026",
        "4": "10:00 AM",
        "5": "your practitioner",
      });

      if (!result.ok) {
        console.error(`Twilio test failed [${result.status}]: ${result.body}`);
        return json(
          { error: "Twilio rejected the test message", status: result.status, details: result.body },
          result.status,
        );
      }

      await admin
        .from("clinic_whatsapp_settings")
        .update({ verified_at: new Date().toISOString() })
        .eq("clinic_id", clinicId);

      return json({ sent: true, sid: result.sid, sender_mode: sender.mode, from: sender.fromNumber });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("clinic-whatsapp-settings error:", message);
    return json({ error: message }, 500);
  }
});
