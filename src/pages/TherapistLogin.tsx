import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTherapistAuth } from "@/hooks/useTherapistAuth";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Delete, LogOut } from "lucide-react";
import { toast } from "sonner";

type Therapist = {
  id: string;
  full_name: string;
  therapist_color: string | null;
  room: string | null;
};

export default function TherapistLogin() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const { enabled, loading: flagLoading } = useTreatmentEnabled();
  const { therapist, signInWithPin, signOut } = useTherapistAuth();
  const navigate = useNavigate();

  const [list, setList] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Therapist | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const { data, error } = await (supabase as any).rpc("list_clinic_therapists", {
        p_clinic_id: clinicId,
      });
      if (error) toast.error(error.message);
      setList((data as Therapist[]) ?? []);
      setLoading(false);
    })();
  }, [clinicId]);

  useEffect(() => {
    if (therapist && !selected) navigate("/treatment/therapist", { replace: true });
  }, [therapist, selected, navigate]);

  const submit = async () => {
    if (!selected || pin.length < 4) return;
    setBusy(true);
    const res = await signInWithPin(selected, pin);
    setBusy(false);
    if (!res.ok) {
      setShake(true);
      setPin("");
      setTimeout(() => setShake(false), 500);
      toast.error(res.error ?? "Wrong PIN");
      return;
    }
    toast.success(`Welcome, ${selected.full_name}`);
    navigate("/treatment/therapist", { replace: true });
  };

  const press = (d: string) => {
    if (busy) return;
    setPin((p) => (d === "del" ? p.slice(0, -1) : p.length >= 8 ? p : p + d));
  };

  useEffect(() => {
    if (selected && pin.length >= 4 && pin.length <= 8) {
      // auto-submit at 4 by default; allow manual submit for longer
      if (pin.length === 4) submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // NOTE: no treatment-enabled gate here — this page must work without an
  // admin Supabase session so therapists can install/open the PWA directly.

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 safe-top safe-bottom safe-x">
      <div className="w-full max-w-md">
        {!selected ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="font-display text-2xl font-semibold">Therapist sign in</h1>
              <p className="text-sm text-muted-foreground">Tap your card to enter your PIN</p>
            </div>
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : list.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                No therapists set up yet. Ask your admin to add one in Treatment → Therapists.
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {list.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelected(t); setPin(""); }}
                    className="rounded-xl border bg-card p-4 text-left shadow-card transition hover:shadow-lg active:scale-[.98]"
                    style={{ borderLeft: `4px solid ${t.therapist_color ?? "hsl(var(--primary))"}` }}
                  >
                    <div className="font-display font-semibold">{t.full_name}</div>
                    <div className="text-xs text-muted-foreground">{t.room ?? "—"}</div>
                  </button>
                ))}
              </div>
            )}
            {therapist && (
              <Button variant="ghost" size="sm" className="mt-6 mx-auto flex" onClick={signOut}>
                <LogOut className="h-3 w-3 mr-1" /> Sign out {therapist.full_name}
              </Button>
            )}
          </>
        ) : (
          <div className={shake ? "animate-[shake_0.5s]" : ""}>
            <div className="mb-4 text-center">
              <div className="text-xs text-muted-foreground">Signing in as</div>
              <div className="font-display text-lg font-semibold">{selected.full_name}</div>
            </div>
            <div className="mb-4 flex justify-center gap-2" aria-label="PIN">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full border ${i < pin.length ? "bg-primary border-primary" : "bg-muted"}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9"].map((d) => (
                <Button key={d} variant="outline" className="h-14 text-xl" onClick={() => press(d)} disabled={busy}>{d}</Button>
              ))}
              <Button variant="ghost" className="h-14" onClick={() => { setSelected(null); setPin(""); }}>Back</Button>
              <Button variant="outline" className="h-14 text-xl" onClick={() => press("0")} disabled={busy}>0</Button>
              <Button variant="ghost" className="h-14" onClick={() => press("del")} disabled={busy}><Delete className="h-5 w-5" /></Button>
            </div>
            {pin.length > 4 && (
              <Button className="mt-4 w-full" onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes shake { 10%,90%{transform:translateX(-2px)} 20%,80%{transform:translateX(4px)} 30%,50%,70%{transform:translateX(-8px)} 40%,60%{transform:translateX(8px)} }`}</style>
    </div>
  );
}
