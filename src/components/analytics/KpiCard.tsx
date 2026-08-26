import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_BORDER: Record<string, string> = {
  primary: "border-l-primary",
  accent: "border-l-info",
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-destructive",
};

const TONE_ICON: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

const TREND_COLOR: Record<string, string> = {
  up: "text-success",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

export function KpiCard({
  label, value, sub, icon: Icon, tone = "primary", trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "primary" | "accent" | "success" | "warning" | "danger";
  /** Optional small trend chip, e.g. { label: "↑6%", direction: "up" } */
  trend?: { label: string; direction: "up" | "down" | "flat" };
}) {
  return (
    <Card className={cn("shadow-card border-l-4", TONE_BORDER[tone])}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground truncate">
            {label}
          </span>
          {trend ? (
            <span className={cn("shrink-0 text-[10px] font-semibold", TREND_COLOR[trend.direction])}>
              {trend.label}
            </span>
          ) : Icon ? (
            <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", TONE_ICON[tone])}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          ) : null}
        </div>
        <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
