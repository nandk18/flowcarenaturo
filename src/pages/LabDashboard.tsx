import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FlaskConical, Upload, LogOut, Loader2, FileText, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { withRetry } from "@/lib/errors";

type LabOrder = {
  id: string;
  test_name: string;
  test_category: string | null;
  clinical_notes: string | null;
  urgency: "routine" | "urgent" | "stat";
  status: string;
  ordered_at: string;
  patient: { name: string; healthcare_id: string | null } | null;
  doctor: { name: string } | null;
  clinic: { name: string } | null;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
};

const urgencyClass: Record<string, string> = {
  routine: "bg-muted text-foreground",
  urgent: "bg-warning/10 text-warning",
  stat: "bg-destructive/10 text-destructive",
};

export default function LabDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<LabOrder | null>(null);
  const [labName, setLabName] = useState("");

  useEffect(() => {
    if (profile?.lab_id) {
      supabase.from("labs").select("name").eq("id", profile.lab_id).single()
        .then(({ data }) => setLabName(data?.name || "Lab"));
    }
  }, [profile]);

  const fetchOrders = async () => {
    if (!profile?.lab_id) return;
    setLoading(true);
    const statusFilter = tab === "pending"
      ? ["ordered", "received", "processing"]
      : ["completed"];

    const { data, error } = await supabase
      .from("lab_orders")
      .select(`
        id, test_name, test_category, clinical_notes, urgency, status, ordered_at,
        clinic_id, patient_id, doctor_id,
        patients(name, healthcare_id),
        doctors(name),
        clinics(name)
      `)
      .eq("lab_id", profile.lab_id)
      .in("status", statusFilter)
      .order("ordered_at", { ascending: false });

    if (!error && data) {
      setOrders(data.map((o: any) => ({
        ...o,
        patient: Array.isArray(o.patients) ? o.patients[0] : o.patients,
        doctor: Array.isArray(o.doctors) ? o.doctors[0] : o.doctors,
        clinic: Array.isArray(o.clinics) ? o.clinics[0] : o.clinics,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [profile, tab]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.lab_id) return;
    const channel = supabase
      .channel("lab-orders-" + profile.lab_id)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "lab_orders", filter: `lab_id=eq.${profile.lab_id}` },
        () => fetchOrders()
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.lab_id, tab]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground">{labName}</h1>
              <p className="text-xs text-muted-foreground">Lab Portal · {profile?.full_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="pending" className="rounded-lg">
              Pending Orders {orders.length > 0 && tab === "pending" && (
                <Badge variant="default" className="ml-2 h-5 text-xs">{orders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="space-y-3 mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : orders.length === 0 ? (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  {tab === "pending" ? <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" /> : <CheckCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />}
                  <p className="font-display font-semibold text-muted-foreground">
                    {tab === "pending" ? "No pending orders" : "No completed orders yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              orders.map(o => (
                <Card key={o.id} className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-display font-semibold text-foreground">{o.patient?.name}</h3>
                        {o.patient?.healthcare_id && (
                          <p className="font-mono text-xs text-primary">{o.patient.healthcare_id}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`rounded-md ${urgencyClass[o.urgency] || ""}`}>
                          {o.urgency === "stat" && <AlertTriangle className="mr-1 h-3 w-3" />}
                          {o.urgency.toUpperCase()}
                        </Badge>
                        {o.test_category && (
                          <Badge variant="outline" className="rounded-md">{o.test_category}</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="font-medium text-foreground">{o.test_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ordered by Dr. {o.doctor?.name} from {o.clinic?.name} · {new Date(o.ordered_at).toLocaleString()}
                      </p>
                    </div>

                    {o.clinical_notes && (
                      <div className="rounded-lg bg-muted/50 p-3 mb-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">CLINICAL NOTES</p>
                        <p className="text-sm text-foreground">{o.clinical_notes}</p>
                      </div>
                    )}

                    {tab === "pending" && (
                      <Button onClick={() => setUploadingFor(o)} className="rounded-lg w-full sm:w-auto">
                        <Upload className="mr-2 h-4 w-4" /> Upload Result
                      </Button>
                    )}
                    {tab === "completed" && (
                      <Badge variant="outline" className="rounded-md text-xs">
                        <CheckCircle className="mr-1 h-3 w-3" /> Result delivered
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <UploadResultDialog
        order={uploadingFor}
        onClose={() => setUploadingFor(null)}
        labId={profile?.lab_id || null}
        onUploaded={() => fetchOrders()}
      />
    </div>
  );
}

function UploadResultDialog({
  order, onClose, labId, onUploaded,
}: { order: LabOrder | null; onClose: () => void; labId: string | null; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!order) { setFile(null); setNotes(""); }
  }, [order]);

  const handleUpload = async () => {
    if (!order || !file || !labId) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File must be under 20MB"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${order.clinic_id}/${order.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("lab-results")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: result, error: insErr } = await supabase
        .from("lab_results")
        .insert({
          lab_order_id: order.id,
          clinic_id: order.clinic_id,
          patient_id: order.patient_id,
          doctor_id: order.doctor_id,
          lab_id: labId,
          file_url: path,
          file_name: file.name,
          file_type: file.type,
          extracted_text: notes || null,
          status: "pending_review",
        })
        .select()
        .single();
      if (insErr) throw insErr;

      await supabase.from("lab_orders").update({ status: "completed" }).eq("id", order.id);

      // Trigger AI summarization (don't block on errors)
      withRetry(() =>
        supabase.functions.invoke("summarize-lab-result", {
          body: {
            lab_result_id: result.id,
            file_path: path,
            file_type: file.type,
            test_name: order.test_name,
            patient_context: order.clinical_notes || "",
          },
        })
      , 3, 1000).catch(e => console.warn("AI summary failed:", e));

      toast.success("Result uploaded. Doctor has been notified.");
      onUploaded();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Upload Result</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">For</p>
            <p className="font-semibold text-foreground">{order?.patient?.name} · {order?.test_name}</p>
          </div>

          <div className="space-y-2">
            <Label>Result File (PDF, JPG, PNG — max 20MB)</Label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/jpg"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm rounded-lg border border-input p-2 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label>Additional Notes (optional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional context for the doctor..."
              className="rounded-lg"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Submit Result"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
