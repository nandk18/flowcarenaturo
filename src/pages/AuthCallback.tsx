import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // Supabase JS auto-detects the token in the URL hash/query and creates a session.
        // Give it a tick, then poll briefly for the session.
        const start = Date.now();
        let session = null;
        while (Date.now() - start < 8000) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            session = data.session;
            break;
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        if (cancelled) return;

        if (!session) {
          toast.error("Email verification link is invalid or expired.");
          navigate("/auth", { replace: true });
          return;
        }

        setMessage("Signed in! Redirecting...");
        navigate("/", { replace: true });
      } catch (err: any) {
        if (cancelled) return;
        toast.error(err?.message || "Authentication failed");
        navigate("/auth", { replace: true });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
