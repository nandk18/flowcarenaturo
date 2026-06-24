import { useState, useEffect, useContext, createContext, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { clearAllPersistedState } from "@/lib/persistedState";

type UserProfile = {
  id: string;
  user_id: string;
  clinic_id: string | null;
  lab_id: string | null;
  full_name: string | null;
  role: "admin" | "super_admin";
  password_set: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const authResolvedRef = useRef(false);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      if (!authResolvedRef.current) {
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          // Defer profile fetch to avoid deadlock
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          authResolvedRef.current = true;
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        authResolvedRef.current = true;
        setLoading(false);
      }
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data as UserProfile);
        return;
      }

      const { data: ensuredProfile, error: ensureError } = await (supabase as any).rpc(
        "ensure_current_user_profile"
      );
      if (ensureError) throw ensureError;
      setProfile(ensuredProfile as UserProfile);
    } catch (err) {
      console.error("Error fetching profile:", err);
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    } finally {
      authResolvedRef.current = true;
      setLoading(false);
    }
  };

  const signOut = async () => {
    clearAllPersistedState();
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
