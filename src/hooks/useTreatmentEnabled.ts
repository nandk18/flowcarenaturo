import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns whether the current clinic has treatment_enabled = true.
 * Gates all Treatment-module UI.
 */
export function useTreatmentEnabled() {
  const { profile } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profile?.clinic_id) {
      setEnabled(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("clinics")
      .select("treatment_enabled")
      .eq("id", profile.clinic_id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setEnabled(!!data?.treatment_enabled);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.clinic_id]);

  return { enabled: enabled === true, loading: enabled === null };
}
