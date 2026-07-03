import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutGrid, CalendarPlus, Users, HeartPulse } from "lucide-react";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import { Navigate } from "react-router-dom";

export default function TreatmentIndex() {
  const navigate = useNavigate();
  const { enabled, loading } = useTreatmentEnabled();

  if (loading) return <DashboardLayout title="Treatment"><div className="p-6 text-sm text-muted-foreground">Loading…</div></DashboardLayout>;
  if (!enabled) return <Navigate to="/dashboard" replace />;

  const cards = [
    { to: "/treatment/board", icon: LayoutGrid, title: "Treatment Board", desc: "Live view of today's therapy sessions" },
    { to: "/treatment/schedule", icon: CalendarPlus, title: "Schedule Therapy", desc: "Build a treatment plan for a patient" },
    { to: "/treatment/therapists", icon: Users, title: "Therapists", desc: "Manage therapist profiles and PINs" },
  ];

  return (
    <DashboardLayout title="Treatment">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10">
            <HeartPulse className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Treatment</h1>
            <p className="text-sm text-muted-foreground">Plans, therapy sessions and therapists.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.to}
                type="button"
                onClick={() => navigate(c.to)}
                className="group rounded-2xl border bg-card p-5 text-left shadow-card transition hover:border-purple-500/60 hover:shadow-lg"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Icon className="h-5 w-5 text-purple-500" />
                </div>
                <h3 className="font-display text-base font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
