import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SettingsShell from "@/components/layout/SettingsShell";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Receipt, Save, BarChart3, SlidersHorizontal } from "lucide-react";
import PatientLink from "@/components/PatientLink";
import { toast } from "sonner";
import { clientCache, CACHE_KEYS } from "@/lib/clientCache";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export default function BillingConfigPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { clinic, refetch } = useClinic();
  const clinicId = profile?.clinic_id || "";
  const isAdmin = profile?.role === "admin";

  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid" | "partially_paid">("all");

  // Configuration form state
  const [gstNumber, setGstNumber] = useState("");
  const [gstPercentage, setGstPercentage] = useState<number>(0);
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [headerNote, setHeaderNote] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [showLogo, setShowLogo] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!clinic) return;
    setGstNumber((clinic as any).gst_number || "");
    setGstPercentage(Number((clinic as any).gst_percentage) || 0);
    setInvoicePrefix((clinic as any).invoice_prefix || "INV");
    setHeaderNote((clinic as any).invoice_header_note || "");
    setFooterNote((clinic as any).invoice_footer_note || "");
    setShowLogo((clinic as any).show_logo_on_invoice !== false);
  }, [clinic]);

  const fetchInvoices = async () => {
    if (!clinicId) return;
    let q = supabase
      .from("invoices")
      .select(`id,invoice_number,invoice_date,total_amount,paid_amount,outstanding_amount,status,patient_id,
        patients(id,name,healthcare_id)`)
      .eq("clinic_id", clinicId)
      .order("invoice_date", { ascending: false });
    if (dateFrom) q = q.gte("invoice_date", dateFrom);
    if (dateTo) q = q.lte("invoice_date", dateTo);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    setInvoices(data || []);
  };

  const fetchPayments = async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("payments")
      .select("id,amount,payment_method,payment_date")
      .eq("clinic_id", clinicId)
      .order("payment_date", { ascending: false })
      .limit(500);
    setPayments(data || []);
  };

  useEffect(() => { fetchInvoices(); }, [clinicId, dateFrom, dateTo]);
  useEffect(() => { fetchPayments(); }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    const ch = supabase
      .channel(`billing-config-${clinicId}`)
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

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalCollected = invoices.reduce((s, i) => s + Number(i.paid_amount), 0);
  const collectionRate = totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : "0";

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

  const filteredInvoices = useMemo(
    () => (statusFilter === "all" ? invoices : invoices.filter((i) => i.status === statusFilter)),
    [invoices, statusFilter],
  );

  const exportCsv = async () => {
    if (filteredInvoices.length === 0) { toast.error("No invoices to export"); return; }
    // Fetch per-invoice payment breakdown for UPI/Cash columns
    const invoiceIds = filteredInvoices.map((i) => i.id);
    const { data: pays } = await supabase
      .from("payments")
      .select("invoice_id, amount, payment_method")
      .in("invoice_id", invoiceIds);
    const byInv = new Map<string, { upi: number; cash: number }>();
    (pays ?? []).forEach((p: any) => {
      const cur = byInv.get(p.invoice_id) ?? { upi: 0, cash: 0 };
      const m = String(p.payment_method || "").toLowerCase();
      if (m.includes("upi")) cur.upi += Number(p.amount);
      else if (m.includes("cash")) cur.cash += Number(p.amount);
      byInv.set(p.invoice_id, cur);
    });

    let totalUpi = 0;
    let totalCash = 0;
    let grand = 0;

    const dataRows = filteredInvoices.map((inv) => {
      const b = byInv.get(inv.id) ?? { upi: 0, cash: 0 };
      totalUpi += b.upi;
      totalCash += b.cash;
      grand += Number(inv.total_amount);
      return [
        inv.invoice_number, inv.invoice_date,
        inv.patients?.name || "", inv.patients?.healthcare_id || "",
        inv.total_amount, inv.paid_amount, inv.outstanding_amount, inv.status,
        b.upi.toFixed(2), b.cash.toFixed(2),
      ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    });

    const rows = [
      ["Invoice #", "Date", "Patient", "Healthcare ID", "Total", "Paid", "Outstanding", "Status", "UPI", "Cash"].join(","),
      ...dataRows,
      "",
      `"TOTAL UPI","","","","","","","","${totalUpi.toFixed(2)}",""`,
      `"TOTAL CASH","","","","","","","","","${totalCash.toFixed(2)}"`,
      `"GRAND TOTAL","","","","${grand.toFixed(2)}","","","","",""`,
    ].join("\n");
    const blob = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { if (a.parentNode) document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    toast.success(`Exported ${filteredInvoices.length} invoices`);
  };

  const handleSaveConfig = async () => {
    if (!clinicId) return;
    setSavingConfig(true);
    try {
      const { error } = await supabase.from("clinics").update({
        gst_number: gstNumber || null,
        gst_percentage: gstPercentage,
        invoice_prefix: invoicePrefix || "INV",
        invoice_header_note: headerNote || null,
        invoice_footer_note: footerNote || null,
        show_logo_on_invoice: showLogo,
      } as any).eq("id", clinicId);
      if (error) throw error;
      clientCache.delete(CACHE_KEYS.clinicSettings(clinicId));
      toast.success("Invoice configuration saved");
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const summaryCards = [
    { label: "Today's Collection", value: `₹${todayCollection.toLocaleString("en-IN")}`, icon: "💰" },
    { label: "Outstanding", value: `₹${totalOutstanding.toLocaleString("en-IN")}`, icon: "⏳" },
    { label: "Invoices Today", value: todayInvoiceCount, icon: "📄" },
    { label: "Paid Today", value: todayPaidCount, icon: "✅" },
  ];

  return (
    <SettingsShell title="Invoice Analytics">
      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-1" /> Analytics</TabsTrigger>
          <TabsTrigger value="config"><SlidersHorizontal className="w-4 h-4 mr-1" /> Invoice Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summaryCards.map((c) => (
              <Card key={c.label} className="p-4">
                <div className="text-2xl">{c.icon}</div>
                <div className="mt-2 text-xs text-muted-foreground">{c.label}</div>
                <div className="text-xl font-bold">{c.value}</div>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-3 h-3 mr-1" /> Export CSV
            </Button>
          </div>

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
            <h3 className="font-semibold text-sm mb-3">Outstanding Patients</h3>
            <div className="space-y-2 text-sm">
              {invoices.filter((i) => Number(i.outstanding_amount) > 0).length === 0 && (
                <p className="text-muted-foreground text-xs">No outstanding invoices</p>
              )}
              {invoices.filter((i) => Number(i.outstanding_amount) > 0).slice(0, 20).map((i) => (
                <button
                  key={i.id}
                  onClick={() => navigate(`/patients/${i.patients?.id}?tab=invoices`)}
                  className="w-full flex justify-between border-b pb-1 text-left hover:bg-muted/50 px-2 py-1 rounded"
                >
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
                </button>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Receipt className="h-5 w-5 text-primary" /> Invoice Configuration
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Set GST details, invoice numbering, header and footer notes that appear on every invoice PDF.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>GST Number (optional)</Label>
                <Input
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 33AAAAA0000A1ZX"
                  maxLength={15}
                  disabled={!isAdmin}
                />
                <p className="text-xs text-muted-foreground">15-character GSTIN — leave blank if exempt</p>
              </div>

              <div className="space-y-2">
                <Label>Default GST %</Label>
                <Select value={String(gstPercentage)} onValueChange={(v) => setGstPercentage(Number(v))} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% — GST Exempt</SelectItem>
                    <SelectItem value="5">5% GST</SelectItem>
                    <SelectItem value="12">12% GST</SelectItem>
                    <SelectItem value="18">18% GST</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Invoice Number Prefix</Label>
                <Input
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  placeholder="INV"
                  maxLength={6}
                  disabled={!isAdmin}
                />
                <p className="text-xs text-muted-foreground">
                  Invoices will be numbered: {invoicePrefix || "INV"}-{new Date().getFullYear()}-0001
                </p>
              </div>

              <div className="space-y-2">
                <Label>Invoice Header Note (optional)</Label>
                <Textarea
                  value={headerNote}
                  onChange={(e) => setHeaderNote(e.target.value)}
                  placeholder="e.g. Naturopathy & Wellness Clinic · Reg. No. 12345"
                  rows={2}
                  disabled={!isAdmin}
                />
                <p className="text-xs text-muted-foreground">Shown under clinic name at the top of each invoice.</p>
              </div>

              <div className="space-y-2">
                <Label>Invoice Footer Note (optional)</Label>
                <Textarea
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  placeholder="e.g. Payments are non-refundable. For queries call +91 XXXXX."
                  rows={2}
                  disabled={!isAdmin}
                />
                <p className="text-xs text-muted-foreground">Shown above &ldquo;Thank you for visiting&rdquo;.</p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Show clinic logo on invoice</Label>
                  <p className="text-xs text-muted-foreground">Toggle off to hide the logo on PDF/print output.</p>
                </div>
                <Switch checked={showLogo} onCheckedChange={setShowLogo} disabled={!isAdmin} />
              </div>

              <Button onClick={handleSaveConfig} disabled={savingConfig || !isAdmin}>
                <Save className="mr-2 h-4 w-4" /> {savingConfig ? "Saving…" : "Save Configuration"}
              </Button>
              {!isAdmin && <p className="text-xs text-muted-foreground">Only admins can edit invoice configuration.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </SettingsShell>
  );
}
