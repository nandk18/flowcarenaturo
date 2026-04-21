import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { FlaskConical, FileText, AlertCircle, ExternalLink, Loader2, ArrowRight, MessageCircle, CheckCircle } from "lucide-react";
import LabResultActionPanel from "@/components/doctor/LabResultActionPanel";
import { useClinic } from "@/hooks/useClinic";

type LabResult = {
  id: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  ai_summary: any;
  status: "pending_review" | "reviewed" | "actioned";
  uploaded_at: string;
  reviewed_at: string | null;
  patient_id: string;
  patient: { name: string; healthcare_id: string | null; phone: string | null; email: string | null } | null;
  order: { test_name: string; test_category: string | null; visit_id: string | null } | null;
  lab: { name: string } | null;
};

const statusBadgeClass = (status?: string) => {
  switch (status) {
    case "critical": return "bg-destructive/10 text-destructive border-destructive/20";
    case "abnormal": return "bg-warning/10 text-warning border-warning/20";
    case "borderline": return "bg-warning/10 text-warning border-warning/20";
    case "normal": return "bg-success/10 text-success border-success/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

type PendingOrder = {
  id: string;
  test_name: string;
  test_category: string | null;
  urgency: string | null;
  status: string | null;
  ordered_at: string | null;
  patient: { name: string; healthcare_id: string | null } | null;
  lab: { name: string } | null;
};

export default function LabResultsInbox() {
  const { profile } = useAuth();
  const { clinic, doctor } = useClinic();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"pending_orders" | "pending_review" | "reviewed" | "actioned" | "all">("pending_review");
  const [results, setResults] = useState<LabResult[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<LabResult | null>(null);
  const [actionTarget, setActionTarget] = useState<LabResult | null>(null);

  const fetchResults = async () => {
    if (!profile?.clinic_id) return;
    setLoading(true);
    let query = supabase
      .from("lab_results")
      .select(`
        id, file_url, file_name, file_type, ai_summary, status, uploaded_at, reviewed_at, patient_id,
        patients(name, healthcare_id, phone, email),
        lab_orders(test_name, test_category, visit_id),
        labs(name)
      `)
      .eq("clinic_id", profile.clinic_id)
      .order("uploaded_at", { ascending: false });

    if (tab === "pending_review" || tab === "reviewed" || tab === "actioned") query = query.eq("status", tab);

    const { data, error } = await query;
    if (!error && data) {
      setResults(data.map((r: any) => ({
        ...r,
        patient: Array.isArray(r.patients) ? r.patients[0] : r.patients,
        order: Array.isArray(r.lab_orders) ? r.lab_orders[0] : r.lab_orders,
        lab: Array.isArray(r.labs) ? r.labs[0] : r.labs,
      })));
    }
    setLoading(false);
  };

  const fetchPendingOrders = async () => {
    if (!profile?.clinic_id) return;
    const { data } = await supabase
      .from("lab_orders")
      .select("id, test_name, test_category, urgency, status, ordered_at, patients(name, healthcare_id), labs(name)")
      .eq("clinic_id", profile.clinic_id)
      .eq("status", "ordered")
      .order("ordered_at", { ascending: false });
    setPendingOrders((data || []).map((o: any) => ({
      ...o,
      patient: Array.isArray(o.patients) ? o.patients[0] : o.patients,
      lab: Array.isArray(o.labs) ? o.labs[0] : o.labs,
    })));
  };

  useEffect(() => {
    if (tab === "pending_orders") {
      fetchPendingOrders();
      setLoading(false);
    } else {
      fetchResults();
    }
  }, [profile, tab]);

  // Realtime
  useEffect(() => {
    if (!profile?.clinic_id) return;
    const channel = supabase.channel("lab-results-" + profile.clinic_id)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "lab_results", filter: `clinic_id=eq.${profile.clinic_id}` },
        () => { fetchResults(); fetchPendingOrders(); })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "lab_orders", filter: `clinic_id=eq.${profile.clinic_id}` },
        () => fetchPendingOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.clinic_id, tab]);

  const handleViewDocument = async (result: LabResult) => {
    if (!result.file_url) return;
    const { data } = await supabase.storage.from("lab-results").createSignedUrl(result.file_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleMarkReviewed = async (id: string, currentStatus: string) => {
    // Status flow is forward-only: pending_review → reviewed → actioned
    if (currentStatus === "actioned" || currentStatus === "reviewed") return;
    const { error } = await supabase
      .from("lab_results")
      .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending_review"); // safety guard
    if (error) { toast.error("Failed to mark as reviewed"); return; }
    toast.success("Marked as reviewed");
    setResults(prev => prev.map(r => r.id === id ? { ...r, status: "reviewed" as const } : r));
    setExpanded(prev => prev && prev.id === id ? { ...prev, status: "reviewed" } : prev);
  };

  const handleWhatsApp = (result: LabResult) => {
    if (!result.patient?.phone) { toast.error("Patient has no phone number"); return; }
    const summary = result.ai_summary?.one_line_summary || "Your lab result is ready.";
    const text = `Hello ${result.patient.name}, your ${result.order?.test_name || "lab"} result is ready. ${summary}`;
    window.open(`https://wa.me/${result.patient.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleActOnResult = (result: LabResult) => {
    setActionTarget(result);
  };

  const handleCancelOrder = async (orderId: string) => {
    const { error } = await supabase
      .from("lab_orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);
    if (error) { toast.error("Failed to cancel order"); return; }
    toast.success("Lab order cancelled");
    fetchPendingOrders();
  };

  const pendingCount = results.filter(r => r.status === "pending_review").length;

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Lab Results</h1>
          <p className="text-sm text-muted-foreground">Review and act on incoming lab results</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList className="rounded-xl flex-wrap h-auto">
          <TabsTrigger value="pending_orders" className="rounded-lg">
            Pending Orders {pendingOrders.length > 0 && <Badge variant="secondary" className="ml-2 h-5 text-xs">{pendingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pending_review" className="rounded-lg">
            Pending Review {pendingCount > 0 && <Badge className="ml-2 h-5 text-xs">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="rounded-lg">Reviewed</TabsTrigger>
          <TabsTrigger value="actioned" className="rounded-lg">Actioned</TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg">All Results</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : tab === "pending_orders" ? (
            pendingOrders.length === 0 ? (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  <FlaskConical className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="font-display font-semibold text-muted-foreground">No pending orders</p>
                  <p className="text-xs text-muted-foreground mt-1">Orders awaiting lab upload will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              pendingOrders.map(o => (
                <Card key={o.id} className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-semibold text-foreground">{o.test_name}</h3>
                        {o.test_category && <Badge variant="outline" className="rounded-md text-xs">{o.test_category}</Badge>}
                        {o.urgency && o.urgency !== "routine" && (
                          <Badge variant={o.urgency === "stat" ? "destructive" : "secondary"} className="rounded-md text-xs uppercase">{o.urgency}</Badge>
                        )}
                        <Badge variant="outline" className="rounded-md text-xs bg-warning/10 text-warning border-warning/20">Awaiting upload</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {o.ordered_at && new Date(o.ordered_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Patient: <span className="font-medium text-foreground">{o.patient?.name}</span>
                      {o.patient?.healthcare_id && <span className="font-mono text-primary"> · {o.patient.healthcare_id}</span>}
                      {o.lab?.name ? <span> · sent to {o.lab.name}</span> : <span> · no lab assigned</span>}
                    </p>
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => handleCancelOrder(o.id)} className="rounded-lg text-xs text-destructive hover:text-destructive">
                        Cancel Order
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )
          ) : results.length === 0 ? (
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <FlaskConical className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-display font-semibold text-muted-foreground">No results to show</p>
              </CardContent>
            </Card>
          ) : (
            results.map(r => {
              const isPending = r.status === "pending_review";
              const isReviewed = r.status === "reviewed";
              const isActioned = r.status === "actioned";
              const reviewBadgeClass =
                isActioned ? "bg-purple-500/10 text-purple-600 border-purple-500/20" :
                isReviewed ? "bg-success/10 text-success border-success/20" :
                "bg-warning/10 text-warning border-warning/20";
              const reviewBadgeLabel = isActioned ? "Actioned" : isReviewed ? "Reviewed" : "Pending Review";

              return (
                <Card key={r.id} className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.ai_summary?.urgent && <AlertCircle className="h-4 w-4 text-destructive" fill="currentColor" />}
                        <h3 className="font-display font-semibold text-foreground">{r.order?.test_name || "Lab Result"}</h3>
                        <Badge variant="outline" className={`rounded-md text-xs ${statusBadgeClass(r.ai_summary?.overall_status)}`}>
                          {r.ai_summary?.overall_status || "Pending AI"}
                        </Badge>
                        <Badge variant="outline" className={`rounded-md text-xs ${reviewBadgeClass}`}>
                          {reviewBadgeLabel}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(r.uploaded_at).toLocaleString()}</span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      Patient: <span className="font-medium text-foreground">{r.patient?.name}</span>
                      {r.patient?.healthcare_id && <span className="font-mono text-primary"> · {r.patient.healthcare_id}</span>}
                      {r.lab?.name && <span> · from {r.lab.name}</span>}
                    </p>

                    {r.ai_summary?.one_line_summary && (
                      <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 mb-3">
                        <p className="text-sm text-foreground">
                          <span className="text-xs text-primary font-semibold mr-1">AI</span>
                          {r.ai_summary.one_line_summary}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setExpanded(r)} className="rounded-lg text-xs">
                        <FileText className="mr-1 h-3 w-3" /> Full Summary
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleViewDocument(r)} className="rounded-lg text-xs">
                        <ExternalLink className="mr-1 h-3 w-3" /> View Document
                      </Button>
                      {isActioned ? (
                        <Button size="sm" variant="outline" disabled className="rounded-lg text-xs opacity-60 cursor-not-allowed">
                          <CheckCircle className="mr-1 h-3 w-3" /> Actioned
                        </Button>
                      ) : (
                        <div className="relative group">
                          <Button
                            size="sm"
                            onClick={() => isReviewed && handleActOnResult(r)}
                            disabled={!isReviewed}
                            className={`rounded-lg text-xs ${!isReviewed ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            Act on Result <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                          {isPending && (
                            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground text-background text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Review the result first
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!expanded} onOpenChange={o => !o && setExpanded(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">{expanded?.order?.test_name || "Lab Result"}</SheetTitle>
          </SheetHeader>

          {expanded && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Badge className={`rounded-md ${statusBadgeClass(expanded.ai_summary?.overall_status)}`}>
                  {expanded.ai_summary?.overall_status?.toUpperCase() || "PENDING AI"}
                </Badge>
                {expanded.ai_summary?.urgent && (
                  <Badge variant="destructive" className="rounded-md">URGENT</Badge>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="font-medium">{expanded.patient?.name} · {expanded.patient?.healthcare_id}</p>
              </div>

              {expanded.ai_summary?.one_line_summary && (
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <p className="text-xs text-primary font-semibold mb-1">SUMMARY</p>
                  <p className="text-sm text-foreground">{expanded.ai_summary.one_line_summary}</p>
                </div>
              )}

              {expanded.ai_summary?.key_findings?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">KEY FINDINGS</p>
                  <ul className="space-y-1 text-sm text-foreground list-disc list-inside">
                    {expanded.ai_summary.key_findings.map((f: string, i: number) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}

              {expanded.ai_summary?.abnormal_values?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">ABNORMAL VALUES</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Parameter</th>
                          <th className="text-left px-3 py-2 font-semibold">Value</th>
                          <th className="text-left px-3 py-2 font-semibold">Normal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expanded.ai_summary.abnormal_values.map((v: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{v.parameter}</td>
                            <td className="px-3 py-2 font-semibold text-destructive">{v.value}</td>
                            <td className="px-3 py-2 text-muted-foreground">{v.normal_range}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {expanded.ai_summary?.clinical_interpretation && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">INTERPRETATION</p>
                  <p className="text-sm text-foreground">{expanded.ai_summary.clinical_interpretation}</p>
                </div>
              )}

              {expanded.ai_summary?.suggested_actions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">SUGGESTED ACTIONS</p>
                  <ul className="space-y-1 text-sm text-foreground list-disc list-inside">
                    {expanded.ai_summary.suggested_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => handleViewDocument(expanded)} className="rounded-lg">
                  <ExternalLink className="mr-2 h-4 w-4" /> View Raw Document
                </Button>
                {expanded.patient?.phone && (
                  <Button variant="outline" onClick={() => handleWhatsApp(expanded)} className="rounded-lg">
                    <MessageCircle className="mr-2 h-4 w-4" /> Send WhatsApp to Patient
                  </Button>
                )}
                {expanded.status === "pending_review" && (
                  <Button onClick={() => handleMarkReviewed(expanded.id, expanded.status)} className="rounded-lg">
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark as Reviewed
                  </Button>
                )}
                {expanded.status === "reviewed" && (
                  <Button variant="outline" disabled className="rounded-lg bg-success/10 text-success border-success/20">
                    <CheckCircle className="mr-2 h-4 w-4" /> Reviewed ✓
                  </Button>
                )}
                {expanded.status === "reviewed" && (
                  <Button onClick={() => { setExpanded(null); handleActOnResult(expanded); }} className="rounded-lg">
                    Act on Result <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <LabResultActionPanel
        open={!!actionTarget}
        onClose={() => setActionTarget(null)}
        result={actionTarget}
        doctorId={doctor?.id || null}
        doctorName={doctor?.name || profile?.full_name || ""}
        clinicName={clinic?.name || ""}
        onActioned={() => fetchResults()}
      />
    </DashboardLayout>
  );
}
