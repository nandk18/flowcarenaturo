import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LeadForm } from "./Sales";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type DupCheck = {
  pending: any | null;
  matches: { id: string; name: string; phone: string | null; lead_status: string | null }[];
};

export default function PatientAddPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const clinicId = profile?.clinic_id;
  const [dup, setDup] = useState<DupCheck | null>(null);

  return (
    <DashboardLayout title="Add Patient">
      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Loading clinic...
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <LeadForm
            clinicId={clinicId}
            onSaved={(p) => navigate(`/patients/${p.id}`)}
          />
        </div>
      )}

      <Dialog open={!!dup} onOpenChange={(o) => !o && setDup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" /> Possible duplicate
            </DialogTitle>
            <DialogDescription>
              A patient with this name/phone already exists.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {dup?.matches.map((m) => (
              <div key={m.id} className="rounded-md border p-3 text-sm">
                <div className="font-semibold">{m.name}</div>
                <div className="text-muted-foreground">{m.phone}</div>
                <div className="text-xs uppercase">{m.lead_status}</div>
                <Button
                  size="sm"
                  variant="link"
                  className="px-0"
                  onClick={() => navigate(`/patients/${m.id}`)}
                >
                  View existing patient
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDup(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
