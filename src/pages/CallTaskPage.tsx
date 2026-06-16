import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { CallTask } from "./Sales";

export default function CallTaskPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  return (
    <DashboardLayout title="Call Task">
      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Loading clinic...
        </div>
      ) : (
        <CallTask clinicId={clinicId} />
      )}
    </DashboardLayout>
  );
}
