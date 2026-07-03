import { supabase } from "@/integrations/supabase/client";

let cachedVapid: string | null = null;

async function getVapidPublicKey(): Promise<string | null> {
  if (cachedVapid) return cachedVapid;
  try {
    const { data, error } = await supabase.functions.invoke("get-vapid-public-key");
    if (error) return null;
    const key = (data as any)?.key;
    if (typeof key === "string" && key.length > 40) {
      cachedVapid = key;
      return key;
    }
  } catch {}
  return null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function ensureTherapistPushSubscription(profileId: string, clinicId: string) {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "denied") return;
  if (Notification.permission === "default") {
    const p = await Notification.requestPermission();
    if (p !== "granted") return;
  }

  const vapid = await getVapidPublicKey();
  if (!vapid) return;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
  }
  const json = sub.toJSON() as any;
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await supabase.from("push_subscriptions").upsert(
    {
      profile_id: profileId,
      clinic_id: clinicId,
      endpoint: json.endpoint,
      p256dh_key: json.keys.p256dh,
      auth_key: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
}

export async function removeTherapistPushSubscription() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {}
}
