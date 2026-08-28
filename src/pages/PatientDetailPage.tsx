import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Calendar, ChevronDown, FileText, Pill, ExternalLink, Loader2, Phone, Mail, AlertTriangle, Activity, Trash2, Pencil, Share2, Coffee, Cigarette, Wine, Moon, Utensils, ClipboardList, Scissors } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import VitalsTrends from "@/components/vitals/VitalsTrends";
import { renderClinicalNotes } from "@/lib/templateFields";
import EditVisitSheet from "@/components/doctor/EditVisitSheet";
import { openPrescription } from "@/lib/prescriptionUtils";
import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";
import PatientInvoicesTab from "@/components/billing/PatientInvoicesTab";
import { openWhatsApp } from "@/lib/whatsapp";
import { buildMessage } from "@/lib/messageTemplates";
import { getProfileId } from "@/utils/getProfileId";
import { createShortLink } from "@/utils/createShortLink";

import PatientDocumentsCard from "@/components/patient/PatientDocumentsCard";
import { cn } from "@/lib/utils";


type Patient = {
  id: string; name: string; healthcare_id: string | null; gender: string | null;
  dob: string | null; phone: string | null; email: string | null;
  blood_group: string | null; allergies: any; chronic_conditions: any;
  food_habits: string | null; smoking: string | null; alcohol: string | null;
  sleep_hours: number | null; dinner_time: string | null;
  medication_history: string | null; past_surgery_details: string | null;
};

type HistoryVisit = {
  id: string; visit_date: string | null; token_number: number;
  chief_complaint: string | null; status: string | null;
  doctors: { name: string; qualification: string | null } | null;
  clinical_notes: { id: string; doctor_id: string; soap_notes: any; raw_transcript: string | null; updated_at?: string | null }[];
  prescriptions: { id: string; doctor_id: string; medications: any; investigations: any; follow_up_date: string | null; pdf_url: string | null; notes: string | null; updated_at?: string | null }[];
};

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { doctor, clinic } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<HistoryVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingVisit, setEditingVisit] = useState<any>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "clinical" | "invoices" | "appointments" | "treatment">("general");
  const { log: auditLog } = useAuditLog();

  const isAdmin = profile?.role === "admin";
  const canEdit = profile?.role === "admin";

  const handleSendFormLink = async () => {
    if (!patient || !profile?.clinic_id) return;
    setSendingLink(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, "");
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("patient_form_tokens").insert({
        clinic_id: profile.clinic_id,
        patient_id: patient.id,
        token,
        expires_at: expires.toISOString(),
        is_active: true,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      const rawUrl = `${window.location.origin}/patient-form/${token}`;
      const url = await createShortLink(rawUrl, profile.clinic_id, "patient_form", expires);

      const msg = await buildMessage(profile.clinic_id, "patient_form_link", {
        patient_name: patient.name,
        clinic_name: clinic?.name ?? "our clinic",
        form_link: url,
      });
      if (patient.phone) {
        openWhatsApp(patient.phone, msg);
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Form link copied", description: "Patient has no phone — link copied to clipboard." });
      }
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSendingLink(false);
    }
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const fetchData = async () => {
    if (!patientId || !profile?.clinic_id) return;
    setLoading(true);
    const [patientRes, visitsRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", patientId).eq("clinic_id", profile.clinic_id).single(),
      supabase.from("visits").select(`
        id, visit_date, token_number, chief_complaint, status,
        doctors(name, qualification),
        clinical_notes(id, doctor_id, soap_notes, raw_transcript, updated_at),
        prescriptions(id, doctor_id, medications, investigations, follow_up_date, pdf_url, notes, updated_at)
      `).eq("patient_id", patientId).order("visit_date", { ascending: false }).limit(50),
    ]);
    if (patientRes.data) setPatient(patientRes.data as any);
    if (visitsRes.data) {
      setVisits(visitsRes.data.map((v: any) => ({
        ...v,
        doctors: Array.isArray(v.doctors) ? v.doctors[0] ?? null : v.doctors,
      })));
    }
    setLoading(false);
    if (patientRes.data) {
      auditLog(AUDIT_ACTIONS.PATIENT_VIEWED, "patient", (patientRes.data as any).id, (patientRes.data as any).name);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, profile?.clinic_id]);

  const handleDeletePatient = async () => {
    if (!patientId) return;
    setIsDeleting(true);
    try {
      const { data: visitData } = await supabase.from("visits").select("id").eq("patient_id", patientId);
      const visitIds = visitData?.map(v => v.id) || [];

      if (visitIds.length > 0) {
        const { data: prescriptions } = await supabase.from("prescriptions").select("id").in("visit_id", visitIds);
        const prescriptionIds = prescriptions?.map(p => p.id) || [];

        if (prescriptionIds.length > 0) {
          await supabase.from("document_shares").delete().in("prescription_id", prescriptionIds);
        }
        await supabase.from("prescriptions").delete().in("visit_id", visitIds);
        await supabase.from("clinical_notes").delete().in("visit_id", visitIds);
        await supabase.from("patient_documents").delete().in("visit_id", visitIds);
        await supabase.from("visits").delete().eq("patient_id", patientId);
      }

      await supabase.from("patient_documents").delete().eq("patient_id", patientId);
      await supabase.from("patients").delete().eq("id", patientId);

      toast({ title: "Patient record deleted permanently" });
      navigate("/dashboard/patients");
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Patient not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/patients")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Patients
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "clinical", label: "Clinical notes" },
    { key: "invoices", label: "Invoices" },
    { key: "appointments", label: "Appointments" },
    { key: "treatment", label: "Treatment" },
  ];

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );

  return (
    <DashboardLayout>
      {/* Patient Header */}
      <Card className="mb-4 rounded-xl border-border shadow-none">
        <CardContent className="flex flex-wrap items-start justify-between gap-5 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              variant="outline"
              size="icon"
              className="mt-0.5 h-[34px] w-[34px] flex-shrink-0 rounded-lg"
              onClick={() => navigate("/dashboard/patients")}
              aria-label="Back to patients"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent font-display text-base font-semibold text-accent-foreground">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-foreground">
                  {patient.name}
                </h1>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success">
                  Current
                </span>
              </div>
              {patient.healthcare_id && <p className="mt-0.5 font-mono text-xs text-primary">{patient.healthcare_id}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
                {patient.phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>
                )}
                {patient.dob && <span>· {getAge(patient.dob)}y</span>}
                {patient.gender && <span className="capitalize">· {patient.gender}</span>}
                {patient.blood_group && <Badge variant="outline" className="ml-1 text-xs">{patient.blood_group}</Badge>}
                {patient.email && (
                  <span className="flex items-center gap-1">· <Mail className="h-3 w-3" />{patient.email}</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {patient.allergies && Array.isArray(patient.allergies) && (patient.allergies as string[]).map((a: string) => (
                  <Badge key={a} variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-xs">
                    <AlertTriangle className="mr-1 h-3 w-3" /> {a}
                  </Badge>
                ))}
                {patient.chronic_conditions && Array.isArray(patient.chronic_conditions) && (patient.chronic_conditions as string[]).map((c: string) => (
                  <Badge key={c} variant="outline" className="border-warning/30 bg-warning-soft text-warning text-xs">
                    <Activity className="mr-1 h-3 w-3" /> {c}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" className="rounded-lg" onClick={() => navigate(`/availability?patient=${patient.id}&book=1`)}>
              <Calendar className="mr-2 h-4 w-4" /> Add Appointment
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={handleSendFormLink} disabled={sendingLink}>
              {sendingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              Send Form Link
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab strip */}
      <div className="mb-4 flex gap-5 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 pb-2 text-[13.5px] transition-colors",
              activeTab === t.key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {activeTab === "general" && (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <div className="space-y-4">
            <Card className="rounded-xl border-border shadow-none">
              <CardContent className="p-3.5">
                <h3 className="mb-3.5 font-display text-sm font-semibold text-foreground">Contact details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InfoRow label="Phone" value={patient.phone ?? "—"} />
                  <InfoRow label="Email" value={patient.email ?? "—"} />
                  <InfoRow label="Date of birth" value={patient.dob ?? "—"} />
                  <InfoRow label="Gender" value={patient.gender ? <span className="capitalize">{patient.gender}</span> : "—"} />
                  <InfoRow label="Blood group" value={patient.blood_group ?? "—"} />
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-border shadow-none">
              <CardContent className="p-3.5 space-y-2">
                <h3 className="mb-2.5 font-display text-sm font-semibold text-foreground">Lifestyle & Habits</h3>
                {patient.food_habits ? <p className="text-sm flex items-center gap-2"><Coffee className="h-3.5 w-3.5 text-muted-foreground" /> <span className="text-muted-foreground">Diet:</span> <span className="capitalize">{patient.food_habits}</span></p> : null}
                {patient.smoking ? <p className="text-sm flex items-center gap-2"><Cigarette className="h-3.5 w-3.5 text-muted-foreground" /> <span className="text-muted-foreground">Smoking:</span> <span className="capitalize">{patient.smoking}</span></p> : null}
                {patient.alcohol ? <p className="text-sm flex items-center gap-2"><Wine className="h-3.5 w-3.5 text-muted-foreground" /> <span className="text-muted-foreground">Alcohol:</span> <span className="capitalize">{patient.alcohol}</span></p> : null}
                {patient.sleep_hours != null ? <p className="text-sm flex items-center gap-2"><Moon className="h-3.5 w-3.5 text-muted-foreground" /> <span className="text-muted-foreground">Sleep:</span> {patient.sleep_hours}h / night</p> : null}
                {patient.dinner_time ? <p className="text-sm flex items-center gap-2"><Utensils className="h-3.5 w-3.5 text-muted-foreground" /> <span className="text-muted-foreground">Dinner:</span> {String(patient.dinner_time).substring(0, 5)}</p> : null}
                {!patient.food_habits && !patient.smoking && !patient.alcohol && patient.sleep_hours == null && !patient.dinner_time && (
                  <p className="text-sm text-muted-foreground italic">No lifestyle info recorded. Use "Send Form Link" to ask the patient.</p>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-xl border-border shadow-none">
              <CardContent className="p-3.5 space-y-2">
                <h3 className="mb-2.5 font-display text-sm font-semibold text-foreground">Medical History</h3>
                {patient.medication_history ? <div className="text-sm"><div className="flex items-center gap-2 text-muted-foreground mb-0.5"><Pill className="h-3.5 w-3.5" /> Current medication</div><p>{patient.medication_history}</p></div> : null}
                {patient.past_surgery_details ? <div className="text-sm"><div className="flex items-center gap-2 text-muted-foreground mb-0.5"><Scissors className="h-3.5 w-3.5" /> Past surgery</div><p>{patient.past_surgery_details}</p></div> : null}
                {Array.isArray(patient.allergies) && patient.allergies.length > 0 ? <div className="text-sm"><div className="flex items-center gap-2 text-muted-foreground mb-0.5"><AlertTriangle className="h-3.5 w-3.5" /> Allergies</div><p>{patient.allergies.join(", ")}</p></div> : null}
                {Array.isArray(patient.chronic_conditions) && patient.chronic_conditions.length > 0 ? <div className="text-sm"><div className="flex items-center gap-2 text-muted-foreground mb-0.5"><ClipboardList className="h-3.5 w-3.5" /> Chronic</div><p>{patient.chronic_conditions.join(", ")}</p></div> : null}
                {!patient.medication_history && !patient.past_surgery_details && !(Array.isArray(patient.allergies) && patient.allergies.length) && !(Array.isArray(patient.chronic_conditions) && patient.chronic_conditions.length) && (
                  <p className="text-sm text-muted-foreground italic">No medical history recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            {patientId && profile?.clinic_id && (
              <PatientDocumentsCard patientId={patientId} clinicId={profile.clinic_id} />
            )}
          </div>
        </div>
      )}

      {/* Clinical notes tab */}
      {activeTab === "clinical" && (
        <Card className="rounded-xl border-border shadow-none">
          <CardContent className="p-3.5">
            <h3 className="mb-3.5 font-display text-sm font-semibold text-foreground">Clinical notes</h3>
            {visits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground/20" />
                <h3 className="font-display text-lg font-semibold text-muted-foreground">No Visits</h3>
                <p className="text-sm text-muted-foreground">No visit history for this patient yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{visits.length} visit{visits.length !== 1 ? "s" : ""}</p>
                {visits.map(visit => {
                  const note = visit.clinical_notes?.[0];
                  const soap = note?.soap_notes;
                  const prescription = visit.prescriptions?.[0];
                  const meds = prescription?.medications;
                  const prescriptionId = prescription?.id;
                  const lastEdited = note?.updated_at || prescription?.updated_at;

                  const displayField = soap?.assessment || soap?.diagnosis || soap?.admission_diagnosis || soap?.current_status;

                  const canEditThis = canEdit && doctor?.id && (
                    (note && note.doctor_id === doctor.id) ||
                    (prescription && prescription.doctor_id === doctor.id)
                  );

                  return (
                    <Card key={visit.id} className="rounded-xl border-border shadow-none">
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
                          <Badge variant="outline" className="text-[10px] capitalize">{visit.status}</Badge>
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
                                  <FileText className="mr-1 h-3 w-3" /> Full Notes <ChevronDown className="ml-1 h-3 w-3" />
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
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoices tab */}
      {activeTab === "invoices" && patientId && profile?.clinic_id && (
        <Card className="rounded-xl border-border shadow-none">
          <CardContent className="p-3.5">
            <h3 className="mb-3.5 font-display text-sm font-semibold text-foreground">Invoices</h3>
            <PatientInvoicesTab patientId={patientId} clinicId={profile.clinic_id} />
          </CardContent>
        </Card>
      )}

      {/* Appointments tab */}
      {activeTab === "appointments" && (
        <Card className="rounded-xl border-border shadow-none">
          <CardContent className="p-3.5">
            <h3 className="mb-3.5 font-display text-sm font-semibold text-foreground">Appointments</h3>
            {visits.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-6 text-center">No appointments recorded yet</p>
            ) : (
              <div>
                {visits.map((visit) => (
                  <div key={visit.id} className="flex items-center justify-between py-2.5 border-b last:border-b-0">
                    <div>
                      <div className="text-sm font-medium text-foreground">{visit.visit_date}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {visit.chief_complaint || "Visit"}{visit.doctors?.name ? ` · Dr. ${visit.doctors.name}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{visit.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Treatment tab */}
      {activeTab === "treatment" && (
        <Card className="rounded-xl border-border shadow-none">
          <CardContent className="p-3.5">
            <h3 className="mb-3.5 font-display text-sm font-semibold text-foreground">Treatment</h3>
            {patientId && <VitalsTrends patientId={patientId} />}
          </CardContent>
        </Card>
      )}

      {/* Edit Visit Sheet */}
      <EditVisitSheet
        open={!!editingVisit}
        onClose={() => setEditingVisit(null)}
        visit={editingVisit}
        onSaved={() => fetchData()}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Patient Record
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete <strong className="text-foreground">{patient.name}</strong> ({patient.healthcare_id})?
          </p>
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 mt-1 border border-destructive/20">
            ⚠️ This will permanently delete all visits, clinical notes, prescriptions, and documents for this patient. This cannot be undone.
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDeletePatient}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
