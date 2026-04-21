import React from "react";

export const TEMPLATE_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  "SOAP Notes": [
    { key: "subjective", label: "Subjective" },
    { key: "objective", label: "Objective" },
    { key: "assessment", label: "Assessment" },
    { key: "plan", label: "Plan" },
  ],
  "SOAP Detailed": [
    { key: "hpi", label: "History of Present Illness" },
    { key: "ros", label: "Review of Systems" },
    { key: "physical_exam", label: "Physical Examination" },
    { key: "assessment", label: "Assessment" },
    { key: "plan", label: "Plan" },
  ],
  "Clinical Notes": [
    { key: "history", label: "History" },
    { key: "examination", label: "Examination" },
    { key: "diagnosis", label: "Diagnosis" },
    { key: "treatment", label: "Treatment Plan" },
  ],
  "General Health Check-Up": [
    { key: "vitals_review", label: "Vitals Review" },
    { key: "systems_review", label: "Systems Review" },
    { key: "assessment", label: "Assessment" },
    { key: "recommendations", label: "Recommendations" },
  ],
  "General Inpatient Admission": [
    { key: "presenting_complaint", label: "Presenting Complaint" },
    { key: "history", label: "History" },
    { key: "examination", label: "Examination" },
    { key: "investigations", label: "Investigations" },
    { key: "admission_diagnosis", label: "Admission Diagnosis" },
    { key: "management_plan", label: "Management Plan" },
  ],
  "Follow-Up Visit": [
    { key: "interval_history", label: "Interval History" },
    { key: "current_status", label: "Current Status" },
    { key: "medication_review", label: "Medication Review" },
    { key: "plan_adjustment", label: "Plan Adjustment" },
  ],
  "Referral Letter": [
    { key: "reason_for_referral", label: "Reason for Referral" },
    { key: "clinical_summary", label: "Clinical Summary" },
    { key: "current_medications", label: "Current Medications" },
    { key: "request", label: "Request" },
  ],
  "Prescription Only": [
    { key: "diagnosis", label: "Diagnosis" },
    { key: "instructions", label: "Instructions" },
  ],
  "Oncology Consultation": [
    { key: "cancer_history", label: "Cancer History" },
    { key: "current_status", label: "Current Status" },
    { key: "treatment_history", label: "Treatment History" },
    { key: "examination", label: "Examination" },
    { key: "assessment", label: "Assessment" },
    { key: "plan", label: "Plan" },
  ],
};

/**
 * Dynamically render clinical notes from soap_notes JSON.
 * Uses _template key to find proper field labels, falls back to rendering all keys.
 */
export function renderClinicalNotes(soapNotes: Record<string, any> | null | undefined): React.ReactNode {
  if (!soapNotes) return null;

  const templateName = soapNotes._template || "SOAP Notes";
  const templateFields = TEMPLATE_FIELDS[templateName];

  if (templateFields && templateFields.length > 0) {
    const rendered = templateFields
      .filter(field => soapNotes[field.key] && String(soapNotes[field.key]).trim())
      .map(field => (
        <div key={field.key}>
          <span className="font-semibold text-foreground">{field.label}:</span>{" "}
          <span className="text-muted-foreground">{soapNotes[field.key]}</span>
        </div>
      ));
    if (rendered.length > 0) return <>{rendered}</>;
  }

  // Fallback — render all non-internal keys
  return (
    <>
      {Object.entries(soapNotes)
        .filter(([key, value]) => !key.startsWith("_") && value && String(value).trim())
        .map(([key, value]) => (
          <div key={key}>
            <span className="font-semibold text-foreground capitalize">
              {key.replace(/_/g, " ")}:
            </span>{" "}
            <span className="text-muted-foreground">{String(value)}</span>
          </div>
        ))}
    </>
  );
}
