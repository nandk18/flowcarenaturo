import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User } from "lucide-react";

type Visit = {
  id: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
  vitals: any;
  created_at: string;
  patient: { id: string; name: string; healthcare_id: string | null; gender: string | null; dob: string | null; allergies: any } | null;
};

export default function TodayQueue() {
  const { profile } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVisits = useCallback(async () => {
    if (!profile?.clinic_id) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("visits")
      .select("id, token_number, status, chief_complaint, vitals, created_at, patients!inner(id, name, healthcare_id, gender, dob, allergies)")
      .eq("clinic_id", profile.clinic_id)
      .eq("visit_date", today)
      .order("token_number", { ascending: true });

    if (!error && data) {
      setVisits(data.map((v: any) => ({ ...v, patient: v.patients })));
    }
    setLoading(false);
  }, [profile?.clinic_id]);

  useEffect(() => {
    fetchVisits();

    // Realtime subscription
    const channel = supabase
      .channel("visits-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => {
        fetchVisits();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchVisits]);

  const statusColor = (status: string) => {
    switch (status) {
      case "waiting": return "bg-warning/15 text-warning border-warning/30";
      case "in_progress": return "bg-info/15 text-info border-info/30";
      case "completed": return "bg-success/15 text-success border-success/30";
      case "cancelled": return "bg-destructive/15 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getWaitTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CalendarEmpty className="mb-4 h-16 w-16 text-muted-foreground/30" />
          <h3 className="font-display text-lg font-semibold text-foreground">No patients today</h3>
          <p className="text-sm text-muted-foreground">Register a new patient to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{visits.length} patient{visits.length !== 1 ? "s" : ""} today</p>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> Waiting</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-info" /> In Progress</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> Done</span>
        </div>
      </div>

      {visits.map(visit => (
        <Card key={visit.id} className="shadow-card transition-shadow hover:shadow-elevated">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-lg font-bold text-primary">
              {visit.token_number}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{visit.patient?.name}</p>
              {visit.patient?.healthcare_id && (
                <p className="font-mono text-[10px] text-primary">{visit.patient.healthcare_id}</p>
              )}
              <p className="text-xs text-muted-foreground truncate">
                {visit.chief_complaint || "No complaint recorded"}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {visit.status === "waiting" && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {getWaitTime(visit.created_at)}
                </span>
              )}
              <Badge variant="outline" className={statusColor(visit.status)}>
                {visit.status.replace("_", " ")}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CalendarEmpty(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
