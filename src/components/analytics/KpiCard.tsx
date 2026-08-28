import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";

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

/** Sparkline / rail colour per tone, expressed as an HSL var so it works in inline SVG. */
const TONE_HEX: Record<string, string> = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--info))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  danger: "hsl(var(--destructive))",
};

const TREND_COLOR: Record<string, string> = {
  up: "text-success",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

export function KpiCard({
  label, value, sub, icon: Icon, tone = "primary", trend, spark,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "primary" | "accent" | "success" | "warning" | "danger";
  /** Optional small trend chip, e.g. { label: "↑6%", direction: "up" } */
  trend?: { label: string; direction: "up" | "down" | "flat" };
  /** Optional inline sparkline series shown under the value */
  spark?: number[];
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
        {spark && spark.length > 0 && (
          <Sparkline data={spark} color={TONE_HEX[tone]} width={100} height={24} className="mt-1.5 w-full" />
        )}
      </CardContent>
    </Card>
  );
}
