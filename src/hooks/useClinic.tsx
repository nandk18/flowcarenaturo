import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

  useEffect(() => {
    if (!profile?.clinic_id) { setLoading(false); return; }

    const fetchData = async () => {
      const [clinicRes, doctorRes] = await Promise.all([
        supabase.from("clinics").select("id, name, address, phone, email, website, logo_url, letterhead_url, regional_language, gst_number, gst_percentage, invoice_prefix").eq("id", profile.clinic_id!).single(),
        supabase.from("doctors").select("id, name, qualification, registration_number, specialty, signature_url, availability, default_template_id").eq("clinic_id", profile.clinic_id!).eq("user_id", profile.user_id).single(),
      ]);
      if (clinicRes.data) setClinic(clinicRes.data as any);
      if (doctorRes.data) setDoctor(doctorRes.data as any);
      setLoading(false);
    };
    fetchData();
  }, [profile?.clinic_id, profile?.user_id]);

  const refetch = async () => {
    if (!profile?.clinic_id) return;
    const [clinicRes, doctorRes] = await Promise.all([
      supabase.from("clinics").select("id, name, address, phone, logo_url, letterhead_url, regional_language").eq("id", profile.clinic_id!).single(),
      supabase.from("doctors").select("id, name, qualification, registration_number, specialty, signature_url, availability, default_template_id").eq("clinic_id", profile.clinic_id!).eq("user_id", profile.user_id).single(),
    ]);
    if (clinicRes.data) setClinic(clinicRes.data as any);
    if (doctorRes.data) setDoctor(doctorRes.data as any);
  };

  return { clinic, doctor, loading, refetch };
}
