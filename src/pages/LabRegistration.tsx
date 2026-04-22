import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, FlaskConical } from "lucide-react";

const TEST_CATEGORIES = [
  "Blood Tests",
  "Urine Tests",
  "Imaging / X-ray",
  "MRI / CT Scan",
  "Ultrasound",
  "Pathology / Biopsy",
  "Microbiology / Culture",
  "Cardiology (ECG, Echo)",
  "Genetic Testing",
  "COVID / Infectious Disease",
  "Hormone / Endocrine",
  "Allergy Testing",
];

export default function LabRegistration() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    operating_hours: "",
    tests_offered_other: "",
  });
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const toggleTest = (test: string) => {
    setSelectedTests(prev =>
      prev.includes(test) ? prev.filter(t => t !== test) : [...prev, test]
    );
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Lab name is required"); return; }
    if (!form.email.trim()) { setError("Email is required"); return; }
    if (!form.phone.trim()) { setError("Phone is required"); return; }
    if (!form.address.trim()) { setError("Address is required"); return; }
    if (selectedTests.length === 0) { setError("Select at least one test category"); return; }

    setIsSubmitting(true);
    setError("");
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("invite-staff", {
        body: {
          mode: "self_register_lab",
          ...form,
          tests_offered: selectedTests,
        },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-elevated p-8 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-2xl font-bold text-foreground">Registration Submitted</h2>
          <p className="text-sm text-muted-foreground">
            We have sent a login link to <span className="font-medium text-foreground">{form.email}</span>.
            Click the link to set your password and access your lab portal.
          </p>
          <p className="text-xs text-muted-foreground">
            Your lab will appear in the StethoScribe directory after verification.
            Clinics can still add you and send orders immediately.
          </p>
          <Link to="/" className="inline-block mt-2 text-sm text-primary hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <FlaskConical className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Register Your Lab</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Join the StethoScribe network. Receive digital lab orders from clinics
            and send results directly to doctors.
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-elevated p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-foreground mb-3">Lab Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">Lab Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. City Diagnostics & Lab"
                  className="w-full mt-1 border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="lab@example.com"
                  className="w-full mt-1 border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Phone *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full mt-1 border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">Address *</label>
                <textarea
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Full address including city and pincode"
                  rows={2}
                  className="w-full mt-1 border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">Operating Hours</label>
                <input
                  type="text"
                  value={form.operating_hours}
                  onChange={e => setForm(p => ({ ...p, operating_hours: e.target.value }))}
                  placeholder="e.g. Mon-Sat 7am-9pm, Sun 8am-2pm"
                  className="w-full mt-1 border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">
              Tests Offered <span className="text-destructive">*</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {TEST_CATEGORIES.map(test => (
                <button
                  type="button"
                  key={test}
                  onClick={() => toggleTest(test)}
                  className={`text-left text-xs px-3 py-2.5 rounded-lg border transition-all ${
                    selectedTests.includes(test)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:border-primary/50"
                  }`}
                >
                  {selectedTests.includes(test) ? "✓ " : ""}{test}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-sm font-medium text-foreground">Other tests (optional)</label>
              <input
                type="text"
                value={form.tests_offered_other}
                onChange={e => setForm(p => ({ ...p, tests_offered_other: e.target.value }))}
                placeholder="e.g. Fertility Panel, Tumor Markers, Drug Testing..."
                className="w-full mt-1 border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Register Lab & Receive Login Link
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Already registered?{" "}
            <Link to="/auth" className="text-primary hover:underline">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
