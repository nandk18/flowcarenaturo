import { supabase } from "@/integrations/supabase/client";

/**
 * Inserts a row into short_links and returns a short branded URL.
 * Falls back to the original URL on any failure so the caller always
 * has a working link.
 */
export async function createShortLink(
  originalUrl: string,
  clinicId: string | null | undefined,
  linkType: "invoice" | "patient_form" | "prescription" | "other",
  expiresAt?: Date | null,
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("short_links")
      .insert({
        clinic_id: clinicId ?? null,
        original_url: originalUrl,
        link_type: linkType,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      } as any)
      .select("short_code")
      .single();

    if (error || !data?.short_code) return originalUrl;
    const base =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/s/${data.short_code}`;
  } catch {
    return originalUrl;
  }
}
