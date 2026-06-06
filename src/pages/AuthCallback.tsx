import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfileAndGetPostAuthRoute } from "@/lib/authRedirect";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        const session = sessionResult?.data.session ?? null;

        if (cancelled) return;

        if (!session) {
          toast.error("Email verification link is invalid or expired.");
          navigate("/login?error=auth_failed", { replace: true });
          return;
        }

        setMessage("Signed in! Redirecting...");
        const nextRoute = await ensureProfileAndGetPostAuthRoute(session.user.id);
        if (!cancelled) navigate(nextRoute, { replace: true });
      } catch (err: any) {
        if (cancelled) return;
        toast.error(err?.message || "Authentication failed");
        navigate("/login?error=auth_failed", { replace: true });
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
