import SettingsShell from "@/components/layout/SettingsShell";
import SettingsPinGate from "@/components/settings/SettingsPinGate";
import AnalyticsView from "@/components/analytics/AnalyticsView";
import BillingConfigPage from "./BillingConfigPage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useUrlState } from "@/hooks/useUrlState";
import { BarChart2, Receipt } from "lucide-react";

export default function SettingsAnalyticsPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [section, setSection] = useUrlState("section", "clinic") as [
    string,
    (v: string) => void,
  ];

  return (
    <SettingsShell title="Analytics">
      <SettingsPinGate>
        <Tabs value={section} onValueChange={setSection} className="space-y-4">
          <TabsList>
            <TabsTrigger value="clinic">
              <BarChart2 className="mr-1 h-4 w-4" /> Clinic Analytics
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Receipt className="mr-1 h-4 w-4" /> Invoice Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clinic" className="space-y-4">
            {clinicId ? (
              <AnalyticsView clinicId={clinicId} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No clinic linked to your account.
              </p>
            )}
          </TabsContent>
          <TabsContent value="invoices" className="space-y-4">
            <BillingConfigPage bare />
          </TabsContent>
        </Tabs>
      </SettingsPinGate>
    </SettingsShell>
  );
}
