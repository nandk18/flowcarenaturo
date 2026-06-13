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
