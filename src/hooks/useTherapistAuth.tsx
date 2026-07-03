import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TherapistSession = {
  id: string;
  full_name: string;
  therapist_color: string | null;
  room: string | null;
  signedInAt: number;
};

const STORAGE_KEY = "therapist_session_v1";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

type Ctx = {
  therapist: TherapistSession | null;
  loading: boolean;
  signInWithPin: (
    profile: { id: string; full_name: string; therapist_color: string | null; room: string | null },
    pin: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
};

const TherapistAuthContext = createContext<Ctx>({
  therapist: null,
  loading: true,
  signInWithPin: async () => ({ ok: false, error: "not-ready" }),
  signOut: () => {},
});

export function TherapistAuthProvider({ children }: { children: ReactNode }) {
  const [therapist, setTherapist] = useState<TherapistSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as TherapistSession;
        if (s?.id && Date.now() - (s.signedInAt ?? 0) < SESSION_TTL_MS) {
          setTherapist(s);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  const signInWithPin: Ctx["signInWithPin"] = useCallback(async (profile, pin) => {
    const { data, error } = await (supabase as any).rpc("verify_therapist_pin", {
      p_therapist_profile_id: profile.id,
      p_pin: pin,
    });
    if (error) return { ok: false, error: error.message };
    if (data !== true) return { ok: false, error: "Wrong PIN" };
    const s: TherapistSession = {
      id: profile.id,
      full_name: profile.full_name,
      therapist_color: profile.therapist_color,
      room: profile.room,
      signedInAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setTherapist(s);
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTherapist(null);
  }, []);

  return (
    <TherapistAuthContext.Provider value={{ therapist, loading, signInWithPin, signOut }}>
      {children}
    </TherapistAuthContext.Provider>
  );
}

export const useTherapistAuth = () => useContext(TherapistAuthContext);
