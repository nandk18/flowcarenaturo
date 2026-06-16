import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { LeadList } from "./Sales";
import { useNavigate } from "react-router-dom";

export default function PatientsListPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const clinicId = profile?.clinic_id;

  return (
    <DashboardLayout title="Patients">
      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Loading clinic...
        </div>
      ) : (
        <LeadList
          clinicId={clinicId}
          patientHrefPrefix="/patients"
          defaultStatus="current"
          onEdit={(p) => navigate(`/patients/${p.id}`)}
        />
      )}
    </DashboardLayout>
  );
}
