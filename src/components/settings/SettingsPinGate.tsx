import { useCallback, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const UNLOCK_KEY = "settings_pin_unlocked_at";
const UNLOCK_TTL_MS = 60 * 60 * 1000; // 60 minutes

export function isSettingsUnlocked() {
  try {
    const at = Number(sessionStorage.getItem(UNLOCK_KEY) || 0);
    return at > 0 && Date.now() - at < UNLOCK_TTL_MS;
  } catch {
    return false;
  }
}

export function lockSettings() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

type Status = { allowed: boolean; is_set: boolean; role?: string } | null;

/** Requires a doctor/admin role plus the clinic settings PIN before rendering children. */
export default function SettingsPinGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(isSettingsUnlocked());
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any).rpc("clinic_settings_pin_status");
      if (error) throw error;
      setStatus(data as Status);
    } catch {
      setStatus({ allowed: false, is_set: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unlock = async () => {
    if (!/^\d{4,6}$/.test(pin)) return toast.error("Enter your 4-6 digit PIN");
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("verify_clinic_settings_pin", { p_pin: pin });
      if (error) throw error;
      if (!data?.ok) return toast.error(data?.error || "Incorrect PIN");
      sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
      setUnlocked(true);
      setPin("");
    } catch (e: any) {
      toast.error(e.message || "Could not verify PIN");
    } finally {
      setBusy(false);
    }
  };

  const createPin = async () => {
    if (!/^\d{4,6}$/.test(pin)) return toast.error("PIN must be 4-6 digits");
    if (pin !== confirmPin) return toast.error("PINs do not match");
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("set_clinic_settings_pin", {
        p_current_pin: null,
        p_new_pin: pin,
      });
      if (error) throw error;
      if (!data?.ok) return toast.error(data?.error || "Could not set PIN");
      sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
      toast.success("Settings PIN created");
      setPin("");
      setConfirmPin("");
      setUnlocked(true);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not set PIN");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.allowed) {
    return (
      <div className="flex justify-center py-16 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <CardTitle className="text-base">Settings are restricted</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Only doctors and clinic admins can open Settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  const firstTime = !status.is_set;

  return (
    <div className="flex justify-center py-16 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Lock className="h-8 w-8 text-primary" />
          <CardTitle className="text-base">
            {firstTime ? "Create your Settings PIN" : "Enter Settings PIN"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            {firstTime
              ? "Set a 4-6 digit PIN. Doctors and admins will need it to open Settings."
              : "Settings are protected. Enter the clinic PIN to continue."}
          </p>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !firstTime) unlock();
            }}
            className="text-center tracking-[0.4em]"
          />
          {firstTime && (
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              className="text-center tracking-[0.4em]"
            />
          )}
          <Button className="w-full" disabled={busy} onClick={firstTime ? createPin : unlock}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {firstTime ? "Create PIN" : "Unlock Settings"}
          </Button>
          {!firstTime && (
            <p className="text-center text-xs text-muted-foreground">
              Forgot the PIN? Ask your super admin to reset it.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
