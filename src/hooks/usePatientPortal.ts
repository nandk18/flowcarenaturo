import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "stethoscribe_patient_session";
const SESSION_TTL = 24 * 60 * 60 * 1000;

export interface PatientSession {
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
}

export function usePatientPortal() {
  const [session, setSession] = useState<PatientSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PatientSession;
        if (Date.now() - parsed.loginTime < SESSION_TTL) {
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
    const cleanPhone = phone.replace(/\D/g, "");

    const { data: patients, error } = await supabase
      .from("patients")
      .select(
        `id, name, healthcare_id, phone, dob, gender, blood_group,
         allergies, chronic_conditions, clinic_id, clinics(name)`,
      )
      .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone},phone.eq.0${cleanPhone}`);

    if (error) return { success: false, error: "Verification failed. Please try again." };
    if (!patients || patients.length === 0) {
      return { success: false, error: "No records found for this phone number." };
    }

    const dobMatches = patients.filter((p) => {
      if (!p.dob) return false;
      const patientDob = new Date(p.dob).toISOString().split("T")[0];
      const inputDob = new Date(dob).toISOString().split("T")[0];
      return patientDob === inputDob;
    });

    if (dobMatches.length === 0) {
      return {
        success: false,
        error: "Date of birth does not match our records. Please check and try again.",
      };
    }

    const uniqueNames = [...new Set(dobMatches.map((p) => p.name))];
    if (uniqueNames.length > 1) {
      return { success: false, multipleProfiles: dobMatches };
    }

    const patientIds = dobMatches.map((p) => p.id);
    const primaryPatient = dobMatches[0] as any;

    const newSession: PatientSession = {
      patientIds,
      primaryPatient,
      allPatients: dobMatches,
      loginTime: Date.now(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
    return { success: true };
  };

  const selectProfile = (patient: any, allMatches: any[]) => {
    const filtered = allMatches.filter((p) => p.name === patient.name);
    const newSession: PatientSession = {
      patientIds: filtered.map((p) => p.id),
      primaryPatient: patient,
      allPatients: filtered,
      loginTime: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return { session, loading, login, logout, selectProfile };
}