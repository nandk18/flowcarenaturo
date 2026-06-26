import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCurrentProfile = () => {
  return useQuery({
    queryKey: ["currentProfile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role, clinic_id")
        .eq("user_id", user.id)
        .single();

      return profile;
    },
    staleTime: Infinity,
  });
};
