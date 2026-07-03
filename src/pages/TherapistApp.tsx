import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTherapistAuth } from "@/hooks/useTherapistAuth";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle2, LogOut, Camera, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ensureTherapistPushSubscription, removeTherapistPushSubscription } from "@/lib/therapistPush";

type Session = {
  id: string;
  patient_id: string;
  service_id: string | null;
  service_name: string;
  status: string;
  therapist_id: string | null;
  room: string | null;
  session_number: number | null;
  started_at: string | null;
  setup_photo_url: string | null;
  patients?: { id: string; first_name: string | null; last_name: string | null; name: string | null } | null;
};

export default function TherapistApp() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const { enabled, loading: flagLoading } = useTreatmentEnabled();
  const { therapist, loading: authLoading, signOut } = useTherapistAuth();
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingStartRef = useRef<Session | null>(null);

  const load = useCallback(async () => {
    if (!clinicId || !therapist) return;
    const { data } = await supabase
      .from("therapy_sessions")
      .select("id, patient_id, service_id, service_name, status, therapist_id, room, session_number, started_at, setup_photo_url, patients(id, first_name, last_name, name)")
      .eq("clinic_id", clinicId)
      .eq("session_date", today)
      .or(`therapist_id.eq.${therapist.id},therapist_id.is.null`)
      .order("status")
      .order("service_name");
    setSessions((data as any) ?? []);
    setLoading(false);
  }, [clinicId, therapist, today]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!clinicId || !therapist?.id) return;
    void ensureTherapistPushSubscription(therapist.id, clinicId);
  }, [clinicId, therapist?.id]);

  useEffect(() => {
    if (!clinicId) return;
    const channel = supabase
      .channel("therapist-app")
      .on("postgres_changes", { event: "*", schema: "public", table: "therapy_sessions", filter: `clinic_id=eq.${clinicId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, load]);

  const doStart = async (s: Session, photoUrl: string | null) => {
    if (!therapist) return;
    setBusyId(s.id);
    const { error } = await supabase
      .from("therapy_sessions")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        therapist_id: therapist.id,
        room: s.room ?? therapist.room,
        setup_photo_url: photoUrl ?? s.setup_photo_url,
      })
      .eq("id", s.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success(`Started ${s.service_name}`);
  };

  const startWithPhoto = (s: Session) => {
    pendingStartRef.current = s;
    fileInputRef.current?.click();
  };

  const startWithoutPhoto = (s: Session) => doStart(s, null);

  const onPhotoChosen = async (file: File | undefined) => {
    const s = pendingStartRef.current;
    pendingStartRef.current = null;
    if (!s || !file || !clinicId) return;
    setBusyId(s.id);
    const path = `${clinicId}/${s.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("therapy-photos").upload(path, file, { upsert: false });
    if (upErr) { setBusyId(null); return toast.error(upErr.message); }
    const { data: signed } = await supabase.storage.from("therapy-photos").createSignedUrl(path, 60 * 60 * 24 * 30);
    await doStart(s, signed?.signedUrl ?? path);
  };

  const complete = async (s: Session) => {
    setBusyId(s.id);
    const { error } = await (supabase as any).rpc("complete_therapy_session", {
      p_session_id: s.id,
      p_notes: null,
    });
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success(`Completed ${s.service_name}`);
  };

  if (flagLoading || authLoading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!enabled) return <Navigate to="/dashboard" replace />;
  if (!therapist) return <Navigate to="/therapist-login" replace />;

  const mine = sessions.filter((s) => s.therapist_id === therapist.id);
  const unassigned = sessions.filter((s) => !s.therapist_id && s.status === "not_started");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: therapist.therapist_color ?? "hsl(var(--primary))" }}
          >
            {therapist.full_name.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-display font-semibold leading-none">{therapist.full_name}</div>
            <div className="text-[10px] text-muted-foreground">{therapist.room ?? "No room"} · {today}</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={async () => { await removeTherapistPushSubscription(); signOut(); navigate("/therapist-login", { replace: true }); }}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPhotoChosen(e.target.files?.[0])}
      />

      <main className="mx-auto w-full max-w-md px-3 py-4 space-y-4">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">My sessions today</h2>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : mine.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No sessions assigned to you yet.</CardContent></Card>
          ) : (
            <ul className="space-y-2">
              {mine.map((s) => {
                const nm = s.patients?.name || `${s.patients?.first_name ?? ""} ${s.patients?.last_name ?? ""}`.trim() || "Patient";
                return (
                  <li key={s.id}>
                    <Card className={s.status === "completed" ? "opacity-60" : ""}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <UserIcon className="h-3 w-3" />{nm}
                            </div>
                            <div className="font-display font-semibold truncate">{s.service_name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {s.room ?? "—"}
                              {s.status === "in_progress" && s.started_at && ` · started ${format(new Date(s.started_at), "HH:mm")}`}
                            </div>
                          </div>
                          <Badge variant={s.status === "completed" ? "secondary" : s.status === "in_progress" ? "default" : "outline"} className="shrink-0 text-[10px]">
                            {s.status.replace("_", " ")}
                          </Badge>
                        </div>
                        {s.setup_photo_url && (
                          <img src={s.setup_photo_url} alt="setup" className="mt-2 h-20 w-full rounded-md object-cover" />
                        )}
                        <div className="mt-3 flex gap-2">
                          {s.status === "not_started" && (
                            <>
                              <Button size="sm" className="flex-1" onClick={() => startWithoutPhoto(s)} disabled={busyId === s.id}>
                                <Play className="h-3 w-3 mr-1" /> Start
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => startWithPhoto(s)} disabled={busyId === s.id}>
                                <Camera className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {s.status === "in_progress" && (
                            <Button size="sm" className="flex-1" onClick={() => complete(s)} disabled={busyId === s.id}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {unassigned.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Available to claim</h2>
            <ul className="space-y-2">
              {unassigned.map((s) => {
                const nm = s.patients?.name || `${s.patients?.first_name ?? ""} ${s.patients?.last_name ?? ""}`.trim() || "Patient";
                return (
                  <li key={s.id}>
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground truncate">{nm}</div>
                            <div className="text-sm font-medium truncate">{s.service_name}</div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" onClick={() => startWithoutPhoto(s)} disabled={busyId === s.id}>
                              <Play className="h-3 w-3 mr-1" /> Start
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => startWithPhoto(s)} disabled={busyId === s.id}>
                              <Camera className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
