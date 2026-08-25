import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export function KpiCard({
  label, value, sub, icon: Icon, tone = "primary",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "primary" | "accent" | "success" | "warning" | "danger";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          {Icon && (
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${toneMap[tone]}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

