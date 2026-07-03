import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import { Plus, Pencil, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Therapist = {
  id: string;
  user_id: string;
  full_name: string | null;
  therapist_email: string | null;
  therapist_color: string | null;
  room: string | null;
  is_therapist: boolean | null;
  pin_hash: string | null;
};

const DEFAULT_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

export default function TreatmentTherapists() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const { enabled, loading: flagLoading } = useTreatmentEnabled();
  const [rows, setRows] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Therapist | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pinModalFor, setPinModalFor] = useState<Therapist | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, therapist_email, therapist_color, room, is_therapist, pin_hash")
      .eq("clinic_id", clinicId)
      .eq("is_therapist", true)
      .order("full_name");
    setRows((data as any) ?? []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  if (flagLoading) return <DashboardLayout title="Therapists"><div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div></DashboardLayout>;
  if (!enabled) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout title="Therapists">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Therapists</h2>
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Therapist
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>PIN</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No therapists yet</TableCell></TableRow>
                  ) : rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.therapist_email ?? "—"}</TableCell>
                      <TableCell>{r.room ?? "—"}</TableCell>
                      <TableCell>
                        {r.therapist_color ? <span className="inline-block h-4 w-4 rounded-full" style={{ background: r.therapist_color }} /> : "—"}
                      </TableCell>
                      <TableCell>
                        {r.pin_hash ? <span className="text-xs text-success">Set</span> : <span className="text-xs text-muted-foreground">Not set</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setModalOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPinModalFor(r)}><KeyRound className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <TherapistModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clinicId={clinicId ?? ""}
        therapist={editing}
        onSaved={load}
      />
      <PinModal
        therapist={pinModalFor}
        onClose={() => setPinModalFor(null)}
        onSaved={load}
      />
    </DashboardLayout>
  );
}

function TherapistModal({ open, onClose, clinicId, therapist, onSaved }: {
  open: boolean; onClose: () => void; clinicId: string; therapist: Therapist | null; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(therapist?.full_name ?? "");
    setEmail(therapist?.therapist_email ?? "");
    setRoom(therapist?.room ?? "");
    setColor(therapist?.therapist_color ?? DEFAULT_COLORS[0]);
    setPin("");
  }, [open, therapist]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (!therapist && (!pin || pin.length < 4)) return toast.error("Initial PIN required (4-8 digits)");
    setSaving(true);

    let profileId = therapist?.id;

    if (therapist) {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: name.trim(),
          therapist_email: email.trim() || null,
          room: room.trim() || null,
          therapist_color: color,
          is_therapist: true,
        })
        .eq("id", therapist.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    } else {
      const { data, error } = await supabase.rpc("admin_create_therapist", {
        p_full_name: name.trim(),
        p_email: email.trim() || null,
        p_room: room.trim() || null,
        p_color: color,
        p_pin: pin,
      });
      if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
      profileId = data as string;
    }

    if (therapist && pin && profileId) {
      const { error: pinErr } = await supabase.rpc("admin_set_therapist_pin", {
        p_therapist_profile_id: profileId,
        p_pin: pin,
      });
      if (pinErr) { setSaving(false); return toast.error(`Saved but PIN failed: ${pinErr.message}`); }
    }

    setSaving(false);
    toast.success(therapist ? "Therapist updated" : "Therapist added");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{therapist ? "Edit Therapist" : "Add Therapist"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Room</Label><Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room 1" /></div>
            <div>
              <Label>Color</Label>
              <div className="mt-1 flex gap-1.5">
                {DEFAULT_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          {!therapist && (
            <div>
              <Label>Initial PIN (4-8 digits) *</Label>
              <Input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PinModal({ therapist, onClose, onSaved }: {
  therapist: Therapist | null; onClose: () => void; onSaved: () => void;
}) {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPin(""); }, [therapist]);

  const submit = async () => {
    if (!therapist) return;
    if (pin.length < 4 || pin.length > 8) return toast.error("PIN must be 4-8 digits");
    setSaving(true);
    const { error } = await supabase.rpc("admin_set_therapist_pin", {
      p_therapist_profile_id: therapist.id,
      p_pin: pin,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("PIN updated");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!therapist} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>Change PIN — {therapist?.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>New PIN (4-8 digits)</Label>
          <Input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoFocus />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Update PIN"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
