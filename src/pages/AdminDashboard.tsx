import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PatientRegistration from "@/components/receptionist/PatientRegistration";
import TodayQueue from "@/components/receptionist/TodayQueue";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, Stethoscope, UserPlus, Clock, AlertTriangle, ArrowRight, TrendingUp, HeartPulse, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TodayAppointmentsWidget from "@/components/appointments/TodayAppointmentsWidget";
import { cn } from "@/lib/utils";

type Visit = {
  id: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
  vitals: any;
  created_at: string;
  patient_id: string;
  patient: { id: string; name: string; healthcare_id: string | null; gender: string | null; dob: string | null; allergies: any; chronic_conditions: any } | null;
};

function AdminQueueView() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPatientOpen, setAddPatientOpen] = useState(false);

  const fetchVisits = useCallback(async () => {
    if (!profile?.clinic_id) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("visits")
      .select("id, token_number, status, chief_complaint, vitals, created_at, patient_id, patients!inner(id, name, healthcare_id, gender, dob, allergies, chronic_conditions)")
      .eq("clinic_id", profile.clinic_id)
      .eq("visit_date", today)
      .order("token_number", { ascending: true });
    if (data) setVisits(data.map((v: any) => ({ ...v, patient: v.patients })));
    setLoading(false);
  }, [profile?.clinic_id]);

  useEffect(() => {
    fetchVisits();
    const channel = supabase
      .channel("admin-visits")
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => fetchVisits())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchVisits]);

  const statusColor = (status: string) => {
    if (status === "waiting") return "bg-warning/15 text-warning border-warning/30";
    if (status === "in_progress") return "bg-info/15 text-info border-info/30";
    if (status === "completed") return "bg-success/15 text-success border-success/30";
    return "bg-muted text-muted-foreground";
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const getWaitTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const handleStartConsultation = async (visit: Visit) => {
    if (visit.status === "waiting") {
      await supabase.from("visits").update({ status: "in_progress" }).eq("id", visit.id);
    }
    navigate(`/dashboard/consultation/${visit.id}`);
  };

  return (
    <Tabs defaultValue="reception" className="space-y-4">
      <TodayAppointmentsWidget />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="reception"><CalendarDays className="mr-2 h-4 w-4" /> Reception</TabsTrigger>
          <TabsTrigger value="doctor"><Stethoscope className="mr-2 h-4 w-4" /> Consultation</TabsTrigger>
        </TabsList>
        <Dialog open={addPatientOpen} onOpenChange={setAddPatientOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto"><UserPlus className="mr-2 h-4 w-4" /> Add Patient</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>Register & Queue Patient</DialogTitle></DialogHeader>
            <PatientRegistration onSuccess={() => { setAddPatientOpen(false); fetchVisits(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <TabsContent value="reception">
        <TodayQueue />
      </TabsContent>

      <TabsContent value="doctor">
        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)
          ) : visits.filter(v => v.status === "waiting" || v.status === "in_progress").length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Stethoscope className="mb-4 h-16 w-16 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No patients waiting</p>
            </div>
          ) : (
            visits.filter(v => v.status === "waiting" || v.status === "in_progress").map(visit => (
              <Card
                key={visit.id}
                className="shadow-card transition-all hover:shadow-elevated cursor-pointer"
                onClick={() => handleStartConsultation(visit)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-lg font-bold text-primary">
                    #{visit.token_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{visit.patient?.name}</p>
                      {visit.patient?.healthcare_id && (
                        <span className="font-mono text-[10px] text-primary">{visit.patient.healthcare_id}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {visit.patient?.gender}{visit.patient?.dob && `, ${getAge(visit.patient.dob)}y`}
                    </p>
                    {visit.chief_complaint && <p className="text-xs text-muted-foreground mt-1 truncate">{visit.chief_complaint}</p>}
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${statusColor(visit.status)}`}>{visit.status.replace("_", " ")}</Badge>
                      {visit.patient?.allergies && Array.isArray(visit.patient.allergies) && visit.patient.allergies.length > 0 && (
                        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                          <AlertTriangle className="mr-1 h-2.5 w-2.5" /> Allergies
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {visit.status === "waiting" && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {getWaitTime(visit.created_at)}
                      </span>
                    )}
                    <Button size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); handleStartConsultation(visit); }}>
                      {visit.status === "waiting" ? <><ArrowRight className="mr-1 h-3 w-3" /> Start</> : <><ArrowRight className="mr-1 h-3 w-3" /> Continue</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

type SectionKey = "sales" | "consult" | "treatment";

const SECTIONS: {
  key: SectionKey;
  icon: typeof TrendingUp;
  label: string;
  title: string;
  description: string;
  badge: string;
  badgeVariant: "default" | "secondary";
  theme: { border: string; bg: string; iconBg: string; iconText: string; ring: string };
}[] = [
  {
    key: "sales",
    icon: TrendingUp,
    label: "Sales",
    title: "Revenue & Growth",
    description: "Track revenue, leads, conversions and clinic growth",
    badge: "Coming Soon",
    badgeVariant: "secondary",
    theme: {
      border: "border-blue-500/30",
      bg: "hover:bg-blue-500/5",
      iconBg: "bg-blue-500/10",
      iconText: "text-blue-500",
      ring: "ring-2 ring-blue-500 border-blue-500",
    },
  },
  {
    key: "consult",
    icon: Stethoscope,
    label: "Consult",
    title: "Clinical Dashboard",
    description: "Appointments, diagnoses, prescriptions and performance",
    badge: "Active",
    badgeVariant: "default",
    theme: {
      border: "border-green-500/30",
      bg: "hover:bg-green-500/5",
      iconBg: "bg-green-500/10",
      iconText: "text-green-600",
      ring: "ring-2 ring-green-500 border-green-500",
    },
  },
  {
    key: "treatment",
    icon: ClipboardHeart,
    label: "Treatment",
    title: "Care Plans",
    description: "Treatment plans, patient journeys and follow-ups",
    badge: "Coming Soon",
    badgeVariant: "secondary",
    theme: {
      border: "border-purple-500/30",
      bg: "hover:bg-purple-500/5",
      iconBg: "bg-purple-500/10",
      iconText: "text-purple-500",
      ring: "ring-2 ring-purple-500 border-purple-500",
    },
  },
];

function ComingSoonPanel({ title }: { title: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          This section is coming soon. We're working hard to bring it to you.
        </p>
        <Badge variant="secondary" className="mt-4">Coming Soon</Badge>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section") as SectionKey | null;
  const active: SectionKey =
    sectionParam === "sales" || sectionParam === "treatment" || sectionParam === "consult"
      ? sectionParam
      : "consult";

  const handleSelect = (key: SectionKey) => {
    setSearchParams({ section: key }, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your clinic operations</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => handleSelect(s.key)}
              className={cn(
                "group text-left rounded-xl border bg-card p-5 shadow-card transition-all hover:shadow-elevated",
                s.theme.border,
                s.theme.bg,
                isActive && s.theme.ring,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", s.theme.iconBg)}>
                  <Icon className={cn("h-5 w-5", s.theme.iconText)} />
                </div>
                <Badge variant={s.badgeVariant} className="text-[10px]">{s.badge}</Badge>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {active === "consult" && <AdminQueueView />}
      {active === "sales" && <ComingSoonPanel title="Revenue & Growth" />}
      {active === "treatment" && <ComingSoonPanel title="Care Plans" />}
    </DashboardLayout>
  );
}
