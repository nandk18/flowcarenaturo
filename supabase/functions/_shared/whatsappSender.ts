/**
 * Per-clinic WhatsApp sender resolution.
 *
 * A clinic can send from:
 *  - "default"     : FlowCare's shared Twilio account + number + templates (env)
 *  - "own_number"  : their own number, onboarded inside FlowCare's Twilio account
 *  - "own_account" : their own Twilio account (SID + auth token) and templates
 *
 * Anything missing falls back to the shared default so a half-finished
 * configuration never silently stops messages going out.
 */

export type WhatsAppEvent =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "reminder"
  | "review"
  | "followup";

export const TEMPLATE_COLUMNS: Record<WhatsAppEvent, string> = {
  booked: "template_booked",
  rescheduled: "template_rescheduled",
  cancelled: "template_cancelled",
  reminder: "template_reminder",
  review: "template_review",
  followup: "template_followup",
};

export type ResolvedSender = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  contentSid: string;
  mode: "default" | "own_number" | "own_account";
};

const CRED_KEY = Deno.env.get("WHATSAPP_CRED_KEY") ?? "";

async function aesKey(): Promise<CryptoKey> {
  if (!CRED_KEY) throw new Error("WHATSAPP_CRED_KEY is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(CRED_KEY));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** Encrypt a Twilio auth token for storage (returns "iv.ciphertext", both base64). */
export async function encryptToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(),
    new TextEncoder().encode(plain),
  );
  return `${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}

/** Decrypt a stored Twilio auth token. Returns null when it cannot be read. */
export async function decryptToken(stored: string | null | undefined): Promise<string | null> {
  if (!stored || !stored.includes(".")) return null;
  try {
    const [ivPart, dataPart] = stored.split(".");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(ivPart) },
      await aesKey(),
      unb64(dataPart),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Default (shared) credentials read from environment. */
export function defaultCredentials(event: WhatsAppEvent) {
  const templates: Record<WhatsAppEvent, string> = {
    booked: Deno.env.get("TWILIO_TEMPLATE_BOOKED") ?? "",
    rescheduled: Deno.env.get("TWILIO_TEMPLATE_RESCHEDULED") ?? "",
    cancelled: Deno.env.get("TWILIO_TEMPLATE_CANCELLED") ?? "",
    reminder: Deno.env.get("TWILIO_TEMPLATE_REMINDER") || Deno.env.get("TWILIO_TEMPLATE_BOOKED") || "",
    review: Deno.env.get("TWILIO_TEMPLATE_REVIEW") ?? "",
    followup: Deno.env.get("TWILIO_TEMPLATE_FOLLOWUP") ?? "",
  };
  return {
    accountSid: Deno.env.get("TWILIO_ACCOUNT_SID") ?? "",
    authToken: Deno.env.get("TWILIO_AUTH_TOKEN") ?? "",
    fromNumber: Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "",
    contentSid: templates[event] ?? "",
  };
}

/**
 * Work out which Twilio account / number / template to use for one message.
 * Falls back to the shared default for anything the clinic has not configured.
 */
export async function resolveSender(
  sb: { from: (t: string) => any },
  clinicId: string | null,
  event: WhatsAppEvent,
): Promise<ResolvedSender> {
  const base = defaultCredentials(event);
  const fallback: ResolvedSender = { ...base, mode: "default" };
  if (!clinicId) return fallback;

  const { data: row } = await sb
    .from("clinic_whatsapp_settings")
    .select("*")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!row || !row.mode || row.mode === "default") return fallback;

  const templateSid = (row[TEMPLATE_COLUMNS[event]] as string | null) || "";
  const fromNumber = (row.from_number as string | null) || "";

  if (row.mode === "own_number") {
    // Their number, our Twilio account. Their template if provided, else ours.
    if (!fromNumber) return fallback;
    return {
      accountSid: base.accountSid,
      authToken: base.authToken,
      fromNumber,
      contentSid: templateSid || base.contentSid,
      mode: "own_number",
    };
  }

  // own_account: everything must be present, otherwise fall back.
  const token = await decryptToken(row.auth_token_encrypted);
  const accountSid = (row.account_sid as string | null) || "";
  if (!token || !accountSid || !fromNumber || !templateSid) return fallback;

  return { accountSid, authToken: token, fromNumber, contentSid: templateSid, mode: "own_account" };
}

/** Post a templated WhatsApp message to Twilio. Returns the raw response + body. */
export async function sendTwilioTemplate(
  sender: ResolvedSender,
  to: string,
  variables: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: string; sid: string | null }> {
  const from = sender.fromNumber.startsWith("+") ? sender.fromNumber : "+" + sender.fromNumber;
  const form = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${from}`,
    ContentSid: sender.contentSid,
    ContentVariables: JSON.stringify(variables),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sender.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${sender.accountSid}:${sender.authToken}`),
      },
      body: form,
    },
  );

  const body = await res.text();
  let sid: string | null = null;
  try {
    sid = JSON.parse(body)?.sid ?? null;
  } catch {
    // non-JSON body — keep raw
  }
  return { ok: res.ok, status: res.status, body, sid };
}
