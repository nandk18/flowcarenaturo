import { Card, CardContent } from "@/components/ui/card";

type TrendTone = "up" | "flat";

interface KpiTileProps {
  label: string;
  value: number | string;
  trendLabel: string;
  trendTone?: TrendTone;
  sub: string;
  accent: "info" | "success" | "warning";
}

const accentBorder: Record<KpiTileProps["accent"], string> = {
  info: "border-l-info",
  success: "border-l-success",
  warning: "border-l-warning",
};

export default function KpiTile({ label, value, trendLabel, trendTone = "flat", sub, accent }: KpiTileProps) {
  return (
    <Card className={`shadow-card border-l-4 ${accentBorder[accent]}`}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              trendTone === "up" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
            }`}
          >
            {trendLabel}
          </span>
        </div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
