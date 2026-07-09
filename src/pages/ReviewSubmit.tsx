import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

type Ctx = {
  therapist_name: string;
  service_name: string;
  clinic_name: string;
  patient_name: string;
  session_date: string;
  already_submitted: boolean;
  rating: number | null;
};

export default function ReviewSubmit() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); setError("Invalid link"); return; }
      const { data, error } = await (supabase as any).rpc("get_review_context", { p_token: token });
      if (error) { setError(error.message); setLoading(false); return; }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { setError("This review link is no longer valid."); setLoading(false); return; }
      setCtx(row as Ctx);
      if (row.already_submitted) { setDone(true); setRating(row.rating ?? 0); }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (!token || rating < 1) return;
    setSubmitting(true);
    setError(null);
    const { data, error } = await (supabase as any).rpc("submit_therapy_review", {
      p_token: token,
      p_rating: rating,
    });
    setSubmitting(false);
    if (error) return setError(error.message);
    if (data && data.success === false) return setError(data.error ?? "Could not submit");
    setDone(true);
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white grid place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-5 text-center">
          {ctx && (
            <>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{ctx.clinic_name}</div>
                <h1 className="mt-1 font-display text-xl font-semibold">Rate your therapy session</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Hi {ctx.patient_name || "there"}, how was <span className="font-medium text-foreground">{ctx.service_name}</span>{" "}
                  with <span className="font-medium text-foreground">{ctx.therapist_name}</span>
                  {ctx.session_date ? ` on ${format(new Date(ctx.session_date), "MMM d, yyyy")}` : ""}?
                </p>
              </div>

              {done ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-6 w-6" />
                  <div className="font-medium">Thanks for your feedback!</div>
                  {rating > 0 && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-5 w-5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = n <= (hover || rating);
                      return (
                        <button
                          key={n}
                          type="button"
                          onMouseEnter={() => setHover(n)}
                          onMouseLeave={() => setHover(0)}
                          onClick={() => setRating(n)}
                          className="p-1 transition-transform hover:scale-110"
                          aria-label={`${n} star${n > 1 ? "s" : ""}`}
                        >
                          <Star className={`h-10 w-10 ${active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {rating === 0 ? "Tap a star to rate" : `${rating} of 5`}
                  </div>
                  {error && <div className="text-xs text-destructive">{error}</div>}
                  <Button className="w-full" onClick={submit} disabled={submitting || rating < 1}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit rating"}
                  </Button>
                </>
              )}
            </>
          )}
          {!ctx && error && <div className="text-sm text-destructive">{error}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
