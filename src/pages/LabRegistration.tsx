import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FlaskConical, CheckCircle, Loader2 } from "lucide-react";

export default function LabRegistration() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [tests, setTests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Lab name is required"); return; }
    setSubmitting(true);
    try {
      // Public self-registration: external + unverified
      const { error } = await supabase.from("labs").insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: [address.trim(), tests.trim() ? `Tests offered: ${tests.trim()}` : ""].filter(Boolean).join("\n") || null,
        type: "external",
        verified: false,
        clinic_id: null,
      });
      if (error) throw error;
      setDone(true);
      toast.success("Lab registered. Clinics can now find and add you.");
    } catch (err: any) {
      toast.error(err.message || "Registration failed. You may need to be signed in.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center shadow-elevated">
          <CardContent className="py-10 space-y-4">
            <CheckCircle className="h-16 w-16 text-success mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Registration Submitted</h2>
            <p className="text-muted-foreground">
              Your lab is now visible to clinics in the StethoScribe directory. An admin can verify your lab to display the verified badge.
            </p>
            <Link to="/auth"><Button>Back to Sign In</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <FlaskConical className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Register your Lab</h1>
          <p className="text-sm text-muted-foreground mt-2">Join the StethoScribe lab directory and start receiving orders from clinics.</p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Lab Details</CardTitle>
            <CardDescription>This information will be visible to clinics on StethoScribe.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Lab Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunrise Diagnostics" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="orders@yourlab.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91…" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} placeholder="Street, City, State, Pincode" />
              </div>
              <div className="space-y-2">
                <Label>Tests Offered</Label>
                <Textarea value={tests} onChange={e => setTests(e.target.value)} rows={2}
                  placeholder="e.g. CBC, LFT, RFT, MRI, X-ray…" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering…</> : "Submit Registration"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Already have an account? <Link to="/auth" className="text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
