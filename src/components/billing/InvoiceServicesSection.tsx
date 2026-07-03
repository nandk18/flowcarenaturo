import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { useClinic } from "@/hooks/useClinic";

type ServiceRow = {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  amount: number;
  gst_percentage: number | null;
  is_default: boolean | null;
  is_active: boolean | null;
  service_type: string | null;
  max_per_day: number | null;
  requires_therapist: boolean | null;
  room_required: string | null;
  duration_minutes: number | null;
};

export default function InvoiceServicesSection() {
  const { clinic } = useClinic();
  const clinicId = clinic?.id;
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("invoice_services")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    setRows((data ?? []) as ServiceRow[]);
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (row: ServiceRow) => {
    const { error } = await supabase.from("invoice_services").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (row: ServiceRow) => {
    if (row.is_default) return toast.error("Cannot delete the default service");
    if (!confirm(`Delete "${row.name}"?`)) return;
    const { error } = await supabase.from("invoice_services").delete().eq("id", row.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  if (!clinicId) return null;

  return (
    <Card className="rounded-2xl border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 font-display">
          <Receipt className="h-5 w-5 text-primary" /> Invoice Services
        </CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Service
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          The default service is auto-billed when an appointment is booked. If no default is set, the first active service is used.
        </p>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No services yet</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.description || "—"}</TableCell>
                  <TableCell className="text-right">₹{Number(r.amount).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">{Number(r.gst_percentage || 0)}%</TableCell>
                  <TableCell>
                    {r.is_default ? <span className="inline-flex rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase px-2 py-0.5">Default</span> : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell><Switch checked={!!r.is_active} onCheckedChange={() => toggleActive(r)} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setModalOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!r.is_default} onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <ServiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clinicId={clinicId}
        service={editing}
        onSaved={load}
      />
    </Card>
  );
}

function ServiceModal({
  open, onClose, clinicId, service, onSaved,
}: {
  open: boolean; onClose: () => void; clinicId: string; service: ServiceRow | null; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [gstPct, setGstPct] = useState(0);
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [serviceType, setServiceType] = useState<"consultation" | "treatment" | "other">("consultation");
  const [maxPerDay, setMaxPerDay] = useState<number | "">("");
  const [requiresTherapist, setRequiresTherapist] = useState(false);
  const [roomRequired, setRoomRequired] = useState("");
  const [durationMin, setDurationMin] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setAmount(Number(service?.amount ?? 0));
    setGstPct(Number(service?.gst_percentage ?? 0));
    setIsDefault(!!service?.is_default);
    setIsActive(service ? !!service.is_active : true);
    setServiceType(((service?.service_type as any) ?? "consultation"));
    setMaxPerDay(service?.max_per_day ?? "");
    setRequiresTherapist(!!service?.requires_therapist);
    setRoomRequired(service?.room_required ?? "");
    setDurationMin(service?.duration_minutes ?? "");
  }, [open, service]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (amount <= 0) return toast.error("Amount must be > 0");
    setSaving(true);

    if (isDefault) {
      await supabase.from("invoice_services").update({ is_default: false }).eq("clinic_id", clinicId);
    }

    const payload: any = {
      clinic_id: clinicId,
      name: name.trim(),
      description: description || null,
      amount,
      gst_percentage: gstPct,
      is_default: isDefault,
      is_active: isActive,
      service_type: serviceType,
      max_per_day: maxPerDay === "" ? null : Number(maxPerDay),
      requires_therapist: requiresTherapist,
      room_required: roomRequired.trim() || null,
      duration_minutes: durationMin === "" ? null : Number(durationMin),
    };

    const { error } = service
      ? await supabase.from("invoice_services").update(payload).eq("id", service.id)
      : await supabase.from("invoice_services").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(service ? "Service updated" : "Service added");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{service ? "Edit Service" : "Add Service"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount (₹) *</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            <div><Label>GST %</Label><Input type="number" min={0} max={100} value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} /></div>
          </div>
          <div>
            <Label>Service Type</Label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as any)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="consultation">Consultation</option>
              <option value="treatment">Treatment / Therapy</option>
              <option value="other">Other</option>
            </select>
          </div>
          {serviceType === "treatment" && (
            <div className="space-y-3 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Max per day</Label><Input type="number" min={0} value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value === "" ? "" : Number(e.target.value))} placeholder="unlimited" /></div>
                <div><Label className="text-xs">Duration (min)</Label><Input type="number" min={0} value={durationMin} onChange={(e) => setDurationMin(e.target.value === "" ? "" : Number(e.target.value))} /></div>
              </div>
              <div><Label className="text-xs">Room required</Label><Input value={roomRequired} onChange={(e) => setRoomRequired(e.target.value)} placeholder="e.g. Therapy Room 1" /></div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Requires therapist</Label>
                <Switch checked={requiresTherapist} onCheckedChange={setRequiresTherapist} />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Set as Default</Label>
              <p className="text-xs text-muted-foreground">Used to auto-bill appointments</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
