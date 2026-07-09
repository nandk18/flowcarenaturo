import { useEffect, useState } from "react";
import MainShell from "@/components/layout/MainShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Loader2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Row = {
  therapist_id: string;
  therapist_name: string;
  therapist_color: string | null;
  reviews_30d: number;
  avg_30d: number | null;
  reviews_lifetime: number;
  avg_lifetime: number | null;
};

type Review = {
  id: string;
  rating: number;
  submitted_at: string;
  therapy_sessions?: { service_name: string; session_date: string } | null;
  patients?: { first_name: string | null; last_name: string | null; name: string | null } | null;
};

function Stars({ value, size = "sm" }: { value: number | null; size?: "sm" | "md" }) {
  const v = Math.round((value ?? 0) * 2) / 2;
  const cls = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${cls} ${n <= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

export default function TherapistScorecards() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<Row | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const { data } = await (supabase as any).rpc("get_therapist_scorecards", { p_clinic_id: clinicId });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [clinicId]);

  useEffect(() => {
    if (!drawer || !clinicId) return;
    (async () => {
      const { data } = await supabase
        .from("therapy_session_reviews")
        .select("id, rating, submitted_at, therapy_sessions(service_name, session_date), patients(first_name, last_name, name)")
        .eq("clinic_id", clinicId)
        .eq("therapist_id", drawer.therapist_id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(25);
      setReviews((data as any) ?? []);
    })();
  }, [drawer, clinicId]);

  return (
    <MainShell title="Therapist Scorecards">
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">Ratings collected from patients via WhatsApp review links.</p>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No therapists yet.</CardContent></Card>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {rows.map((r) => (
              <Card key={r.therapist_id} className="cursor-pointer hover:border-primary/40 transition" onClick={() => setDrawer(r)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full grid place-items-center text-white font-semibold text-sm shrink-0"
                    style={{ background: r.therapist_color ?? "hsl(var(--primary))" }}
                  >
                    {r.therapist_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.therapist_name}</div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />30 days</div>
                        <div className="flex items-center gap-1.5">
                          <Stars value={r.avg_30d} />
                          <span className="font-mono">{r.avg_30d ?? "—"}</span>
                          <span className="text-muted-foreground">({r.reviews_30d})</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Lifetime</div>
                        <div className="flex items-center gap-1.5">
                          <Stars value={r.avg_lifetime} />
                          <span className="font-mono">{r.avg_lifetime ?? "—"}</span>
                          <span className="text-muted-foreground">({r.reviews_lifetime})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{drawer?.therapist_name} — recent reviews</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {reviews.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">No submitted reviews yet.</div>
            ) : reviews.map((r) => {
              const pname = r.patients?.name || `${r.patients?.first_name ?? ""} ${r.patients?.last_name ?? ""}`.trim() || "Patient";
              return (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate">{r.therapy_sessions?.service_name ?? "Session"}</div>
                    <Stars value={r.rating} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {pname} · {format(new Date(r.submitted_at), "MMM d, h:mm a")}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </MainShell>
  );
}
