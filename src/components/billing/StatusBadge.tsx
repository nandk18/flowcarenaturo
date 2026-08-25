import { cn } from "@/lib/utils";

export default function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    unpaid: "bg-destructive/10 text-destructive border-destructive/20",
    partial: "bg-warning/10 text-warning border-warning/20",
    paid: "bg-success/10 text-success border-success/20",
    cancelled: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[status] || map.unpaid
      )}
    >
      {status}
    </span>
  );
}