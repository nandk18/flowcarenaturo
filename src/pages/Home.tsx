import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TopBar from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, Stethoscope, HeartPulse, LucideIcon } from "lucide-react";

type SectionKey = "sales" | "consult" | "treatment";

type Section = {
  key: SectionKey;
  icon: LucideIcon;
  tag: string;
  title: string;
  description: string;
  badge: string;
  badgeVariant: "default" | "secondary";
  to: string;
  theme: {
    border: string;
    hoverBg: string;
    iconBg: string;
    iconText: string;
    glow: string;
  };
};

const SECTIONS: Section[] = [
  {
    key: "sales",
    icon: TrendingUp,
    tag: "Sales",
    title: "Revenue & Growth",
    description: "Leads, conversions and revenue metrics",
    badge: "Coming Soon",
    badgeVariant: "secondary",
    to: "/sales",
    theme: {
      border: "border-blue-500/30 hover:border-blue-500",
      hoverBg: "hover:bg-blue-500/5",
      iconBg: "bg-blue-500/10",
      iconText: "text-blue-500",
      glow: "hover:shadow-[0_0_0_1px_hsl(217_91%_60%/0.3),0_20px_40px_-15px_hsl(217_91%_60%/0.35)]",
    },
  },
  {
    key: "consult",
    icon: Stethoscope,
    tag: "Consult",
    title: "Clinical Dashboard",
    description: "Appointments, prescriptions, performance",
    badge: "Active",
    badgeVariant: "default",
    to: "/consult",
    theme: {
      border: "border-green-500/30 hover:border-green-500",
      hoverBg: "hover:bg-green-500/5",
      iconBg: "bg-green-500/10",
      iconText: "text-green-600",
      glow: "hover:shadow-[0_0_0_1px_hsl(142_71%_45%/0.3),0_20px_40px_-15px_hsl(142_71%_45%/0.35)]",
    },
  },
  {
    key: "treatment",
    icon: HeartPulse,
    tag: "Treatment",
    title: "Care Plans",
    description: "Patient journeys, plans and follow-ups",
    badge: "Coming Soon",
    badgeVariant: "secondary",
    to: "/treatment",
    theme: {
      border: "border-purple-500/30 hover:border-purple-500",
      hoverBg: "hover:bg-purple-500/5",
      iconBg: "bg-purple-500/10",
      iconText: "text-purple-500",
      glow: "hover:shadow-[0_0_0_1px_hsl(271_91%_65%/0.3),0_20px_40px_-15px_hsl(271_91%_65%/0.35)]",
    },
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            What would you like to manage today?
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-3">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => navigate(s.to)}
                className={cn(
                  "group flex flex-col items-start rounded-2xl border bg-card p-6 text-left shadow-card transition-all",
                  s.theme.border,
                  s.theme.hoverBg,
                  s.theme.glow,
                )}
              >
                <div className="mb-5 flex w-full items-start justify-between">
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", s.theme.iconBg)}>
                    <Icon className={cn("h-6 w-6", s.theme.iconText)} />
                  </div>
                  <Badge variant={s.badgeVariant} className="text-[10px]">{s.badge}</Badge>
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.tag}</p>
                <h3 className="mt-1 font-display text-xl font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
