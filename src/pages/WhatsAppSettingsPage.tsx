import { useCallback, useEffect, useState } from "react";
import SettingsShell from "@/components/layout/SettingsShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw, Send } from "lucide-react";

type Mode = "default" | "own_number";

const TEMPLATE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "template_booked", label: "Booking confirmation", hint: "Name, clinic, date, time, practitioner" },
  { key: "template_rescheduled", label: "Reschedule notice", hint: "Name, clinic, new date, new time, practitioner" },
  { key: "template_cancelled", label: "Cancellation notice", hint: "Name, clinic, date, time, practitioner" },
  { key: "template_reminder", label: "Appointment reminder", hint: "Name, clinic, date, time, practitioner" },
  { key: "template_review", label: "Therapy review request", hint: "Name, clinic, therapy, therapist, review link" },
  { key: "template_followup", label: "Follow-up care message", hint: "Name, clinic" },
];

const MODE_OPTIONS: { value: Mode; title: string; body: string }[] = [
  {
    value: "default",
    title: "Use FlowCare's WhatsApp number",
    body: "Messages go out from our shared business number. Nothing to set up.",
  },
  {
    value: "own_number",
    title: "Use our own number (managed by FlowCare)",
    body: "Your number sends the messages, but we handle the WhatsApp account and billing. Tell us the number and we'll register it for you.",
  },
];

type Settings = {
  mode: Mode;
  from_number: string;
  verified_at: string | null;
} & Record<string, any>;

const EMPTY: Settings = {
  mode: "default",
  from_number: "",
  verified_at: null,
  template_booked: "",
  template_rescheduled: "",
  template_cancelled: "",
  template_reminder: "",
  template_review: "",
  template_followup: "",
};

export default function WhatsAppSettingsPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [s, setS] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("clinic_whatsapp_settings" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (data) {
        const row = data as any;
        setS({
          ...EMPTY,
          ...Object.fromEntries(
            TEMPLATE_FIELDS.map((f) => [f.key, row[f.key] ?? ""]),
          ),
          mode: (row.mode as Mode) ?? "default",
          from_number: row.from_number ?? "",
          verified_at: row.verified_at ?? null,
        });
      } else {
        setS(EMPTY);
      }
    } catch {
      // non-critical
    }
    setLoading(false);
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("clinic-whatsapp-settings", { body });
    if (error) {
      let detail = error.message;
      try {
        detail = await (error as any).context?.text?.();
      } catch {
        // keep the original message
      }
      let parsed: any = null;
      try {
        parsed = JSON.parse(detail);
      } catch {
        // plain text
      }
      throw new Error(parsed?.error || parsed?.details || detail || "Something went wrong");
    }
    return data as any;
  };

  const save = async () => {
    setSaving(true);
    try {
      await call({
        action: "save",
        mode: s.mode,
        from_number: s.from_number,
        ...Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f.key, s[f.key] ?? ""])),
      });
      toast.success("WhatsApp settings saved");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    }
    setSaving(false);
  };

  const reset = async () => {
    setSaving(true);
    try {
      await call({ action: "reset" });
      toast.success("Reverted to FlowCare's WhatsApp number");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not reset");
    }
    setSaving(false);
  };

  const sendTest = async () => {
    if (!testPhone.trim()) {
      toast.error("Enter a number to send the test to");
      return;
    }
    setTesting(true);
    try {
      const res = await call({ action: "test", to_phone: testPhone, event: "booked" });
      toast.success(`Test message sent from ${res.from}`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Test failed");
    }
    setTesting(false);
  };

  const missingTemplates = TEMPLATE_FIELDS.filter((f) => !String(s[f.key] ?? "").trim());
  const usesOwn = s.mode !== "default";

  return (
    <SettingsShell title="WhatsApp">
      {loading ? (
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Which number sends your messages</h2>
                {s.verified_at && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Test passed
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                {MODE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setS((p) => ({ ...p, mode: o.value }))}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      s.mode === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="text-sm font-medium">{o.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{o.body}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {usesOwn && (
            <Card>
              <CardContent className="space-y-4 p-4">
                <h2 className="text-sm font-semibold">Your WhatsApp number</h2>
                <div className="space-y-1.5">
                  <Label htmlFor="from">Sender number (with country code)</Label>
                  <Input
                    id="from"
                    placeholder="+91 90000 00000"
                    value={s.from_number}
                    onChange={(e) => setS((p) => ({ ...p, from_number: e.target.value }))}
                  />
                </div>

              </CardContent>
            </Card>
          )}

          {usesOwn && (
            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <h2 className="text-sm font-semibold">Your approved message IDs</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Get each message approved in your own WhatsApp account, then paste its ID here. Anything left
                    blank keeps using FlowCare's number for that message type.
                  </p>
                </div>
                {TEMPLATE_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key}>{f.label}</Label>
                    <Input
                      id={f.key}
                      placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={s[f.key] ?? ""}
                      onChange={(e) => setS((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Fill-ins, in order: {f.hint}</p>
                  </div>
                ))}
                {missingTemplates.length > 0 && (
                  <p className="text-xs text-amber-600">
                    Still using FlowCare's number for: {missingTemplates.map((f) => f.label).join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save settings
            </Button>
            <Button variant="outline" onClick={reset} disabled={saving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Use FlowCare's number
            </Button>
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold">Send a test message</h2>
              <p className="text-xs text-muted-foreground">
                Sends a sample booking confirmation using the settings above, so you can confirm it works before real
                patients receive anything.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="+91 90000 00000"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <Button variant="secondary" onClick={sendTest} disabled={testing}>
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send test
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </SettingsShell>
  );
}
