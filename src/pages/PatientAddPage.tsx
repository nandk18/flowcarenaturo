import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { LeadForm } from "./Sales";

function prefillFromSearch(term: string) {
  if (!term) return {};
  const isPhone = /^[0-9+\s-]{6,}$/.test(term);
  if (isPhone) return { phone: term.trim() };
  const parts = term.trim().split(/\s+/);
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") || undefined };
}

export default function PatientAddPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const clinicId = profile?.clinic_id;
  const prefill = useMemo(() => prefillFromSearch(q), [q]);

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
            prefill={prefill}
            onSaved={(p) => navigate(`/patients/${p.id}`)}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
