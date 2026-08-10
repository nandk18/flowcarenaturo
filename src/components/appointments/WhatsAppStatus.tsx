import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

type Row = { event: string; status: string; error: string | null; created_at: string; followup_stage: number | null };

const EVENT_LABEL: Record<string, string> = {
  booked: "Booking confirmation",
  rescheduled: "Reschedule notice",
  cancelled: "Cancellation notice",
  reminder: "Reminder",
  review: "Review link",
  followup: "Follow-up care message",
};

const STAGE_LABEL: Record<number, string> = {
  1: "Follow-up reminder 1 (day 10)",
  2: "Follow-up reminder 2 (day 15)",
  3: "Final follow-up reminder (day 18)",
};


/** Shows whether the automated Twilio WhatsApp message went out for an appointment or therapy session. */
export default function WhatsAppStatus({
  appointmentId,
  therapySessionId,
}: {
  appointmentId?: string;
  therapySessionId?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let q = (supabase as any)
          .from("whatsapp_messages")
          .select("event, status, error, created_at")
          .order("created_at", { ascending: false });
        if (appointmentId) q = q.eq("appointment_id", appointmentId);
        else if (therapySessionId) q = q.eq("therapy_session_id", therapySessionId);
        else return;
        const { data } = await q;
        if (!cancelled) setRows((data as Row[]) ?? []);
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, therapySessionId]);

  if (!rows.length) return null;

  return (
    <div className="mt-3 space-y-1 rounded-lg bg-muted/50 p-2">
      {rows.map((r, i) => {
        const ok = r.status === "sent";
        const pending = r.status === "pending";
        const Icon = ok ? CheckCircle2 : pending ? Clock : AlertTriangle;
        return (
          <div
            key={i}
            className={`flex items-start gap-1.5 text-xs ${
              ok ? "text-emerald-700" : pending ? "text-muted-foreground" : "text-destructive"
            }`}
            title={r.error ?? undefined}
          >
            <Icon className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              {EVENT_LABEL[r.event] ?? r.event}:{" "}
              {ok ? "WhatsApp sent" : pending ? "sending…" : "WhatsApp failed"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
