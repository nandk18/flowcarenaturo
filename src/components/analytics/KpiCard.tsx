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
    accent: "bg-accent/40 text-accent-foreground",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {Icon && (
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneMap[tone]}`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
