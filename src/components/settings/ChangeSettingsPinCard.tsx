import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Lets a doctor/admin change the clinic's Settings PIN. */
export default function ChangeSettingsPinCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!/^\d{4,6}$/.test(next)) return toast.error("New PIN must be 4-6 digits");
    if (next !== confirm) return toast.error("PINs do not match");
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("set_clinic_settings_pin", {
        p_current_pin: current || null,
        p_new_pin: next,
      });
      if (error) throw error;
      if (!data?.ok) return toast.error(data?.error || "Could not update PIN");
      toast.success("Settings PIN updated");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e: any) {
      toast.error(e.message || "Could not update PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" /> Settings PIN
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Doctors and admins must enter this PIN to open Settings.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Current PIN</Label>
            <Input type="password" inputMode="numeric" maxLength={6} value={current}
              onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">New PIN</Label>
            <Input type="password" inputMode="numeric" maxLength={6} value={next}
              onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirm new PIN</Label>
            <Input type="password" inputMode="numeric" maxLength={6} value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        <Button size="sm" disabled={busy} onClick={save}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update PIN
        </Button>
      </CardContent>
    </Card>
  );
}
