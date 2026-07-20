import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Render a doctor name with a "Dr." prefix, without doubling it
 * when the stored name already starts with "Dr".
 */
export function formatDoctorName(name?: string | null): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  return /^dr\.?\b/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

/**
 * Returns today's date as `yyyy-MM-dd` in the user's LOCAL timezone.
 * Do NOT use `new Date().toISOString().split("T")[0]` for "today" — that
 * returns UTC and shifts to tomorrow after ~18:30 IST, which desyncs the
 * treatment module (session inserts vs Dashboard/Therapist app filters).
 */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
