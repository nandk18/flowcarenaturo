import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { LeadList, LeadForm } from "./Sales";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ConsultPatients() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [editing, setEditing] = useState<any | null>(null);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Patients</h1>
        <p className="text-sm text-muted-foreground">
          Full patient list — shared with Sales
        </p>
      </div>

      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Loading clinic...
        </div>
      ) : (
        <LeadList
          clinicId={clinicId}
          onEdit={(p) => setEditing(p)}
          patientHrefPrefix="/consult/patients"
        />
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
          </DialogHeader>
          {editing && clinicId && (
            <LeadForm
              clinicId={clinicId}
              initial={editing}
              onSaved={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
