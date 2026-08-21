import DashboardLayout from "@/components/layout/DashboardLayout";
import LeadPipelineBoard from "@/components/leads/LeadPipelineBoard";
import { useAuth } from "@/hooks/useAuth";

export default function LeadsPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  return (
    <DashboardLayout title="Lead Pipeline">
      <LeadPipelineBoard clinicId={clinicId} />
    </DashboardLayout>
  );
}
