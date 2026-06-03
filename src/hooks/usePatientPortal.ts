import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "stethoscribe_patient_session";
const SESSION_TTL = 24 * 60 * 60 * 1000;

export interface PatientSession {
  token: string;
  patientIds: string[];
  primaryPatient: {
    id: string;
    name: string;
    healthcare_id: string;
    phone: string;
    dob: string;
    gender: string;
    blood_group: string;
    allergies: any[];
    chronic_conditions: any[];
  };
  allPatients: any[];
  loginTime: number;
  phone: string;
  dob: string;
}

export function usePatientPortal() {
  const [session, setSession] = useState<PatientSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PatientSession;
        if (parsed.token && Date.now() - parsed.loginTime < SESSION_TTL) {
          setSession(parsed);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (
    phone: string,
    dob: string,
  ): Promise<{ success: boolean; error?: string; multipleProfiles?: any[] }> => {
    const { data, error } = await supabase.functions.invoke("patient-portal", {
      body: { action: "login", phone, dob },
    });
    if (error) {
      const msg =
        (error as any)?.context?.body || error.message || "Verification failed.";
      try {
        const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
        if (parsed?.multipleProfiles)
          return { success: false, multipleProfiles: parsed.multipleProfiles };
        return { success: false, error: parsed?.error || "Verification failed." };
      } catch {
        return { success: false, error: typeof msg === "string" ? msg : "Verification failed." };
      }
    }
    if (data?.multipleProfiles) {
      // Stash phone/dob temporarily for selectProfile
      sessionStorage.setItem(
        "stethoscribe_portal_pending",
        JSON.stringify({ phone, dob }),
      );
      return { success: false, multipleProfiles: data.multipleProfiles };
    }
    if (!data?.token) return { success: false, error: data?.error || "Verification failed." };
    const newSession: PatientSession = {
      token: data.token,
      patientIds: data.patientIds,
      primaryPatient: data.primaryPatient,
      allPatients: data.allPatients,
      loginTime: Date.now(),
      phone,
      dob,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
    return { success: true };
  };

  const selectProfile = async (patient: any, _allMatches: any[]) => {
    const pending = sessionStorage.getItem("stethoscribe_portal_pending");
    if (!pending) return;
    const { phone, dob } = JSON.parse(pending);
    const { data, error } = await supabase.functions.invoke("patient-portal", {
      body: { action: "select_profile", phone, dob, patient_id: patient.id },
    });
    if (error || !data?.token) return;
    sessionStorage.removeItem("stethoscribe_portal_pending");
    const newSession: PatientSession = {
      token: data.token,
      patientIds: data.patientIds,
      primaryPatient: data.primaryPatient,
      allPatients: data.allPatients,
      loginTime: Date.now(),
      phone,
      dob,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  const callPortal = async <T = any>(action: string, extra: Record<string, any> = {}): Promise<T | null> => {
    if (!session?.token) return null;
    const { data, error } = await supabase.functions.invoke("patient-portal", {
      body: { action, token: session.token, ...extra },
    });
    if (error) {
      // Token invalid/expired
      if ((error as any)?.context?.status === 401) {
        logout();
      }
      return null;
    }
    return data as T;
  };

  return { session, loading, login, logout, selectProfile, callPortal };
}