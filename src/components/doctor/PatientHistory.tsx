import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, FileText, Pill, ExternalLink, FlaskConical, AlertTriangle, Pencil } from "lucide-react";
import VitalsTrends from "@/components/vitals/VitalsTrends";
import { renderClinicalNotes } from "@/lib/templateFields";
import EditVisitSheet from "@/components/doctor/EditVisitSheet";
import { openPrescription } from "@/lib/prescriptionUtils";

type Props = {
  patientId: string;
  currentVisitId: string;
};

type HistoryVisit = {
  id: string;
  visit_date: string | null;
  token_number: number;
  chief_complaint: string | null;
  status: string | null;
  doctors: { name: string; qualification: string | null } | null;
  clinical_notes: { id: string; doctor_id: string; soap_notes: any; raw_transcript: string | null; updated_at?: string | null }[];
  prescriptions: { id: string; doctor_id: string; medications: any; investigations: any; follow_up_date: string | null; pdf_url: string | null; notes: string | null; updated_at?: string | null }[];
};

type LabOrder = {
  id: string;
  test_name: string;
  test_category: string | null;
  status: string | null;
  urgency: string | null;
  ordered_at: string | null;
  labs: { name: string } | null;
  lab_results: { id: string; ai_summary: any; status: string | null; uploaded_at: string | null }[];
};

export default function PatientHistory({ patientId, currentVisitId }: Props) {
  const { profile } = useAuth();
  const { doctor } = useClinic();
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVisit, setEditingVisit] = useState<any>(null);

  const canEdit = profile?.role === "admin";

  const fetchHistory = async () => {
    setLoading(true);
    const [historyRes, labRes] = await Promise.all([
      supabase
        .from("visits")
        .select(`
          id, visit_date, token_number, chief_complaint, status,
          doctors(name, qualification),
          clinical_notes(id, doctor_id, soap_notes, raw_transcript, updated_at),
          prescriptions(id, doctor_id, medications, investigations, follow_up_date, pdf_url, notes, updated_at)
        `)
        .eq("patient_id", patientId)
        .neq("id", currentVisitId)
        .order("visit_date", { ascending: false })
        .limit(20),
      supabase
        .from("lab_orders")
        .select("id, test_name, test_category, status, urgency, ordered_at, labs(name), lab_results(id, ai_summary, status, uploaded_at)")
        .eq("patient_id", patientId)
        .order("ordered_at", { ascending: false })
        .limit(20),
    ]);

    if (!historyRes.error && historyRes.data) {
      setHistory(historyRes.data.map((v: any) => ({
        ...v,
        doctors: Array.isArray(v.doctors) ? v.doctors[0] ?? null : v.doctors,
      })));
    }
    if (!labRes.error && labRes.data) {
      setLabOrders(labRes.data.map((o: any) => ({
        ...o,
        labs: Array.isArray(o.labs) ? o.labs[0] ?? null : o.labs,
        lab_results: o.lab_results || [],
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-history-orders-${patientId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "lab_orders", filter: `patient_id=eq.${patientId}` },
        () => fetchHistory()
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "lab_results", filter: `patient_id=eq.${patientId}` },
        () => fetchHistory()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, currentVisitId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  const renderLabOrdersSection = () => {
    if (labOrders.length === 0) return null;
    return (
      <Card className="shadow-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold text-foreground">Lab Orders</h3>
            <Badge variant="outline" className="text-[10px]">{labOrders.length}</Badge>
          </div>
          <div className="space-y-2">
            {labOrders.map(order => {
              const result = order.lab_results?.[0];
              const summary = result?.ai_summary as any;
              const status = summary?.overall_status;
              const statusClass =
                status === "critical" ? "bg-destructive/10 text-destructive border-destructive/30" :
                status === "abnormal" ? "bg-orange-500/10 text-orange-600 border-orange-500/30" :
                status === "borderline" ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" :
                status === "normal" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" :
                "bg-muted text-muted-foreground border-border";
              return (
                <div key={order.id} className="rounded-lg border border-border p-2.5 space-y-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{order.test_name}</span>
                        {order.test_category && <Badge variant="outline" className="text-[10px]">{order.test_category}</Badge>}
                        {order.urgency && order.urgency !== "routine" && (
                          <Badge variant="outline" className="text-[10px] border-warning/30 bg-warning/10 text-warning uppercase">{order.urgency}</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {order.labs?.name || "Any Lab"}
                        {order.ordered_at && ` · ${new Date(order.ordered_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    {result ? (
                      <Badge variant="outline" className={`text-[10px] ${statusClass}`}>
                        {summary?.urgent && <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />}
                        {status || "result ready"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                        {order.status || "pending"}
                      </Badge>
                    )}
                  </div>
                  {summary?.one_line_summary && (
                    <p className="text-xs text-foreground/80 bg-muted/50 rounded p-2">
                      🤖 {summary.one_line_summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (history.length === 0 && labOrders.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground/20" />
          <h3 className="font-display text-lg font-semibold text-muted-foreground">First Visit</h3>
          <p className="text-sm text-muted-foreground">No previous visit history for this patient</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <VitalsTrends patientId={patientId} />
      {renderLabOrdersSection()}
      {history.length > 0 && (
        <p className="text-sm text-muted-foreground">{history.length} previous visit{history.length !== 1 ? "s" : ""}</p>
      )}
      {history.map(visit => {
        const note = visit.clinical_notes?.[0];
        const soap = note?.soap_notes;
        const prescription = visit.prescriptions?.[0];
        const meds = prescription?.medications;
        const prescriptionId = prescription?.id;
        const noteDoctorId = note?.doctor_id;
        const lastEdited = note?.updated_at || prescription?.updated_at;

        const displayField = soap?.assessment || soap?.diagnosis || soap?.admission_diagnosis || soap?.current_status;

        const canEditThis = canEdit && doctor?.id && (
          (note && noteDoctorId === doctor.id) ||
          (prescription && prescription.doctor_id === doctor.id)
        );

        return (
          <Card key={visit.id} className="shadow-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{visit.visit_date}</span>
                    <Badge variant="outline" className="text-[10px]">#{visit.token_number}</Badge>
                  </div>
                  {visit.doctors && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(visit.doctors.name?.match(/^dr\.?\b/i) ? visit.doctors.name : `Dr. ${visit.doctors.name}`)}{visit.doctors.qualification && `, ${visit.doctors.qualification}`}
                    </p>
                  )}
                  {lastEdited && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Last edited: {new Date(lastEdited).toLocaleString()}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">{visit.status}</Badge>
              </div>

              {visit.chief_complaint && (
                <p className="text-sm text-muted-foreground">{visit.chief_complaint}</p>
              )}

              {displayField && (
                <p className="text-sm font-semibold text-foreground">{displayField}</p>
              )}

              {meds && Array.isArray(meds) && meds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {meds.map((m: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      <Pill className="mr-0.5 h-2.5 w-2.5" /> {m.name} {m.dosage}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {soap && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs h-7">
                        <FileText className="mr-1 h-3 w-3" /> View Full Notes <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2 rounded-lg bg-muted/50 p-3 text-xs">
                      {renderClinicalNotes(soap)}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {prescriptionId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => openPrescription(prescriptionId)}
                  >
                    <ExternalLink className="mr-1 h-3 w-3" /> View Prescription
                  </Button>
                )}

                {canEditThis && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => setEditingVisit({
                      id: visit.id,
                      clinical_notes_id: note?.id || null,
                      soap_notes: soap || {},
                      prescription_id: prescription?.id || null,
                      medications: prescription?.medications || [],
                      follow_up_date: prescription?.follow_up_date || null,
                      prescription_notes: prescription?.notes || null,
                    })}
                  >
                    <Pencil className="mr-1 h-3 w-3" /> Edit Notes & Rx
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <EditVisitSheet
        open={!!editingVisit}
        onClose={() => setEditingVisit(null)}
        visit={editingVisit}
        onSaved={() => fetchHistory()}
      />
    </div>
  );
}
