import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import StatusBadge from "@/components/billing/StatusBadge";
import CreateInvoiceModal from "@/components/billing/CreateInvoiceModal";
import RecordPaymentModal from "@/components/billing/RecordPaymentModal";
import { Eye, Plus, Share2, Receipt, Download } from "lucide-react";
import PatientLink from "@/components/PatientLink";
import { toast } from "sonner";
import { openWhatsApp, buildInvoiceMessage } from "@/lib/whatsapp";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type Status = "all" | "unpaid" | "partial" | "paid" | "cancelled";

export default function BillingPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { clinic } = useClinic();
  const clinicId = profile?.clinic_id || "";
  const role = profile?.role;
  const canWrite = role === "admin";

  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const fetchInvoices = async () => {
    if (!clinicId) return;
    let q = supabase
      .from("invoices")
      .select(`id,clinic_id,invoice_number,invoice_date,line_items,subtotal,gst_percentage,gst_amount,discount_amount,total_amount,paid_amount,outstanding_amount,status,notes,patient_id,pdf_url,pdf_generated_at,updated_at,
        patients(id,name,healthcare_id,phone),
        doctors(id,name),
        visits(id,chief_complaint)`)
      .eq("clinic_id", clinicId)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (dateFrom) q = q.gte("invoice_date", dateFrom);
    if (dateTo) q = q.lte("invoice_date", dateTo);
    if (search) q = q.ilike("invoice_number", `%${search}%`);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    setInvoices(data || []);
  };

  const fetchPayments = async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("payments")
      .select("id,amount,payment_method,payment_date,invoice_id,patient_id")
      .eq("clinic_id", clinicId)
      .order("payment_date", { ascending: false })
      .limit(500);
    setPayments(data || []);
  };

  useEffect(() => { fetchInvoices(); }, [clinicId, statusFilter, dateFrom, dateTo, search]);
  useEffect(() => { fetchPayments(); }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    const ch = supabase
      .channel(`billing-${clinicId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `clinic_id=eq.${clinicId}` }, fetchInvoices)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `clinic_id=eq.${clinicId}` }, () => { fetchPayments(); fetchInvoices(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const todayCollection = useMemo(
    () => payments.filter((p) => p.payment_date === today).reduce((s, p) => s + Number(p.amount), 0),
    [payments, today]
  );
  const totalOutstanding = useMemo(
    () => invoices.filter((i) => i.status !== "cancelled").reduce((s, i) => s + Number(i.outstanding_amount), 0),
    [invoices]
  );
  const todayInvoiceCount = useMemo(() => invoices.filter((i) => i.invoice_date === today).length, [invoices, today]);
  const todayPaidCount = useMemo(
    () => invoices.filter((i) => i.invoice_date === today && i.status === "paid").length,
    [invoices, today]
  );

  const filteredBySearch = useMemo(() => {
    if (!search) return invoices;
    const s = search.toLowerCase();
    return invoices.filter(
      (i) =>
        i.invoice_number?.toLowerCase().includes(s) ||
        i.patients?.name?.toLowerCase().includes(s) ||
        i.patients?.healthcare_id?.toLowerCase().includes(s)
    );
  }, [invoices, search]);

  const shareInvoice = async (invoice: any) => {
    let pdfUrl = "";
    try {
      toast.loading("Preparing invoice PDF…", { id: "share-pdf" });
      const { uploadInvoicePdf } = await import("@/lib/invoicePdf");
      pdfUrl = await uploadInvoicePdf(invoice, clinic);
      toast.success("PDF ready", { id: "share-pdf" });
    } catch (e: any) {
      toast.error(e?.message || "Failed to prepare PDF", { id: "share-pdf" });
      return;
    }
    const phone = invoice.patients?.phone?.replace(/\D/g, "");
    if (!phone) {
      navigator.clipboard.writeText(pdfUrl);
      toast.success("PDF link copied");
      return;
    }
    openWhatsApp(
      invoice.patients?.phone,
      buildInvoiceMessage(
        invoice.patients?.name,
        invoice.invoice_number,
        Number(invoice.total_amount),
        invoice.status,
        invoice.id,
        clinic?.name || "the clinic"
      ).replace(`${window.location.origin}/invoice/${invoice.id}`, pdfUrl)
    );
  };

  const exportBillingReport = () => {
    if (filteredBySearch.length === 0) {
      toast.error("No invoices to export");
      return;
    }
    const rows = [
      ["Invoice #", "Date", "Patient", "Healthcare ID", "Doctor", "Total", "Paid", "Outstanding", "Status"].join(","),
      ...filteredBySearch.map((inv) =>
        [
          inv.invoice_number,
          inv.invoice_date,
          inv.patients?.name || "",
          inv.patients?.healthcare_id || "",
          inv.doctors?.name || "",
          inv.total_amount,
          inv.paid_amount,
          inv.outstanding_amount,
          inv.status,
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    toast.success(`Exported ${filteredBySearch.length} invoices`);
  };

  const summaryCards = [
    { label: "Today's Collection", value: `₹${todayCollection.toLocaleString("en-IN")}`, icon: "💰" },
    { label: "Outstanding", value: `₹${totalOutstanding.toLocaleString("en-IN")}`, icon: "⏳" },
    { label: "Invoices Today", value: todayInvoiceCount, icon: "📄" },
    { label: "Paid Today", value: todayPaidCount, icon: "✅" },
  ];

  // Reports calculations
  const methodBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p) => { map[p.payment_method] = (map[p.payment_method] || 0) + Number(p.amount); });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map).map(([k, v]) => ({ method: k, amount: v, pct: ((v / total) * 100).toFixed(1) }));
  }, [payments]);

  const dailyChart = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach((p) => { map[p.payment_date] = (map[p.payment_date] || 0) + Number(p.amount); });
    return Object.entries(map)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [payments]);

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalCollected = invoices.reduce((s, i) => s + Number(i.paid_amount), 0);
  const collectionRate = totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : "0";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Billing</h1>
            <p className="text-sm text-muted-foreground">Invoices, payments & daily reports</p>
          </div>
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Invoice
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCards.map((c) => (
            <Card key={c.label} className="p-4">
              <div className="text-2xl">{c.icon}</div>
              <div className="mt-2 text-xs text-muted-foreground">{c.label}</div>
              <div className="text-xl font-bold">{c.value}</div>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all" onClick={() => setStatusFilter("all")}>All</TabsTrigger>
            <TabsTrigger value="unpaid" onClick={() => setStatusFilter("unpaid")}>Unpaid</TabsTrigger>
            <TabsTrigger value="partial" onClick={() => setStatusFilter("partial")}>Partial</TabsTrigger>
            <TabsTrigger value="paid" onClick={() => setStatusFilter("paid")}>Paid</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {["all", "unpaid", "partial", "paid"].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs">Search</Label>
                  <Input placeholder="Invoice # / patient / ID" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
                </div>
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={exportBillingReport}>
                  <Download className="w-3 h-3 mr-1" /> Export CSV
                </Button>
              </div>

              {filteredBySearch.length === 0 ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No invoices found
                </Card>
              ) : (
                filteredBySearch.map((inv) => (
                  <Card key={inv.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">{inv.invoice_number}</span>
                          <StatusBadge status={inv.status} />
                        </div>
                        {inv.patients && <PatientLink patientId={inv.patients.id}>{inv.patients.name}</PatientLink>}
                        <p className="text-xs text-primary">{inv.patients?.healthcare_id}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {inv.doctors?.name || "—"} · {new Date(inv.invoice_date).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">₹{Number(inv.total_amount).toLocaleString("en-IN")}</p>
                        {Number(inv.outstanding_amount) > 0 && (
                          <p className="text-xs text-destructive">₹{Number(inv.outstanding_amount).toLocaleString("en-IN")} pending</p>
                        )}
                        {Number(inv.paid_amount) > 0 && (
                          <p className="text-xs text-green-600">₹{Number(inv.paid_amount).toLocaleString("en-IN")} paid</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/billing/${inv.id}`)}>
                        <Eye className="w-3 h-3 mr-1" /> View
                      </Button>
                      {inv.status !== "paid" && inv.status !== "cancelled" && canWrite && (
                        <Button size="sm" onClick={() => setPaymentInvoice(inv)}>
                          <Plus className="w-3 h-3 mr-1" /> Record Payment
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => shareInvoice(inv)}>
                        <Share2 className="w-3 h-3 mr-1" /> Share
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}

          <TabsContent value="reports" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Card className="p-4"><div className="text-xs text-muted-foreground">Total Invoiced</div><div className="text-xl font-bold">₹{totalInvoiced.toLocaleString("en-IN")}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Total Collected</div><div className="text-xl font-bold">₹{totalCollected.toLocaleString("en-IN")}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-xl font-bold">₹{totalOutstanding.toLocaleString("en-IN")}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Collection Rate</div><div className="text-xl font-bold">{collectionRate}%</div></Card>
            </div>

            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Daily Collection (last 30 days)</h3>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <LineChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Payment Method Breakdown</h3>
              <div className="space-y-2 text-sm">
                {methodBreakdown.length === 0 && <p className="text-muted-foreground text-xs">No payments yet</p>}
                {methodBreakdown.map((m) => (
                  <div key={m.method} className="flex justify-between">
                    <span className="capitalize">{m.method}</span>
                    <span>₹{m.amount.toLocaleString("en-IN")} <span className="text-muted-foreground text-xs">({m.pct}%)</span></span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">Outstanding Patients</h3>
                <Button size="sm" variant="outline" onClick={exportBillingReport}>
                  <Download className="w-3 h-3 mr-1" /> Export CSV
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                {invoices.filter((i) => Number(i.outstanding_amount) > 0).slice(0, 20).map((i) => (
                  <div key={i.id} className="flex justify-between border-b pb-1">
                    <div>
                      {i.patients && <PatientLink patientId={i.patients.id}>{i.patients.name}</PatientLink>}
                      <p className="text-xs text-muted-foreground font-mono">{i.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-destructive font-semibold">₹{Number(i.outstanding_amount).toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.max(0, Math.floor((Date.now() - new Date(i.invoice_date).getTime()) / 86400000))} days
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <CreateInvoiceModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={fetchInvoices}
          clinicId={clinicId}
          clinicGstPercentage={Number((clinic as any)?.gst_percentage) || 0}
        />
        <RecordPaymentModal
          open={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onRecorded={() => { fetchInvoices(); fetchPayments(); }}
          invoice={paymentInvoice}
        />
      </div>
    </DashboardLayout>
  );
}