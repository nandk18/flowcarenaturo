import { supabase } from "@/integrations/supabase/client";

type MinimalProfile = {
  clinic_id: string | null;
  role: string;
};

export async function ensureProfileAndGetPostAuthRoute(userId: string) {
  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  let profile = existingProfile as MinimalProfile | null;

  if (!profile && !profileError) {
    const { data: ensuredProfile, error: ensureError } = await (supabase as any).rpc(
      "ensure_current_user_profile"
    );
    if (ensureError) throw ensureError;
    profile = ensuredProfile as MinimalProfile | null;
  } else if (profileError) {
    throw profileError;
  }

  if (!profile) return "/onboarding";
  if (profile.role === "super_admin") return "/super-admin";
  if (profile.role !== "admin") {
    await supabase.auth.signOut();
    return "/login";
  }

  if (!profile.clinic_id) return "/onboarding";

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("onboarding_complete, is_active, subscription_status, trial_ends_at")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  if (clinicError) throw clinicError;

  if (clinic && (clinic as any).is_active === false) {
    await supabase.auth.signOut();
    return "/login?reason=clinic_disabled";
  }

  const subStatus = clinic ? (clinic as any).subscription_status : null;
  if (subStatus === "pending") {
    await supabase.auth.signOut();
    return "/login?reason=clinic_pending";
  }
  if (subStatus === "trial") {
    const trialEnds = (clinic as any).trial_ends_at;
    if (trialEnds && new Date(trialEnds) <= new Date()) {
      return "/subscription";
    }
  }
  if (["past_due", "cancelled", "disabled"].includes(subStatus)) {
    return "/subscription";
  }

  return clinic?.onboarding_complete ? "/dashboard" : "/onboarding";
}