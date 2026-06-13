import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ConsultationWorkspace from "@/components/doctor/ConsultationWorkspace";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Visit = {
  id: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
  vitals: any;
  created_at: string;
  patient_id: string;
  lifestyle?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  captured_at_reception?: boolean | null;
  patient: {
    id: string; name: string; healthcare_id: string | null; gender: string | null;
    dob: string | null; blood_group: string | null; allergies: any; chronic_conditions: any;
    phone: string | null; email: string | null;
  } | null;
};

export default function DoctorConsultationPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVisit = useCallback(async () => {
    if (!visitId || !profile?.clinic_id) return;
    const { data, error } = await (supabase as any)
      .from("visits")
      .select("id, token_number, status, chief_complaint, vitals, created_at, patient_id, lifestyle, height_cm, weight_kg, captured_at_reception, patients!inner(id, name, healthcare_id, gender, dob, blood_group, allergies, chronic_conditions, phone, email)")
      .eq("id", visitId)
      .eq("clinic_id", profile.clinic_id)
      .single();

    if (!error && data) {
      setVisit({ ...data, patient: (data as any).patients } as Visit);
    }
    setLoading(false);
  }, [visitId, profile?.clinic_id]);

  useEffect(() => { fetchVisit(); }, [fetchVisit]);

  const statusColor = (status: string) => {
    if (status === "waiting") return "bg-warning/15 text-warning border-warning/30";
    if (status === "in_progress") return "bg-info/15 text-info border-info/30";
    if (status === "completed") return "bg-success/15 text-success border-success/30";
    return "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!visit) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Visit not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Queue
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Top nav bar */}
      <div className="mb-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Queue
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-foreground">{visit.patient?.name}</span>
          {visit.patient?.healthcare_id && (
            <span className="font-mono text-xs text-primary">{visit.patient.healthcare_id}</span>
          )}
          <Badge variant="outline" className={statusColor(visit.status)}>
            {visit.status.replace("_", " ")}
          </Badge>
        </div>
      </div>

      <ConsultationWorkspace visit={visit} onComplete={() => navigate("/dashboard")} />
    </DashboardLayout>
  );
}
