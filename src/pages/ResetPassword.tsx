import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Stethoscope, Loader2, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) {
        setReady(true);
        setChecking(false);
      }
    });

    const init = async () => {
      // Try parsing tokens from both hash and query string
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
      const query = window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search;
      const params = new URLSearchParams([hash, query].filter(Boolean).join("&"));

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token") || "";
      const errorDesc = params.get("error_description");

      if (errorDesc) {
        setLinkError(decodeURIComponent(errorDesc));
        setChecking(false);
        return;
      }

      if (accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (error) {
          setLinkError("This reset link has expired or already been used. Reset links are single-use and expire in 1 hour. Please request a new one.");
          setChecking(false);
          return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        setReady(true);
        setChecking(false);
        return;
      }

      // No token in URL — check for existing recovery session
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        setReady(true);
        setChecking(false);
      } else {
        // Wait briefly for the PASSWORD_RECOVERY event before giving up
        setTimeout(() => {
          if (!cancelled && !ready) {
            setLinkError("No reset token found. This usually happens when the link is opened on a different device or browser than where the reset was requested. Please request a new reset link and open it on the same device.");
            setChecking(false);
          }
        }, 2500);
      }
    };

    init();
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      setSuccess(true);
      toast.success("Password updated!");
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 2000);
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center shadow-elevated">
          <CardContent className="py-10 space-y-4">
            <h2 className="text-xl font-bold text-foreground">Reset Link Issue</h2>
            <p className="text-muted-foreground text-sm">{linkError}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate("/login")}>Back to Login</Button>
              <Button onClick={() => navigate("/forgot-password")}>Request New Link</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center shadow-elevated">
          <CardContent className="py-10 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Password Updated!</h2>
            <p className="text-muted-foreground">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
            <Stethoscope className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">New Password</h1>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Create New Password</CardTitle>
            <CardDescription>Password must be at least 8 characters</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
