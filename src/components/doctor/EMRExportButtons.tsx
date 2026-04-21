import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ClipboardCopy, FileJson, FileSpreadsheet } from "lucide-react";

type Props = {
  patient: { name: string; healthcare_id?: string | null; dob?: string | null; gender?: string | null; phone?: string | null };
  visit: { id: string; visit_date?: string | null; chief_complaint?: string | null; status?: string | null };
  doctor: { name: string; registration_number?: string | null };
  soap: { subjective?: string; objective?: string; assessment?: string; plan?: string };
  medications: any[];
  investigations: string[];
  followUpDate?: string | null;
};

export default function EMRExportButtons({ patient, visit, doctor, soap, medications, investigations, followUpDate }: Props) {
  const exportAsText = () => {
    const meds = medications.filter(m => m.name?.trim());
    const text = `
PATIENT: ${patient.name} | ID: ${patient.healthcare_id || "N/A"} | DOB: ${patient.dob || "N/A"}
DATE: ${visit.visit_date || new Date().toLocaleDateString("en-IN")} | DOCTOR: ${doctor.name} | ${doctor.registration_number || ""}
CHIEF COMPLAINT: ${visit.chief_complaint || "N/A"}
---
S: ${soap.subjective || "N/A"}
O: ${soap.objective || "N/A"}
A: ${soap.assessment || "N/A"}
P: ${soap.plan || "N/A"}
---
MEDICATIONS:
${meds.map((m, i) => `${i+1}. ${m.name} ${m.dosage || ""} - ${[m.morning?"Morning":"",m.afternoon?"Afternoon":"",m.evening?"Evening":"",m.night?"Night":""].filter(Boolean).join("/")} x ${m.duration || "N/A"}`).join("\n")}
---
INVESTIGATIONS: ${investigations.join(", ") || "None"}
FOLLOW UP: ${followUpDate || "As needed"}
    `.trim();
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard — paste into any EMR");
  };

  const exportAsFHIR = () => {
    const fhir = {
      resourceType: "Bundle",
      type: "document",
      timestamp: new Date().toISOString(),
      entry: [
        { resource: { resourceType: "Patient", id: patient.healthcare_id, name: [{ text: patient.name }], birthDate: patient.dob, gender: patient.gender, telecom: [{ system: "phone", value: patient.phone }] } },
        { resource: { resourceType: "Encounter", id: visit.id, status: visit.status, period: { start: visit.visit_date }, reasonCode: [{ text: visit.chief_complaint }] } },
        { resource: { resourceType: "Composition", section: [{ title: "SOAP", text: { div: `S:${soap.subjective} O:${soap.objective} A:${soap.assessment} P:${soap.plan}` } }] } },
        ...medications.filter(m => m.name?.trim()).map((m: any) => ({
          resource: { resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: m.name }, dosageInstruction: [{ text: `${m.dosage || ""} - ${m.duration || ""}` }] }
        }))
      ]
    };
    const blob = new Blob([JSON.stringify(fhir, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${patient.healthcare_id || "patient"}-fhir.json`;
    a.click();
  };

  const exportAsCSV = () => {
    const meds = medications.filter(m => m.name?.trim());
    const headers = "Drug,Dosage,Morning,Afternoon,Evening,Night,Duration,Notes";
    const rows = meds.map(m =>
      `"${m.name}","${m.dosage || ""}","${m.morning ? "Y" : "N"}","${m.afternoon ? "Y" : "N"}","${m.evening ? "Y" : "N"}","${m.night ? "Y" : "N"}","${m.duration || ""}","${m.notes || ""}"`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${patient.healthcare_id || "patient"}-medications.csv`;
    a.click();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="rounded-lg" onClick={exportAsText}>
          <ClipboardCopy className="mr-2 h-4 w-4" /> Copy Text
        </Button>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={exportAsFHIR}>
          <FileJson className="mr-2 h-4 w-4" /> FHIR JSON
        </Button>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={exportAsCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Compatible with Practo, eVital, Meddbase, NHA ABDM</p>
    </div>
  );
}
