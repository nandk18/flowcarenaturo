// Deterministic colour assignment for doctors across the calendar UI.
// Uses only existing semantic design tokens (no literal hex values).
export type DoctorColor = {
  avatarBg: string;
  avatarText: string;
  dot: string;
  border: string;
  tint: string;
};

const PALETTE: DoctorColor[] = [
  { avatarBg: "bg-info/15", avatarText: "text-info", dot: "bg-info", border: "border-info", tint: "bg-info/10" },
  { avatarBg: "bg-teal-500/15", avatarText: "text-teal-700", dot: "bg-teal-500", border: "border-teal-500", tint: "bg-teal-500/10" },
  { avatarBg: "bg-warning/15", avatarText: "text-warning", dot: "bg-warning", border: "border-warning", tint: "bg-warning/10" },
  { avatarBg: "bg-destructive/15", avatarText: "text-destructive", dot: "bg-destructive", border: "border-destructive", tint: "bg-destructive/10" },
  { avatarBg: "bg-success/15", avatarText: "text-success", dot: "bg-success", border: "border-success", tint: "bg-success/10" },
  { avatarBg: "bg-primary/15", avatarText: "text-primary", dot: "bg-primary", border: "border-primary", tint: "bg-primary/10" },
];

export function doctorColor(allDoctorIds: string[], doctorId: string): DoctorColor {
  const idx = Math.max(0, allDoctorIds.indexOf(doctorId));
  return PALETTE[idx % PALETTE.length];
}

export function doctorInitial(name: string): string {
  const cleaned = name.replace(/^Dr\.?\s*/i, "").trim();
  return (cleaned[0] || name[0] || "?").toUpperCase();
}
