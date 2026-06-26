import { supabase } from "@/integrations/supabase/client";

// Cache profile in memory to avoid repeated DB calls
let cachedProfileId: string | null = null;

/**
 * Returns the current user's profiles.id (NOT auth.user.id).
 * Use this for any FK column that references profiles.id, such as
 * called_by, created_by, checked_by, done_by, recorded_by.
 */
export const getProfileId = async (): Promise<string | null> => {
  if (cachedProfileId) return cachedProfileId;

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) return null;

    cachedProfileId = profile.id;
    return profile.id;
  } catch {
    return null;
  }
};

export const clearProfileCache = () => {
  cachedProfileId = null;
};
