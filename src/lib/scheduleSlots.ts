// Shared utility for generating doctor appointment slots from
// doctor_schedules + doctor_exceptions + existing appointments.

export type ScheduleSession = { start: string; end: string };

export type DoctorSchedule = {
  id?: string;
  doctor_id: string;
  day_of_week: number; // 0=Sun ... 6=Sat
  sessions: ScheduleSession[];
  slot_duration_minutes: number;
  is_active: boolean;
};

export type DoctorException = {
  id: string;
  doctor_id: string;
  exception_date: string; // yyyy-mm-dd
  type: "leave" | "holiday" | "emergency";
  reason: string | null;
  affects_appointments: boolean;
  is_full_day?: boolean;
  start_time?: string | null; // HH:MM[:SS]
  end_time?: string | null;
};

export type ExistingAppointment = {
  id: string;
  appointment_time: string; // HH:MM[:SS]
  status: string;
  patient?: { id: string; name: string; phone?: string | null } | null;
};

export type SlotGroup = "morning" | "afternoon" | "evening";

export type GeneratedSlot = {
  time: string; // "HH:MM"
  available: boolean;
  appointment: ExistingAppointment | null;
  past: boolean;
  group: SlotGroup;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const groupOf = (hhmm: string): SlotGroup => {
  const m = toMinutes(hhmm);
  if (m < 12 * 60) return "morning";
  if (m < 17 * 60) return "afternoon";
  return "evening";
};

export function getDayOfWeek(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return d.getDay();
}

export function isPastDate(date: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(date + "T00:00:00").getTime() < today.getTime();
}

export function isToday(date: string): boolean {
  const today = new Date();
  return (
    today.getFullYear() === new Date(date + "T00:00:00").getFullYear() &&
    today.getMonth() === new Date(date + "T00:00:00").getMonth() &&
    today.getDate() === new Date(date + "T00:00:00").getDate()
  );
}

export type GenerateArgs = {
  schedule: DoctorSchedule | null;
  exception: DoctorException | null;
  appointments: ExistingAppointment[];
  date: string; // yyyy-mm-dd
};

export type GenerateResult = {
  slots: GeneratedSlot[];
  reason: "ok" | "no-schedule" | "inactive" | "exception" | "past";
  exception?: DoctorException | null;
};

export function generateSlots({
  schedule,
  exception,
  appointments,
  date,
}: GenerateArgs): GenerateResult {
  if (isPastDate(date)) return { slots: [], reason: "past" };
  const isPartialException =
    !!exception &&
    exception.affects_appointments &&
    exception.is_full_day === false &&
    !!exception.start_time &&
    !!exception.end_time;
  if (
    exception &&
    exception.affects_appointments &&
    !isPartialException
  ) {
    return { slots: [], reason: "exception", exception };
  }
  if (!schedule) return { slots: [], reason: "no-schedule" };
  if (!schedule.is_active) return { slots: [], reason: "inactive" };

  const duration = schedule.slot_duration_minutes || 15;
  const now = new Date();
  const todayCheck = isToday(date);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const bookedTimes = new Map<string, ExistingAppointment>();
  for (const a of appointments) {
    if (a.status === "cancelled") continue;
    const t = a.appointment_time.substring(0, 5);
    bookedTimes.set(t, a);
  }

  const blockStart = isPartialException
    ? toMinutes(exception!.start_time!.substring(0, 5))
    : -1;
  const blockEnd = isPartialException
    ? toMinutes(exception!.end_time!.substring(0, 5))
    : -1;

  const out: GeneratedSlot[] = [];
  for (const session of schedule.sessions || []) {
    if (!session?.start || !session?.end) continue;
    const startM = toMinutes(session.start);
    const endM = toMinutes(session.end);
    for (let m = startM; m + duration <= endM; m += duration) {
      if (isPartialException && m < blockEnd && m + duration > blockStart) continue;
      const time = fromMinutes(m);
      const past = todayCheck && m < nowMin;
      const appt = bookedTimes.get(time) || null;
      out.push({
        time,
        available: !appt && !past,
        appointment: appt,
        past,
        group: groupOf(time),
      });
    }
  }
  return { slots: out, reason: "ok" };
}

export type DaySummary = "off" | "past" | "available" | "partial" | "full";

export function getDaySummary(args: GenerateArgs): DaySummary {
  const { slots, reason } = generateSlots(args);
  if (reason === "past") return "past";
  if (reason !== "ok") return "off";
  if (slots.length === 0) return "off";
  const free = slots.filter((s) => s.available).length;
  if (free === 0) return "full";
  if (free === slots.length) return "available";
  return "partial";
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
