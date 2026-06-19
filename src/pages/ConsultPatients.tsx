import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { LeadList, LeadForm } from "./Sales";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ConsultPatients() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const clinicId = profile?.clinic_id;
  const [editing, setEditing] = useState<any | null>(null);
  const [addPrefill, setAddPrefill] = useState<string | null>(null);

  const openAddWithName = (searchTerm: string) => {
    // Split search into first/last name if it contains a space
    setAddPrefill(searchTerm);
  };

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
          defaultStatus="current"
          onEdit={(p) => setEditing(p)}
          patientHrefPrefix="/consult/patients"
          renderSearchEmpty={(term) => (
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <UserPlus className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                No patient found for "{term}"
              </p>
              <Button onClick={() => openAddWithName(term)}>
                <UserPlus className="mr-2 h-4 w-4" /> Add as New Patient
              </Button>
            </div>
          )}
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

      <Dialog open={addPrefill !== null} onOpenChange={(o) => !o && setAddPrefill(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Patient</DialogTitle>
          </DialogHeader>
          {addPrefill !== null && clinicId && (
            <LeadForm
              clinicId={clinicId}
              prefill={{
                first_name: addPrefill.split(" ")[0] ?? addPrefill,
                last_name: addPrefill.split(" ").slice(1).join(" ") || undefined,
              }}
              onSaved={async (p) => {
                await supabase.from("patients").update({ lead_status: "current" }).eq("id", p.id);
                setAddPrefill(null);
                navigate(`/consult/patients/${p.id}`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
