import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Check, Crown, Building2, Calendar, Users } from "lucide-react";


function loadRazorpayScript(): Promise<boolean> {
  const win = window as any;
  if (win.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const PLAN_PRICING: Record<string, { monthly: number; annual: number }> = {
  pro: { monthly: 2999, annual: 29990 },
  custom: { monthly: 4999, annual: 49990 },
};

const PLAN_PATIENT_LIMITS: Record<string, number> = {
  pro: 500,
  custom: 2000,
};

export default function SubscriptionPage() {
  const { profile, session } = useAuth();
  const { clinic, refetch } = useClinic();
  const [loading, setLoading] = useState(false);
  const [planTier, setPlanTier] = useState<"pro" | "custom">("pro");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [patientCount, setPatientCount] = useState(0);

  useEffect(() => {
    if (!clinic?.id) return;
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id)
      .then(({ count, error }) => {
        if (!error) setPatientCount(count || 0);
      });
  }, [clinic?.id]);

  const status = (clinic as any)?.subscription_status as string | undefined;
  const trialEndsAt = (clinic as any)?.trial_ends_at as string | undefined;
  const subscriptionEndsAt = (clinic as any)?.subscription_ends_at as string | undefined;
  const currentPlan = (clinic as any)?.plan_tier as string | undefined;
  const currentCycle = (clinic as any)?.billing_cycle as string | undefined;
  const maxPatients = (clinic as any)?.max_patients_allowed as number | undefined;

  const trialDaysLeft = useMemo(() => {
    if (!trialEndsAt) return 0;
    const diff = new Date(trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [trialEndsAt]);

  const isActive = status === "active" || status === "trial";
  const isExpired = status === "trial" && trialDaysLeft === 0;
  const isPastDue = status === "past_due" || status === "cancelled" || status === "disabled";

  useEffect(() => {
    loadRazorpayScript().catch(() => {
      // Script will be loaded lazily on checkout click as fallback
    });
  }, []);

  useEffect(() => {
    if (currentPlan) setPlanTier(currentPlan as "pro" | "custom");
    if (currentCycle) setBillingCycle(currentCycle as "monthly" | "annual");
  }, [currentPlan, currentCycle]);

  const handleCheckout = async () => {
    if (!clinic?.id || !profile?.user_id) return;
    setLoading(true);
    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        toast.error("Unable to load Razorpay checkout. Please check your internet connection and try again.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("razorpay-checkout", {
        body: {
          clinic_id: clinic.id,
          plan_tier: planTier,
          billing_cycle: billingCycle,
          user_id: profile.user_id,
        },
      });
      if (error) throw error;
      if (!data?.order_id || !data?.key_id || !data?.amount) {
        throw new Error("Invalid checkout response");
      }

      const win = window as any;
      const rzp = new win.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "FlowCare",
        description: `${planTier === "custom" ? "Custom" : "Pro"} plan — ${billingCycle}`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            const verify = await supabase.functions.invoke("razorpay-verify", {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            if (verify.error) throw verify.error;
            toast.success("Payment successful! Your subscription is active.");
            refetch();
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
          }
        },
        prefill: {
          email: session?.user?.email || "",
        },
        theme: { color: "#0F172A" },
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Unable to start checkout");
    } finally {
      setLoading(false);
    }
  };

  const price = PLAN_PRICING[planTier][billingCycle];
  const limit = PLAN_PATIENT_LIMITS[planTier];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">Subscription</h1>
          <p className="mt-2 text-muted-foreground">Manage your FlowCare plan and billing</p>
        </div>

        {isActive && status === "trial" && (
          <Card className="mb-6 border-warning/30 bg-warning/10">
            <CardContent className="py-4">
              <p className="text-sm text-foreground">
                You are on a 7-day free trial. {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} remaining.
              </p>
            </CardContent>
          </Card>
        )}

        {(isExpired || isPastDue) && (
          <Card className="mb-6 border-destructive/30 bg-destructive/10">
            <CardContent className="py-4">
              <p className="text-sm text-foreground">
                Your subscription has expired or is inactive. Please choose a plan to continue using FlowCare.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="font-display">Choose a plan</CardTitle>
              <CardDescription>Monthly and annual billing available. Annual includes 2 months free.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={planTier}
                onValueChange={(v) => setPlanTier(v as "pro" | "custom")}
                className="grid gap-4 md:grid-cols-2"
              >
                <div>
                  <RadioGroupItem value="pro" id="pro" className="peer sr-only" />
                  <Label
                    htmlFor="pro"
                    className="flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-primary"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold">Pro</span>
                      <Crown className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Core clinic management without treatment module.</p>
                    <div className="mt-3 text-lg font-bold">₹{PLAN_PRICING.pro.monthly.toLocaleString("en-IN")}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                    <div className="text-xs text-muted-foreground">Up to {PLAN_PATIENT_LIMITS.pro.toLocaleString("en-IN")} patients</div>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="custom" id="custom" className="peer sr-only" />
                  <Label
                    htmlFor="custom"
                    className="flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-primary"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold">Custom</span>
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Includes treatment module and higher patient limits.</p>
                    <div className="mt-3 text-lg font-bold">₹{PLAN_PRICING.custom.monthly.toLocaleString("en-IN")}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                    <div className="text-xs text-muted-foreground">Up to {PLAN_PATIENT_LIMITS.custom.toLocaleString("en-IN")} patients</div>
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex items-center gap-4 rounded-xl border p-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Billing cycle</Label>
                  <p className="text-xs text-muted-foreground">Switch between monthly and annual billing.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={billingCycle === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBillingCycle("monthly")}
                  >
                    <Calendar className="mr-1 h-3 w-3" /> Monthly
                  </Button>
                  <Button
                    variant={billingCycle === "annual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBillingCycle("annual")}
                  >
                    Annual
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total due today</span>
                  <span className="text-2xl font-bold">₹{price.toLocaleString("en-IN")}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {billingCycle === "annual" ? "Billed annually" : "Billed monthly"} · GST extra as applicable
                </p>
              </div>

              <Button onClick={handleCheckout} disabled={loading || !clinic} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {status === "active" ? "Update plan" : "Subscribe now"}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Current status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="capitalize font-medium">{status?.replace("_", " ") || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current plan</span>
                  <span className="capitalize font-medium">{currentPlan || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="capitalize font-medium">{currentCycle || "—"}</span>
                </div>
                {trialEndsAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trial ends</span>
                    <span>{new Date(trialEndsAt).toLocaleDateString("en-IN")}</span>
                  </div>
                )}
                {subscriptionEndsAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next billing</span>
                    <span>{new Date(subscriptionEndsAt).toLocaleDateString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Patients</span>
                  <span>{(patientCount || 0).toLocaleString("en-IN")} / {((maxPatients ?? limit) || limit).toLocaleString("en-IN")}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Plan includes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  "Patient management",
                  "Appointments & calendar",
                  "Billing & invoices",
                  "Clinical notes & prescriptions",
                  "WhatsApp reminders",
                  ...(planTier === "custom" ? ["Treatment module", "Therapist mobile app", "Review collection"] : []),
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
