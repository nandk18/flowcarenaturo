import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTherapistAuth } from "@/hooks/useTherapistAuth";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, CheckCircle2, LogOut, Camera, AlertTriangle, X } from "lucide-react";
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
  completed_at: string | null;
  setup_photo_url: string | null;
  notes: string | null;
  patients?: { id: string; first_name: string | null; last_name: string | null; name: string | null } | null;
  treatment_plan_items?: { total_sessions: number | null } | null;
};

type Idle = { patient_id: string; patient_name: string; idle_minutes: number };

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return <span className="font-mono text-[11px] text-white/80">{format(now, "hh:mm:ss a")}</span>;
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span className="font-mono text-base font-semibold text-orange-700">{mm}:{ss}</span>;
}

export default function TherapistApp() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const { enabled, loading: flagLoading } = useTreatmentEnabled();
  const { therapist, loading: authLoading, signOut } = useTherapistAuth();
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [idle, setIdle] = useState<Idle[]>([]);
  const [dismissedIdle, setDismissedIdle] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<Session | null>(null);

  const load = useCallback(async () => {
    if (!clinicId || !therapist) return;
    const [s, i] = await Promise.all([
      supabase
        .from("therapy_sessions")
        .select("id, patient_id, service_id, service_name, status, therapist_id, room, session_number, started_at, completed_at, setup_photo_url, patients(id, first_name, last_name, name), treatment_plan_items(total_sessions)")
        .eq("clinic_id", clinicId)
        .eq("session_date", today)
        .or(`therapist_id.eq.${therapist.id},therapist_id.is.null`)
        .order("status")
        .order("service_name"),
      supabase.rpc("get_idle_patients", { p_clinic_id: clinicId }),
    ]);
    setSessions((s.data as any) ?? []);
    setIdle((i.data as any) ?? []);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_idle_log", filter: `clinic_id=eq.${clinicId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, load]);

  const doStart = async (s: Session) => {
    if (!therapist || !clinicId) return;
    setBusyId(s.id);
    // Guard: block starting a second concurrent session for the same patient
    const { data: ongoing } = await supabase
      .from("therapy_sessions")
      .select("id, service_name")
      .eq("clinic_id", clinicId)
      .eq("patient_id", s.patient_id)
      .eq("session_date", today)
      .eq("status", "in_progress")
      .neq("id", s.id)
      .limit(1);
    if (ongoing && ongoing.length > 0) {
      setBusyId(null);
      toast.error(`Patient already has an ongoing session (${ongoing[0].service_name}). Complete it first.`);
      return;
    }
    const { error } = await supabase
      .from("therapy_sessions")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        therapist_id: therapist.id,
        room: s.room ?? therapist.room,
      })
      .eq("id", s.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success(`Started ${s.service_name}`);
  };

  const openUpload = (s: Session) => {
    pendingUploadRef.current = s;
    fileInputRef.current?.click();
  };

  const onPhotoChosen = async (file: File | undefined) => {
    const s = pendingUploadRef.current;
    pendingUploadRef.current = null;
    if (!s || !file || !clinicId) return;
    setBusyId(s.id);
    const path = `${clinicId}/${s.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("therapy-photos").upload(path, file, { upsert: false });
    if (upErr) { setBusyId(null); return toast.error(upErr.message); }
    const { data: signed } = await supabase.storage.from("therapy-photos").createSignedUrl(path, 60 * 60 * 24 * 30);
    const { error } = await supabase
      .from("therapy_sessions")
      .update({ setup_photo_url: signed?.signedUrl ?? path })
      .eq("id", s.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success("Setup photo uploaded");
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
  const visibleIdle = idle.filter((i) => !dismissedIdle.has(i.patient_id));

  return (
    <div className="min-h-screen bg-background">
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 text-white"
        style={{ background: therapist.therapist_color ?? "hsl(var(--primary))" }}
      >
        <div className="min-w-0">
          <div className="text-sm font-display font-semibold truncate">{therapist.full_name}'s Therapies</div>
          <div className="flex items-center gap-2">
            <LiveClock />
            <span className="text-[10px] text-white/70">· {therapist.room ?? "No room"}</span>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={async () => { await removeTherapistPushSubscription(); signOut(); navigate("/therapist-login", { replace: true }); }}>
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
        {/* Idle alerts */}
        {visibleIdle.map((i) => (
          <div key={i.patient_id} className="rounded-xl border border-red-500/50 bg-red-500/10 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 flex-1">
              <span className="font-semibold">{i.patient_name}</span> waiting {i.idle_minutes} mins — please attend immediately!
            </div>
            <button onClick={() => setDismissedIdle((s) => new Set([...s, i.patient_id]))}>
              <X className="h-3 w-3 text-red-700" />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Not started</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />In progress</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Done</span>
        </div>

        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2 text-[11px] text-blue-800">
          💡 You can start any unassigned therapy. It auto-assigns to you when started.
        </div>

        {/* My sessions */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">My sessions today</h2>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : mine.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No sessions assigned to you yet.</CardContent></Card>
          ) : (
            <ul className="space-y-2">
              {mine.map((s) => (
                <li key={s.id}>
                  <SessionCard
                    s={s}
                    busy={busyId === s.id}
                    onStart={() => doStart(s)}
                    onUpload={() => openUpload(s)}
                    onComplete={() => complete(s)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {unassigned.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Available to claim</h2>
            <ul className="space-y-2">
              {unassigned.map((s) => (
                <li key={s.id}>
                  <SessionCard
                    s={s}
                    busy={busyId === s.id}
                    onStart={() => doStart(s)}
                    onUpload={() => openUpload(s)}
                    onComplete={() => complete(s)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function SessionCard({
  s, busy, onStart, onUpload, onComplete,
}: {
  s: Session; busy: boolean;
  onStart: () => void; onUpload: () => void; onComplete: () => void;
}) {
  const nm = s.patients?.name || `${s.patients?.first_name ?? ""} ${s.patients?.last_name ?? ""}`.trim() || "Patient";
  const total = s.treatment_plan_items?.total_sessions ?? null;
  const sessLabel = s.session_number ? `Session ${s.session_number}${total ? ` of ${total}` : ""}` : "";
  const tone =
    s.status === "in_progress" ? "border-l-4 border-orange-500 bg-orange-500/5" :
    s.status === "completed" ? "border-l-4 border-emerald-500 bg-emerald-500/5 opacity-80" :
    "border-l-4 border-red-500 bg-red-500/5";
  return (
    <Card className={tone}>
      <CardContent className="p-3 space-y-2">
        <div className="text-xs text-muted-foreground">{nm}</div>
        <div className="font-display font-semibold text-sm">{s.service_name}</div>
        <div className="text-[11px] text-muted-foreground">
          {sessLabel}{s.room ? ` · ${s.room}` : ""}
          {s.status === "in_progress" && s.started_at && ` · started ${format(new Date(s.started_at), "h:mm a")}`}
        </div>

        {s.setup_photo_url && (
          <img src={s.setup_photo_url} alt="setup" className="h-20 w-full rounded-md object-cover" />
        )}

        {s.status === "in_progress" && s.started_at && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-muted-foreground">Elapsed</span>
            <ElapsedTimer startedAt={s.started_at} />
          </div>
        )}

        {s.status === "not_started" && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onUpload} disabled={busy} className={s.setup_photo_url ? "border-emerald-500 text-emerald-700" : ""}>
              <Camera className="h-4 w-4" />
              {s.setup_photo_url && <CheckCircle2 className="h-3 w-3 ml-1" />}
            </Button>
            <Button size="sm" className="flex-1" onClick={onStart} disabled={busy}>
              <Play className="h-3 w-3 mr-1" /> Start
            </Button>
          </div>
        )}
        {s.status === "in_progress" && (
          <Button size="lg" className="w-full bg-teal-600 hover:bg-teal-700" onClick={onComplete} disabled={busy}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Complete
          </Button>
        )}
        {s.status === "completed" && (
          <div className="text-[11px] text-emerald-700">
            {s.started_at && format(new Date(s.started_at), "h:mm a")}
            {s.completed_at && ` → ${format(new Date(s.completed_at), "h:mm a")}`}
            {s.started_at && s.completed_at && ` · ${Math.max(0, Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000))} min ✓`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
