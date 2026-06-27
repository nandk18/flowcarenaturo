import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LinkIcon, AlertTriangle } from "lucide-react";

type State = "loading" | "not_found" | "expired" | "redirecting";

export default function ShortLinkRedirect() {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!code) {
      setState("not_found");
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("short_links")
        .select("id, original_url, expires_at, click_count")
        .eq("short_code", code)
        .maybeSingle();

      if (error || !data) {
        setState("not_found");
        return;
      }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setState("expired");
        return;
      }

      // Fire-and-forget click counter; never block redirect
      supabase
        .from("short_links")
        .update({ click_count: (data.click_count ?? 0) + 1 } as any)
        .eq("id", data.id)
        .then(() => {});

      setState("redirecting");
      window.location.replace(data.original_url);
    })();
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        {state === "loading" || state === "redirecting" ? (
          <>
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {state === "redirecting" ? "Redirecting…" : "Opening link…"}
            </p>
          </>
        ) : state === "expired" ? (
          <>
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
            <h1 className="text-lg font-semibold">Link expired</h1>
            <p className="text-sm text-muted-foreground">
              This link is no longer valid. Please request a new one from
              the clinic.
            </p>
          </>
        ) : (
          <>
            <LinkIcon className="w-10 h-10 mx-auto text-muted-foreground" />
            <h1 className="text-lg font-semibold">Link not found</h1>
            <p className="text-sm text-muted-foreground">
              The link you followed is invalid or has been removed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
