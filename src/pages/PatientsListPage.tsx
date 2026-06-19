import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { LeadList } from "./Sales";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

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
          renderSearchEmpty={(term) => (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <UserPlus className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium">No patients found for "{term}"</p>
              <p className="text-xs text-muted-foreground">Try a different search or add a new patient</p>
              <Button onClick={() => navigate(`/patients/add?q=${encodeURIComponent(term)}`)}>
                <UserPlus className="mr-1 h-4 w-4" /> Add Patient
              </Button>
            </div>
          )}
        />
      )}
    </DashboardLayout>
  );
}
