import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import TopBar from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, Stethoscope, HeartPulse, LucideIcon } from "lucide-react";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";

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
      border: "border-border hover:border-primary/60",
      hoverBg: "hover:bg-primary/[0.04]",
      iconBg: "bg-primary/10",
      iconText: "text-primary",
      glow: "hover:-translate-y-1 hover:shadow-elevated",
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
      border: "border-border hover:border-accent-foreground/40",
      hoverBg: "hover:bg-accent/40",
      iconBg: "bg-accent",
      iconText: "text-accent-foreground",
      glow: "hover:-translate-y-1 hover:shadow-elevated",
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
      border: "border-border hover:border-primary/60",
      hoverBg: "hover:bg-secondary/60",
      iconBg: "bg-secondary",
      iconText: "text-secondary-foreground",
      glow: "hover:-translate-y-1 hover:shadow-elevated",
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
  const { enabled: treatmentEnabled } = useTreatmentEnabled();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const sections = SECTIONS
    .filter((s) => s.key !== "treatment" || treatmentEnabled)
    .map((s) =>
      s.key === "treatment" && treatmentEnabled
        ? { ...s, badge: "Active", badgeVariant: "default" as const }
        : s,
    );

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero">
      <TopBar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div className="mb-12 flex flex-col items-center text-center animate-enter">
          <Logo height={96} className="mb-6" />
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            What would you like to manage today?
          </p>
        </div>


        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-3">
          {sections.map((s) => {
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
