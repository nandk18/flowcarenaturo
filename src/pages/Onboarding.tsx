import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, User, PenTool, Send, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const steps = [
  { title: "Clinic Details", icon: Building2, description: "Set up your clinic information" },
  { title: "Doctor Profile", icon: User, description: "Add your medical credentials" },
  { title: "E-Signature", icon: PenTool, description: "Create your digital signature" },
  { title: "Invite Staff", icon: Send, description: "Add your team members" },
];

export default function Onboarding() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dpaAccepted, setDpaAccepted] = useState(false);

  // Clinic details
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");

  // Doctor profile
  const [doctorName, setDoctorName] = useState("");
  const [qualification, setQualification] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [specialty, setSpecialty] = useState("");

  const handleClinicSubmit = async () => {
    if (!clinicName.trim()) { toast.error("Clinic name is required"); return; }
    setLoading(true);
    try {
      const { data: clinicId, error } = await supabase.rpc('complete_clinic_onboarding', {
        p_clinic_name: clinicName,
        p_clinic_address: clinicAddress || null,
        p_clinic_phone: clinicPhone || null,
      });
      if (error) throw error;

      toast.success("Clinic created!");
      setStep(1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSubmit = async () => {
    if (!doctorName.trim()) { toast.error("Doctor name is required"); return; }
    setLoading(true);
    try {
      // Refetch profile to get clinic_id
      const { data: prof } = await supabase.from("profiles").select("clinic_id").eq("user_id", user!.id).single();
      if (!prof?.clinic_id) throw new Error("No clinic found");

      const { error } = await supabase
        .from("doctors")
        .insert({
          clinic_id: prof.clinic_id,
          user_id: user!.id,
          name: doctorName,
          qualification,
          registration_number: regNumber,
          specialty,
        });
      if (error) throw error;

      // Admin-only app — no extra role insert needed.

      toast.success("Doctor profile saved!");
      setStep(2);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureSkip = () => {
    toast.info("You can add your signature later from settings.");
    setStep(3);
  };

  const handleComplete = async () => {
    if (!dpaAccepted) {
      toast.error("Please accept the Data Processing Agreement to continue");
      return;
    }
    setLoading(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("clinic_id").eq("user_id", user!.id).single();
      if (prof?.clinic_id) {
        await supabase.from("clinics").update({ onboarding_complete: true }).eq("id", prof.clinic_id);
      }
      toast.success("Setup complete! Welcome to FlowCare.");
      navigate("/dashboard");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">Set Up Your Practice</h1>
          <p className="mt-2 text-muted-foreground">Complete these steps to get started</p>
        </div>

        {/* Step indicators */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 w-8 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              {(() => { const Icon = steps[step].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
              {steps[step].title}
            </CardTitle>
            <CardDescription>{steps[step].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2"><Label>Clinic Name *</Label><Input placeholder="City Medical Center" value={clinicName} onChange={e => setClinicName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Address</Label><Input placeholder="123 Main St, City" value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input placeholder="+91 98765 43210" value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} /></div>
                <Button onClick={handleClinicSubmit} disabled={loading} className="w-full">
                  {loading ? "Saving..." : "Continue"} <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2"><Label>Doctor Name *</Label><Input placeholder="Dr. Sharma" value={doctorName} onChange={e => setDoctorName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Qualification</Label><Input placeholder="MBBS, MD" value={qualification} onChange={e => setQualification(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Specialty</Label><Input placeholder="General Medicine" value={specialty} onChange={e => setSpecialty(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Registration Number</Label><Input placeholder="MCI-123456" value={regNumber} onChange={e => setRegNumber(e.target.value)} /></div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(0)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={handleDoctorSubmit} disabled={loading} className="flex-1">
                    {loading ? "Saving..." : "Continue"} <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-dashed border-border bg-muted/50 p-12 text-center">
                  <PenTool className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Signature capture coming soon.<br />You can skip this step for now.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={handleSignatureSkip} className="flex-1">
                    Skip & Continue <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-dashed border-border bg-muted/50 p-12 text-center">
                  <Send className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Staff invitations coming soon.<br />You can add staff members later from settings.</p>
                </div>
                <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-border p-3 bg-muted/20">
                  <input
                    type="checkbox"
                    checked={dpaAccepted}
                    onChange={e => setDpaAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    I accept the{" "}
                    <Link to="/dpa" target="_blank" className="text-primary underline">Data Processing Agreement</Link>
                    {" "}on behalf of my clinic
                  </span>
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={handleComplete} disabled={loading || !dpaAccepted} className="flex-1">
                    {loading ? "Completing..." : "Complete Setup"} <Check className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
