import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Upload, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  normalizeAlcohol,
  normalizeSmoking,
  normalizeFoodHabits,
} from "@/lib/lifestyleNormalize";
import {
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  MAX_PUBLIC_DOC_SIZE_MB,
  MAX_PUBLIC_DOC_COUNT,
  formatFileSize,
} from "@/lib/documentCategories";

const PUBLIC_DOC_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ALCOHOL_OPTIONS = [
  { value: "none", label: "None / Never" },
  { value: "occasional", label: "Occasional" },
  { value: "regular", label: "Regular" },
];
const SMOKING_OPTIONS = [
  { value: "non_smoker", label: "Non Smoker" },
  { value: "occasional", label: "Occasional" },
  { value: "regular", label: "Regular" },
];
const FOOD_OPTIONS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "non_vegetarian", label: "Non Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "eggetarian", label: "Eggetarian" },
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export default function PatientFormPublic() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [docs, setDocs] = useState<{ file: File; category: DocumentCategory }[]>([]);

  const addDocs = (files: FileList | null) => {
    if (!files) return;
    const next = [...docs];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_PUBLIC_DOC_COUNT) {
        toast.error(`Max ${MAX_PUBLIC_DOC_COUNT} files`);
        break;
      }
      if (!PUBLIC_DOC_MIME.includes(f.type)) {
        toast.error(`${f.name}: only PDF, JPG, PNG allowed`);
        continue;
      }
      if (f.size > MAX_PUBLIC_DOC_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name} exceeds ${MAX_PUBLIC_DOC_SIZE_MB}MB`);
        continue;
      }
      next.push({ file: f, category: "Medical Report" });
    }
    setDocs(next);
  };

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("validate-patient-token", {
          body: { token },
        });
        if (error || !data || data.error || !data.patient) {
          setLoading(false);
          return;
        }
        setPatient(data.patient);
        setClinic(data.clinic ?? null);
        setValid(true);
      } catch {
        // fall through to invalid
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md rounded-xl border bg-card p-8 text-center">
          <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <h1 className="font-display text-xl font-semibold">Link invalid or expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This link is invalid or has expired. Please contact your clinic for a new link.
          </p>
          {clinic?.name && <p className="mt-3 text-sm font-medium">{clinic.name}</p>}
          {clinic?.phone && <p className="text-xs text-muted-foreground">📞 {clinic.phone}</p>}
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md rounded-xl border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-[#1D9E75]" />
          <h1 className="font-display text-xl font-semibold">
            Thank you, {patient?.first_name}!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your details have been updated. We look forward to seeing you at{" "}
            {clinic?.name ?? "the clinic"}.
          </p>
          {clinic?.phone && (
            <p className="mt-3 text-xs text-muted-foreground">📞 {clinic.phone}</p>
          )}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const updates: Record<string, any> = {};
    fd.forEach((v, k) => {
      if (v) updates[k] = v.toString();
    });

    // Normalize lifestyle values to satisfy DB check constraints
    const alc = normalizeAlcohol(updates.alcohol);
    const smk = normalizeSmoking(updates.smoking);
    const food = normalizeFoodHabits(updates.food_habits);
    if (alc === null) delete updates.alcohol; else updates.alcohol = alc;
    if (smk === null) delete updates.smoking; else updates.smoking = smk;
    if (food === null) delete updates.food_habits; else updates.food_habits = food;

    // Encode documents as base64
    let documents: any[] = [];
    if (docs.length > 0) {
      try {
        documents = await Promise.all(
          docs.map(async (d) => ({
            name: d.file.name,
            type: d.file.type,
            category: d.category,
            dataBase64: await fileToBase64(d.file),
          })),
        );
      } catch {
        toast.error("Failed to read files");
        setSubmitting(false);
        return;
      }
    }

    const { data, error } = await supabase.functions.invoke("submit-patient-form", {
      body: { token, updates, documents },
    });
    if (error || !data || data.error || data.success !== true) {
      toast.error(data?.error === "invalid_or_expired"
        ? "This link is invalid or has expired."
        : (error?.message ?? data?.error ?? "Failed to submit."));
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-2xl space-y-4 px-4">
        <div className="rounded-xl border bg-card p-6">
          <h1 className="font-display text-2xl font-semibold">{clinic?.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Please update your details below. Changes will be saved to your patient record.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Personal</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="first_name" label="First Name" defaultValue={patient.first_name} />
            <Field name="last_name" label="Last Name" defaultValue={patient.last_name} />
            <Field
              name="dob"
              type="date"
              label="Date of Birth"
              defaultValue={patient.dob}
            />
            <SelectField
              name="gender"
              label="Gender"
              defaultValue={patient.gender}
              options={["Male", "Female", "Other"]}
            />
            <SelectField
              name="blood_group"
              label="Blood Group"
              defaultValue={patient.blood_group}
              options={BLOOD_GROUPS}
            />
            <Field name="email" type="email" label="Email" defaultValue={patient.email} />
          </div>

          <h2 className="font-display text-lg font-semibold pt-4">Contact</h2>
          <TextareaField name="address" label="Address" defaultValue={patient.address} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              name="emergency_contact_name"
              label="Emergency Contact"
              defaultValue={patient.emergency_contact_name}
            />
            <Field
              name="emergency_contact_phone"
              label="Emergency Phone"
              defaultValue={patient.emergency_contact_phone}
            />
            <Field
              name="emergency_contact_relation"
              label="Relation"
              defaultValue={patient.emergency_contact_relation}
            />
          </div>

          <h2 className="font-display text-lg font-semibold pt-4">Lifestyle</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              name="food_habits"
              label="Food Habits"
              defaultValue={patient.food_habits}
              options={FOOD_OPTIONS}
            />
            <SelectField
              name="smoking"
              label="Smoking"
              defaultValue={patient.smoking}
              options={SMOKING_OPTIONS}
            />
            <SelectField
              name="alcohol"
              label="Alcohol"
              defaultValue={patient.alcohol}
              options={ALCOHOL_OPTIONS}
            />
            <Field
              name="sleep_hours"
              type="number"
              label="Sleep Hours"
              defaultValue={patient.sleep_hours}
            />
            <Field
              name="dinner_time"
              type="time"
              label="Dinner Time"
              defaultValue={patient.dinner_time}
            />
            <Field
              name="convenient_time"
              label="Convenient Call Time"
              defaultValue={patient.convenient_time}
            />
          </div>

          <h2 className="font-display text-lg font-semibold pt-4">Medical History</h2>
          <TextareaField
            name="medication_history"
            label="Current Medications"
            defaultValue={patient.medication_history}
          />
          <TextareaField
            name="past_surgery_details"
            label="Past Surgery Details"
            defaultValue={patient.past_surgery_details}
          />

          <h2 className="font-display text-lg font-semibold pt-4">Upload Your Documents (Optional)</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Medical reports, prescriptions, or any relevant documents. PDF/JPG/PNG, max {MAX_PUBLIC_DOC_SIZE_MB}MB each, up to {MAX_PUBLIC_DOC_COUNT} files.
          </p>
          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 p-6 cursor-pointer hover:border-muted-foreground/50">
            <Upload className="h-7 w-7 text-muted-foreground mb-1.5" />
            <span className="text-sm font-medium">Tap to choose files</span>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => { addDocs(e.target.files); e.target.value = ""; }}
              disabled={docs.length >= MAX_PUBLIC_DOC_COUNT}
            />
          </label>
          {docs.length > 0 && (
            <div className="space-y-2">
              {docs.map((d, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{d.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(d.file.size)}</p>
                  </div>
                  <SelectField
                    name={`__doc_cat_${i}`}
                    label=""
                    defaultValue={d.category}
                    options={DOCUMENT_CATEGORIES as any}
                    onChange={(v) => setDocs((s) => s.map((x, idx) => idx === i ? { ...x, category: v as DocumentCategory } : x))}
                  />
                  <button
                    type="button"
                    onClick={() => setDocs((s) => s.filter((_, idx) => idx !== i))}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Badge variant="outline" className="text-xs">{docs.length} / {MAX_PUBLIC_DOC_COUNT} files</Badge>
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full" size="lg">
            {submitting ? "Saving..." : "Save My Details"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: any;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input name={name} type={type} defaultValue={defaultValue ?? ""} />
    </div>
  );
}

function TextareaField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: any;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea name={name} defaultValue={defaultValue ?? ""} rows={3} />
    </div>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: any;
  options: Array<string | { value: string; label: string }>;
}) {
  const normalized = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  const [val, setVal] = useState<string>(defaultValue ?? "");
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <input type="hidden" name={name} value={val} />
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {normalized.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
