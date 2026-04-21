import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Clock, AlertTriangle, Stethoscope, ArrowRight, Eye, Lock, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

type Visit = {
  id: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
  vitals: any;
  created_at: string;
  patient_id: string;
  patient: { id: string; name: string; healthcare_id: string | null; gender: string | null; dob: string | null; blood_group: string | null; allergies: any; chronic_conditions: any } | null;
};

type CompletedNotes = {
  soap: any;
  medications: any[];
  investigations: string[];
  follow_up_date: string | null;
};

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // View notes sheet
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesVisit, setNotesVisit] = useState<Visit | null>(null);
  const [notesData, setNotesData] = useState<CompletedNotes | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  const fetchVisits = useCallback(async () => {
    if (!profile?.clinic_id) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("visits")
      .select("id, token_number, status, chief_complaint, vitals, created_at, patient_id, patients!inner(id, name, healthcare_id, gender, dob, blood_group, allergies, chronic_conditions)")
      .eq("clinic_id", profile.clinic_id)
      .eq("visit_date", today)
      .order("token_number", { ascending: true });

    if (!error && data) {
      setVisits(data.map((v: any) => ({ ...v, patient: v.patients })));
    }
    setLoading(false);
  }, [profile?.clinic_id]);

  useEffect(() => {
    fetchVisits();
    const channel = supabase
      .channel("doctor-visits")
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => fetchVisits())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchVisits]);

  const handleStartConsultation = async (visit: Visit) => {
    if (visit.status === "completed") return;
    if (visit.status === "waiting") {
      await supabase.from("visits").update({ status: "in_progress" }).eq("id", visit.id);
    }
    navigate(`/dashboard/consultation/${visit.id}`);
  };

  const handleViewNotes = async (visit: Visit) => {
    setNotesVisit(visit);
    setNotesOpen(true);
    setNotesLoading(true);
    try {
      const [notesRes, rxRes] = await Promise.all([
        supabase.from("clinical_notes").select("soap_notes").eq("visit_id", visit.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("prescriptions").select("medications, investigations, follow_up_date").eq("visit_id", visit.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setNotesData({
        soap: notesRes.data?.soap_notes || {},
        medications: (rxRes.data?.medications as any[]) || [],
        investigations: (rxRes.data?.investigations as string[]) || [],
        follow_up_date: rxRes.data?.follow_up_date || null,
      });
    } catch { setNotesData(null); }
    finally { setNotesLoading(false); }
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

  const statusColor = (status: string) => {
    if (status === "waiting") return "bg-warning/15 text-warning border-warning/30";
    if (status === "in_progress") return "bg-info/15 text-info border-info/30";
    if (status === "completed") return "bg-muted text-muted-foreground border-muted";
    return "bg-muted text-muted-foreground";
  };

  const filteredVisits = visits.filter(v => filter === "all" || v.status === filter);

  const counts = {
    all: visits.length,
    waiting: visits.filter(v => v.status === "waiting").length,
    in_progress: visits.filter(v => v.status === "in_progress").length,
    completed: visits.filter(v => v.status === "completed").length,
  };

  const filterTabs = [
    { key: "all", label: "All", count: counts.all },
    { key: "waiting", label: "Waiting", count: counts.waiting },
    { key: "in_progress", label: "In Progress", count: counts.in_progress },
    { key: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Today's Queue</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">{counts.all} patients</Badge>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 px-1">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-medium transition-all text-center ${
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground border border-border"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)
        ) : filteredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Stethoscope className="mb-4 h-16 w-16 text-muted-foreground/20" />
            <h3 className="font-display text-lg font-semibold text-muted-foreground">No patients {filter !== "all" ? `${filter.replace("_", " ")}` : "today"}</h3>
          </div>
        ) : (
          filteredVisits.map(visit => {
            const isCompleted = visit.status === "completed";
            const hasVitals = visit.vitals && Object.keys(visit.vitals).length > 0;
            const age = getAge(visit.patient?.dob ?? null);

            if (isMobile) {
              return (
                <Card key={visit.id} className={`shadow-card ${isCompleted ? "opacity-70" : ""}`}>
                  <CardContent className="p-4">
                    {/* Top row: token + patient info + status */}
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isCompleted ? "bg-muted" : "bg-primary"}`}>
                        <span className={`text-sm font-bold ${isCompleted ? "text-muted-foreground" : "text-primary-foreground"}`}>#{visit.token_number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-foreground text-sm truncate">{visit.patient?.name}</h3>
                          <Badge variant="outline" className={`flex-shrink-0 text-[10px] ${statusColor(visit.status)}`}>
                            {isCompleted && <Lock className="mr-1 h-2.5 w-2.5" />}
                            {visit.status.replace("_", " ")}
                          </Badge>
                        </div>
                        {visit.patient?.healthcare_id && (
                          <p className="text-xs text-primary font-medium mt-0.5">{visit.patient.healthcare_id}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {visit.patient?.gender}{age !== null && `, ${age}y`}{visit.patient?.blood_group && ` · ${visit.patient.blood_group}`}
                        </p>
                      </div>
                    </div>

                    {/* Chief complaint */}
                    {visit.chief_complaint && (
                      <div className="mt-2 ml-[52px]">
                        <span className="inline-block bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full border border-border">
                          {visit.chief_complaint}
                        </span>
                      </div>
                    )}

                    {/* Vitals + action */}
                    <div className="mt-2 ml-[52px] flex items-center justify-between">
                      <span className={`text-xs flex items-center gap-1 ${hasVitals ? "text-success" : "text-destructive"}`}>
                        <span className={`w-2 h-2 rounded-full ${hasVitals ? "bg-success" : "bg-destructive"}`} />
                        {hasVitals ? "Vitals recorded" : "No vitals"}
                      </span>
                      {isCompleted ? (
                        <Button variant="outline" size="sm" className="text-xs h-7 px-3" onClick={(e) => { e.stopPropagation(); handleViewNotes(visit); }}>
                          <Eye className="mr-1 h-3 w-3" /> View Notes
                        </Button>
                      ) : (
                        <Button size="sm" className="text-xs h-7 px-3" onClick={(e) => { e.stopPropagation(); handleStartConsultation(visit); }}>
                          <ArrowRight className="mr-1 h-3 w-3" />
                          {visit.status === "in_progress" ? "Continue" : "Start"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Desktop card
            return (
              <Card
                key={visit.id}
                className={`shadow-card transition-all ${isCompleted ? "opacity-70" : "hover:shadow-elevated cursor-pointer"}`}
                onClick={() => !isCompleted && handleStartConsultation(visit)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl font-display text-xl font-bold ${isCompleted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
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
                        {visit.patient?.blood_group && ` · ${visit.patient.blood_group}`}
                      </p>
                      {visit.chief_complaint && (
                        <p className="text-sm text-foreground/80 mt-1 truncate">{visit.chief_complaint}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {hasVitals ? (
                          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Vitals recorded</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">No vitals</Badge>
                        )}
                        {visit.patient?.allergies && Array.isArray(visit.patient.allergies) && visit.patient.allergies.length > 0 && (
                          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                            <AlertTriangle className="mr-1 h-2.5 w-2.5" /> Allergies
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge variant="outline" className={statusColor(visit.status)}>
                        {isCompleted && <Lock className="mr-1 h-3 w-3" />}
                        {visit.status.replace("_", " ")}
                      </Badge>
                      {visit.status === "waiting" && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {getWaitTime(visit.created_at)}
                        </span>
                      )}
                      {isCompleted ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={(e) => { e.stopPropagation(); handleViewNotes(visit); }}
                        >
                          <Eye className="mr-1 h-3 w-3" /> View Notes
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="text-xs"
                          onClick={(e) => { e.stopPropagation(); handleStartConsultation(visit); }}
                        >
                          <ArrowRight className="mr-1 h-3 w-3" />
                          {visit.status === "waiting" ? "Start" : "Continue"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* View Notes Sheet */}
      <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              {notesVisit?.patient?.name} — Completed Notes
            </SheetTitle>
          </SheetHeader>
          {notesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : notesData ? (
            <div className="space-y-4 mt-4">
              {notesData.soap?.subjective && (
                <div><p className="text-xs font-semibold text-muted-foreground uppercase">Subjective</p><p className="text-sm">{notesData.soap.subjective}</p></div>
              )}
              {notesData.soap?.objective && (
                <div><p className="text-xs font-semibold text-muted-foreground uppercase">Objective</p><p className="text-sm">{notesData.soap.objective}</p></div>
              )}
              {notesData.soap?.assessment && (
                <div><p className="text-xs font-semibold text-muted-foreground uppercase">Assessment</p><p className="text-sm">{notesData.soap.assessment}</p></div>
              )}
              {notesData.soap?.plan && (
                <div><p className="text-xs font-semibold text-muted-foreground uppercase">Plan</p><p className="text-sm">{notesData.soap.plan}</p></div>
              )}
              {notesData.medications.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Medications</p>
                  <div className="space-y-1">
                    {notesData.medications.map((m: any, i: number) => (
                      <div key={i} className="text-sm flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                        <span className="font-medium">{i+1}. {m.name}</span>
                        <span className="text-muted-foreground">{m.dosage}</span>
                        <span className="text-xs text-muted-foreground">
                          {[m.morning && "M", m.afternoon && "A", m.evening && "E", m.night && "N"].filter(Boolean).join("/")}
                        </span>
                        {m.duration && <span className="text-xs text-muted-foreground">× {m.duration}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {notesData.investigations.length > 0 && (
                <div><p className="text-xs font-semibold text-muted-foreground uppercase">Investigations</p><p className="text-sm">{notesData.investigations.join(", ")}</p></div>
              )}
              {notesData.follow_up_date && (
                <div><p className="text-xs font-semibold text-muted-foreground uppercase">Follow-up</p><p className="text-sm">{new Date(notesData.follow_up_date).toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p></div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No notes found for this visit.</p>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
