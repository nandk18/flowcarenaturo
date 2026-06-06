import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { supabase as sb } from "@/integrations/supabase/client";
import SeoHead from "@/components/SeoHead";
import Logo from "@/components/Logo";

async function logLoginAudit(userId: string, userEmail: string | null) {
  try {
    const { data: prof } = await sb.from("profiles")
      .select("clinic_id, full_name, role")
      .eq("user_id", userId)
      .single();
    if (!prof?.clinic_id) return;
    await sb.from("audit_logs" as any).insert({
      clinic_id: prof.clinic_id,
      user_id: userId,
      user_name: prof.full_name || userEmail,
      user_role: prof.role,
      action: "login",
      resource_type: "auth",
      resource_id: userId,
      resource_name: userEmail,
      metadata: {},
    });
  } catch {
    // Silently fail — never block login on audit
  }
}

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session_expired";
  const deletionRequested = searchParams.get("reason") === "deletion_requested";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); setLoading(false); return; }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      if (profileErr || !profile) {
        toast.error("Profile not found. Please contact admin.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (profile.role !== "admin" && profile.role !== "super_admin") {
        toast.error("This account does not have access. Please contact your administrator.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      logLoginAudit(data.user.id, data.user.email ?? null);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentAccepted) {
      toast.error("Please accept the Terms of Service and Privacy Policy");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) toast.error(error.message);
    else toast.success("Check your email to verify your account!");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      <SeoHead
        title="Sign in to FlowCare — AI Practice Management"
        description="Log in to your FlowCare clinic account to manage patients, consultations, and prescriptions with AI voice notes."
        path="/auth"
      />
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
            <Stethoscope className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Sign in to FlowCare</h1>
          <p className="mt-2 text-muted-foreground">AI-Powered Practice Management</p>
        </div>

        {sessionExpired && (
          <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground">
              Your session expired due to inactivity. Please log in again.
            </p>
          </div>
        )}
        {deletionRequested && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground">
              Your account deletion request has been received. Your data will be permanently
              deleted within 30 days.
            </p>
          </div>
        )}

        <Card className="shadow-elevated">
          <Tabs defaultValue="login">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="admin@clinic.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="text-center">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" placeholder="Dr. John Smith" value={fullName} onChange={e => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="admin@clinic.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={e => setConsentAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground">
                      I agree to the{" "}
                      <Link to="/terms" target="_blank" className="text-primary underline">Terms of Service</Link>
                      {" "}and{" "}
                      <Link to="/privacy" target="_blank" className="text-primary underline">Privacy Policy</Link>
                    </span>
                  </label>
                  <Button type="submit" className="w-full" disabled={loading || !consentAccepted}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
