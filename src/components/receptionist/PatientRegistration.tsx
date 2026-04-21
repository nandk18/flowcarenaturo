import { useState, useCallback, useRef, KeyboardEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Search, UserPlus, X, ArrowLeft, AlertTriangle } from "lucide-react";

type PatientResult = {
  id: string;
  name: string;
  healthcare_id: string | null;
  dob: string | null;
  phone: string | null;
  gender: string | null;
  blood_group: string | null;
  allergies: any;
  chronic_conditions: any;
};

type Step = "search" | "new" | "checkin";

export default function PatientRegistration({ onSuccess }: { onSuccess?: () => void } = {}) {
  const { profile, user } = useAuth();
  const [step, setStep] = useState<Step>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [saving, setSaving] = useState(false);

  // New patient fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState("");
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [chronicInput, setChronicInput] = useState("");

  // Check-in fields
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [temp, setTemp] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [spo2, setSpo2] = useState("");

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2 || !profile?.clinic_id) { setSearchResults([]); return; }
    setSearching(true);

    try {
      const isHealthcareId = /^MED-\d{4}-\d+$/i.test(query);
      const isDate = /^\d{2}\/\d{2}\/\d{4}$/.test(query) || /^\d{4}-\d{2}-\d{2}$/.test(query);

      let results: any[] = [];

      if (isHealthcareId) {
        const { data } = await supabase
          .from("patients")
          .select("id, name, healthcare_id, dob, phone, gender, blood_group, allergies, chronic_conditions")
          .eq("clinic_id", profile.clinic_id)
          .ilike("healthcare_id", query)
          .limit(5);
        results = data ?? [];
      } else if (isDate) {
        let dateStr = query;
        if (query.includes("/")) {
          const parts = query.split("/");
          dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        const { data } = await supabase
          .from("patients")
          .select("id, name, healthcare_id, dob, phone, gender, blood_group, allergies, chronic_conditions")
          .eq("clinic_id", profile.clinic_id)
          .eq("dob", dateStr)
          .order("last_name", { ascending: true })
          .limit(10);
        results = data ?? [];
      } else {
        const { data } = await supabase
          .from("patients")
          .select("id, name, healthcare_id, dob, phone, gender, blood_group, allergies, chronic_conditions")
          .eq("clinic_id", profile.clinic_id)
          .or(`name.ilike.%${query}%,phone.ilike.%${query}%,healthcare_id.ilike.%${query}%`)
          .limit(8);
        results = data ?? [];
      }

      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [profile?.clinic_id]);

  const selectPatientForCheckin = (patient: PatientResult) => {
    setSelectedPatient(patient);
    setStep("checkin");
  };

  const createVisitForPatient = async (patientId: string, patientName: string) => {
    if (!profile?.clinic_id) return;
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: existingVisit } = await supabase
        .from("visits")
        .select("id")
        .eq("clinic_id", profile.clinic_id)
        .eq("patient_id", patientId)
        .eq("visit_date", today)
        .in("status", ["waiting", "in_progress"])
        .limit(1);

      if (existingVisit && existingVisit.length > 0) {
        toast.error("Patient already in today's queue");
        return;
      }

      const { count } = await supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id)
        .eq("visit_date", today);

      const tokenNumber = (count ?? 0) + 1;
      const vitals: any = {};
      if (bpSystolic && bpDiastolic) vitals.bp = { systolic: +bpSystolic, diastolic: +bpDiastolic };
      if (pulse) vitals.pulse = +pulse;
      if (temp) vitals.temperature = +temp;
      if (weight) vitals.weight = +weight;
      if (height) vitals.height = +height;
      if (spo2) vitals.spo2 = +spo2;

      const { error } = await supabase.from("visits").insert({
        clinic_id: profile.clinic_id,
        patient_id: patientId,
        visit_date: today,
        token_number: tokenNumber,
        chief_complaint: chiefComplaint || null,
        vitals,
        created_by: user!.id,
      });
      if (error) throw error;
      toast.success(`Token #${tokenNumber} issued for ${patientName}`);
      resetForm();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleNewPatient = async () => {
    if (!firstName.trim() || !profile?.clinic_id) { toast.error("First name is required"); return; }
    if (!dob) { toast.error("Date of birth is required"); return; }
    setSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { data: patient, error } = await supabase
        .from("patients")
        .insert({
          clinic_id: profile.clinic_id,
          name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dob: dob || null,
          gender: gender || null,
          phone: phone || null,
          email: email || null,
          blood_group: bloodGroup || null,
          allergies: allergies.length > 0 ? allergies : [],
          chronic_conditions: chronicConditions.length > 0 ? chronicConditions : [],
        })
        .select("id, name, healthcare_id")
        .single();
      if (error) throw error;
      toast.success(`Patient registered. Healthcare ID: ${patient.healthcare_id}`);
      // Move to check-in step
      setSelectedPatient({ ...patient, dob, phone, gender, blood_group: bloodGroup, allergies, chronic_conditions: chronicConditions } as PatientResult);
      setStep("checkin");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckin = async () => {
    if (!selectedPatient) return;
    if (!chiefComplaint.trim()) { toast.error("Chief complaint is required"); return; }
    setSaving(true);
    try {
      await createVisitForPatient(selectedPatient.id, selectedPatient.name);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFirstName(""); setLastName(""); setDob(""); setGender(""); setPhone(""); setEmail("");
    setBloodGroup(""); setAllergies([]); setAllergyInput(""); setChronicConditions([]); setChronicInput("");
    setChiefComplaint("");
    setBpSystolic(""); setBpDiastolic(""); setPulse(""); setTemp("");
    setWeight(""); setHeight(""); setSpo2("");
    setStep("search"); setSearchQuery(""); setSearchResults([]); setSelectedPatient(null);
  };

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>, value: string, setter: (v: string) => void, list: string[], listSetter: (v: string[]) => void) => {
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      if (!list.includes(value.trim())) {
        listSetter([...list, value.trim()]);
      }
      setter("");
    }
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  // ── STEP: SEARCH ──
  if (step === "search") {
    return (
      <div className="space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> Register & Queue Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Search by: Healthcare ID | DOB | Name</Label>
              <Input
                placeholder="MED-2026-00001, 15/03/1990, or patient name..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                autoFocus
              />
            </div>

            {searching && <p className="text-xs text-muted-foreground">Searching...</p>}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.healthcare_id && <span className="font-mono text-primary">{p.healthcare_id}</span>}
                        {p.dob && ` · DOB: ${p.dob}`}
                        {p.phone && ` · ${p.phone}`}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => selectPatientForCheckin(p)}>Select</Button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No patients found</p>
            )}

            <Separator />

            <Button variant="outline" onClick={() => setStep("new")} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" /> Register New Patient
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── STEP: NEW PATIENT FORM ──
  if (step === "new") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Search
        </Button>
        <Card className="shadow-card animate-fade-in">
          <CardHeader>
            <CardTitle className="font-display text-lg">New Patient Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth *</Label>
                <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Select value={bloodGroup} onValueChange={setBloodGroup}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Allergies tag input */}
            <div className="space-y-2">
              <Label>Allergies</Label>
              <div className="flex flex-wrap gap-1.5 mb-1">
                {allergies.map(a => (
                  <Badge key={a} variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-xs">
                    {a}
                    <button type="button" onClick={() => setAllergies(prev => prev.filter(x => x !== a))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={allergyInput}
                onChange={e => setAllergyInput(e.target.value)}
                onKeyDown={e => handleTagKey(e, allergyInput, setAllergyInput, allergies, setAllergies)}
                placeholder="Type allergy and press Enter"
              />
            </div>

            {/* Chronic conditions tag input */}
            <div className="space-y-2">
              <Label>Chronic Conditions</Label>
              <div className="flex flex-wrap gap-1.5 mb-1">
                {chronicConditions.map(c => (
                  <Badge key={c} variant="outline" className="border-warning/30 bg-warning/10 text-warning text-xs">
                    {c}
                    <button type="button" onClick={() => setChronicConditions(prev => prev.filter(x => x !== c))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={chronicInput}
                onChange={e => setChronicInput(e.target.value)}
                onKeyDown={e => handleTagKey(e, chronicInput, setChronicInput, chronicConditions, setChronicConditions)}
                placeholder="Type condition and press Enter"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleNewPatient} disabled={saving} className="flex-1">
                {saving ? "Registering..." : "Register Patient"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── STEP: CHECK-IN (returning or just-registered patient) ──
  if (step === "checkin" && selectedPatient) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Search
        </Button>

        {/* Patient summary card */}
        <Card className="shadow-card border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-sm font-bold text-primary">
                {selectedPatient.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-foreground">{selectedPatient.name}</h3>
                {selectedPatient.healthcare_id && (
                  <p className="font-mono text-xs text-primary">{selectedPatient.healthcare_id}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedPatient.gender}{selectedPatient.dob && ` · DOB: ${selectedPatient.dob} (${getAge(selectedPatient.dob)}y)`}
                  {selectedPatient.blood_group && ` · ${selectedPatient.blood_group}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedPatient.allergies && Array.isArray(selectedPatient.allergies) && (selectedPatient.allergies as string[]).map((a: string) => (
                    <Badge key={a} variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                      <AlertTriangle className="mr-0.5 h-2.5 w-2.5" /> {a}
                    </Badge>
                  ))}
                  {selectedPatient.chronic_conditions && Array.isArray(selectedPatient.chronic_conditions) && (selectedPatient.chronic_conditions as string[]).map((c: string) => (
                    <Badge key={c} variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Check-in form */}
        <Card className="shadow-card animate-fade-in">
          <CardHeader>
            <CardTitle className="font-display text-lg">Check-In & Vitals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Chief Complaint *</Label>
              <Input value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="Fever, headache..." />
            </div>

            <div>
              <Label className="mb-3 block text-sm font-semibold">Vitals</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">BP (sys/dia)</Label>
                  <div className="flex gap-1">
                    <Input placeholder="120" value={bpSystolic} onChange={e => setBpSystolic(e.target.value)} className="text-center" />
                    <span className="self-center text-muted-foreground">/</span>
                    <Input placeholder="80" value={bpDiastolic} onChange={e => setBpDiastolic(e.target.value)} className="text-center" />
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Pulse (bpm)</Label><Input placeholder="72" value={pulse} onChange={e => setPulse(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Temp (°F)</Label><Input placeholder="98.6" value={temp} onChange={e => setTemp(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">SpO2 (%)</Label><Input placeholder="98" value={spo2} onChange={e => setSpo2(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Weight (kg)</Label><Input placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Height (cm)</Label><Input placeholder="170" value={height} onChange={e => setHeight(e.target.value)} /></div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleCheckin} disabled={saving} className="flex-1">
                {saving ? "Checking in..." : "Check In & Issue Token"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
