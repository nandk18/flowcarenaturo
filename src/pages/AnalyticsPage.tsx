import DashboardLayout from "@/components/layout/DashboardLayout";
import AnalyticsView from "@/components/analytics/AnalyticsView";
import { useAuth } from "@/hooks/useAuth";
import { BarChart2 } from "lucide-react";

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? null;

  return (
    <DashboardLayout>
      <div className="mb-4 flex items-center gap-2">
        <BarChart2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Clinic performance insights</p>
        </div>
      </div>
      {clinicId ? (
        <AnalyticsView clinicId={clinicId} />
      ) : (
        <p className="text-sm text-muted-foreground py-10 text-center">No clinic linked to your account.</p>
      )}
    </DashboardLayout>
  );
}
