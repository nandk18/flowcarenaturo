import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { clientCache, CACHE_KEYS, CACHE_TTL } from "@/lib/clientCache";

type Clinic = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  letterhead_url: string | null;
  regional_language: string | null;
};

type Doctor = {
  id: string;
  name: string;
  qualification: string | null;
  registration_number: string | null;
  specialty: string | null;
  signature_url: string | null;
  availability: string | null;
  default_template_id: string | null;
};

export function useClinic() {
  const { profile } = useAuth();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFromCacheOrFetch = async (clinicId: string, userId: string) => {
    const clinicKey = CACHE_KEYS.clinicSettings(clinicId);
    const doctorKey = `${CACHE_KEYS.clinicDoctors(clinicId)}:${userId}`;

    const cachedClinic = clientCache.get<Clinic>(clinicKey);
    const cachedDoctor = clientCache.get<Doctor>(doctorKey);

    if (cachedClinic) setClinic(cachedClinic);
    if (cachedDoctor) setDoctor(cachedDoctor);

    const [clinicRes, doctorRes] = await Promise.all([
      cachedClinic
        ? Promise.resolve({ data: cachedClinic } as any)
        : supabase.from("clinics").select("id, name, address, phone, logo_url, letterhead_url, regional_language").eq("id", clinicId).single(),
      cachedDoctor
        ? Promise.resolve({ data: cachedDoctor } as any)
        : supabase.from("doctors").select("id, name, qualification, registration_number, specialty, signature_url, availability, default_template_id").eq("clinic_id", clinicId).eq("user_id", userId).single(),
    ]);

    if (clinicRes.data) {
      setClinic(clinicRes.data as any);
      if (!cachedClinic) clientCache.set(clinicKey, clinicRes.data, CACHE_TTL.clinicSettings);
    }
    if (doctorRes.data) {
      setDoctor(doctorRes.data as any);
      if (!cachedDoctor) clientCache.set(doctorKey, doctorRes.data, CACHE_TTL.doctors);
    }
  };

  useEffect(() => {
    if (!profile?.clinic_id) { setLoading(false); return; }

    const fetchData = async () => {
      await loadFromCacheOrFetch(profile.clinic_id!, profile.user_id);
      setLoading(false);
    };
    fetchData();
  }, [profile?.clinic_id, profile?.user_id]);

  const refetch = async () => {
    if (!profile?.clinic_id) return;
    // Bust cache so refetch always pulls fresh.
    clientCache.delete(CACHE_KEYS.clinicSettings(profile.clinic_id));
    clientCache.delete(`${CACHE_KEYS.clinicDoctors(profile.clinic_id)}:${profile.user_id}`);
    await loadFromCacheOrFetch(profile.clinic_id, profile.user_id);
  };

  return { clinic, doctor, loading, refetch };
}
