import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
}

const TRANSLATIONS: Record<string, Record<string, string>> = {
  Tamil: { clinic: "மருத்துவமனை", doctor: "மருத்துவர்", patient: "நோயாளி", date: "தேதி", rx: "மருந்து சீட்டு", followUp: "மறு சந்திப்பு", morning: "காலை", afternoon: "மதியம்", evening: "மாலை", night: "இரவு", investigations: "பரிசோதனைகள்", soap: "மருத்துவ குறிப்புகள்" },
  Hindi: { clinic: "अस्पताल", doctor: "डॉक्टर", patient: "मरीज़", date: "तारीख", rx: "नुस्खा", followUp: "अगली मुलाकात", morning: "सुबह", afternoon: "दोपहर", evening: "शाम", night: "रात", investigations: "जाँच", soap: "नैदानिक नोट्स" },
  Telugu: { clinic: "ఆసుపత్రి", doctor: "వైద్యుడు", patient: "రోగి", date: "తేదీ", rx: "ప్రిస్క్రిప్షన్", followUp: "తదుపరి సందర్శన", morning: "ఉదయం", afternoon: "మధ్యాహ్నం", evening: "సాయంత్రం", night: "రాత్రి", investigations: "పరీక్షలు", soap: "వైద్య నోట్స్" },
  Kannada: { clinic: "ಆಸ್ಪತ್ರೆ", doctor: "ವೈದ್ಯರು", patient: "ರೋಗಿ", date: "ದಿನಾಂಕ", rx: "ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್", followUp: "ಮುಂದಿನ ಭೇಟಿ", morning: "ಬೆಳಿಗ್ಗೆ", afternoon: "ಮಧ್ಯಾಹ್ನ", evening: "ಸಂಜೆ", night: "ರಾತ್ರಿ", investigations: "ತಪಾಸಣೆಗಳು", soap: "ವೈದ್ಯಕೀಯ ಟಿಪ್ಪಣಿಗಳು" },
  Malayalam: { clinic: "ആശുപത്രി", doctor: "ഡോക്ടർ", patient: "രോഗി", date: "തീയതി", rx: "കുറിപ്പടി", followUp: "അടുത്ത സന്ദർശനം", morning: "രാവിലെ", afternoon: "ഉച്ചയ്ക്ക്", evening: "വൈകുന്നേരം", night: "രാത്രി", investigations: "പരിശോധനകൾ", soap: "ക്ലിനിക്കൽ കുറിപ്പുകൾ" },
  Marathi: { clinic: "रुग्णालय", doctor: "डॉक्टर", patient: "रुग्ण", date: "तारीख", rx: "प्रिस्क्रिप्शन", followUp: "पुढील भेट", morning: "सकाळ", afternoon: "दुपार", evening: "संध्याकाळ", night: "रात्र", investigations: "तपासण्या", soap: "वैद्यकीय नोंदी" },
  Bengali: { clinic: "হাসপাতাল", doctor: "ডাক্তার", patient: "রোগী", date: "তারিখ", rx: "প্রেসক্রিপশন", followUp: "পরবর্তী সাক্ষাৎ", morning: "সকাল", afternoon: "দুপুর", evening: "বিকেল", night: "রাত", investigations: "পরীক্ষা", soap: "ক্লিনিকাল নোট" },
  Gujarati: { clinic: "હોસ્પિટલ", doctor: "ડૉક્ટર", patient: "દર્દી", date: "તારીખ", rx: "પ્રિસ્ક્રિપ્શન", followUp: "આગળની મુલાકાત", morning: "સવાર", afternoon: "બપોર", evening: "સાંજ", night: "રાત", investigations: "તપાસ", soap: "તબીબી નોંધ" },
  Punjabi: { clinic: "ਹਸਪਤਾਲ", doctor: "ਡਾਕਟਰ", patient: "ਮਰੀਜ਼", date: "ਤਾਰੀਖ", rx: "ਨੁਸਖ਼ਾ", followUp: "ਅਗਲੀ ਮੁਲਾਕਾਤ", morning: "ਸਵੇਰ", afternoon: "ਦੁਪਹਿਰ", evening: "ਸ਼ਾਮ", night: "ਰਾਤ", investigations: "ਜਾਂਚ", soap: "ਕਲੀਨਿਕਲ ਨੋਟਸ" },
  Odia: { clinic: "ଡାକ୍ତରଖାନା", doctor: "ଡାକ୍ତର", patient: "ରୋଗୀ", date: "ତାରିଖ", rx: "ପ୍ରେସକ୍ରିପସନ", followUp: "ପରବର୍ତ୍ତୀ ଭେଟ", morning: "ସକାଳ", afternoon: "ଦ୍ୱିପ୍ରହର", evening: "ସନ୍ଧ୍ୟା", night: "ରାତ୍ରି", investigations: "ପରୀକ୍ଷା", soap: "ଚିକିତ୍ସା ଟିପ୍ପଣୀ" },
  Assamese: { clinic: "চিকিৎসালয়", doctor: "চিকিৎসক", patient: "ৰোগী", date: "তাৰিখ", rx: "প্ৰেছক্ৰিপচন", followUp: "পৰৱৰ্তী সাক্ষাৎ", morning: "পুৱা", afternoon: "দুপৰীয়া", evening: "আবেলি", night: "ৰাতি", investigations: "পৰীক্ষা", soap: "চিকিৎসা টোকা" },
  Urdu: { clinic: "اسپتال", doctor: "ڈاکٹر", patient: "مریض", date: "تاریخ", rx: "نسخہ", followUp: "اگلی ملاقات", morning: "صبح", afternoon: "دوپہر", evening: "شام", night: "رات", investigations: "ٹیسٹ", soap: "طبی نوٹس" },
  Konkani: { clinic: "दवाखानो", doctor: "दोतोर", patient: "रोगी", date: "तारीख", rx: "औषध चिट्ठी", followUp: "फुडली भेट", morning: "सकाळ", afternoon: "दनपार", evening: "सांज", night: "रात", investigations: "तपासणी", soap: "वैद्यकीय नोंद" },
  Manipuri: { clinic: "ওষুধালয়", doctor: "ডাক্তর", patient: "নাকল", date: "নুমিৎ", rx: "ওষুধ চিরকুট", followUp: "মতম ফাওবা", morning: "নুমিৎ থোকপা", afternoon: "নুমিদাং", evening: "নুমিৎ তকপা", night: "খরাং", investigations: "পরীক্ষা", soap: "ডাক্তরি নোট" },
  Sindhi: { clinic: "دواخانو", doctor: "ڊاڪٽر", patient: "مريض", date: "تاريخ", rx: "نسخو", followUp: "اڳيون ملاقات", morning: "صبح", afternoon: "منجهند", evening: "شام", night: "رات", investigations: "جاچ", soap: "طبي نوٽ" },
}

const TEMPLATE_FIELD_LABELS: Record<string, Array<{key: string, label: string}>> = {
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
}

const transliterateWithClaude = async (text: string, language: string, apiKey: string): Promise<string> => {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{
          role: "user",
          content: `Transliterate the name "${text}" into ${language} script. Return ONLY the ${language} script characters, nothing else, no explanation, no English.`
        }]
      })
    })
    const data = await res.json()
    return data.content?.[0]?.text?.trim() || ""
  } catch {
    return ""
  }
}

function buildClinicalNotesHtml(soap: Record<string, any>, escHtml: (s: string) => string): string {
  const templateName = soap._template || "SOAP Notes"
  const templateFields = TEMPLATE_FIELD_LABELS[templateName]

  let clinicalNotesHtml = ""

  if (templateFields) {
    clinicalNotesHtml = templateFields
      .filter(f => soap[f.key] && String(soap[f.key]).trim())
      .map(f => `<div class="soap-label">${escHtml(f.label)}</div><div class="soap-value">${escHtml(String(soap[f.key]))}</div>`)
      .join("")
  } else {
    clinicalNotesHtml = Object.entries(soap)
      .filter(([key, val]) => !key.startsWith("_") && val && String(val).trim())
      .map(([key, val]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
        return `<div class="soap-label">${escHtml(label)}</div><div class="soap-value">${escHtml(String(val))}</div>`
      })
      .join("")
  }

  return clinicalNotesHtml
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || ""

    const { visit_id, prescription_id } = await req.json()
    if (!visit_id || !prescription_id) throw new Error("visit_id and prescription_id are required")

    const { data: prescription } = await supabaseAdmin
      .from("prescriptions").select("*").eq("id", prescription_id).single()
    if (!prescription) throw new Error("Prescription not found")

    const { data: visit } = await supabaseAdmin
      .from("visits").select("*, patients(*)").eq("id", visit_id).single()
    if (!visit) throw new Error("Visit not found")

    const { data: doctor } = await supabaseAdmin
      .from("doctors").select("*").eq("id", prescription.doctor_id).single()
    const { data: clinic } = await supabaseAdmin
      .from("clinics").select("id, name, address, phone, regional_language")
      .eq("id", visit.clinic_id).single()
    const { data: notes } = await supabaseAdmin
      .from("clinical_notes").select("soap_notes")
      .eq("visit_id", visit_id)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle()

    const patient = visit.patients as any
    const soap = (notes?.soap_notes || {}) as any
    const meds = Array.isArray(prescription.medications) ? prescription.medications as any[] : []
    const vitals = (visit.vitals || {}) as any
    const investigations = Array.isArray(prescription.investigations) ? prescription.investigations as string[] : []

    console.log("Prescription data — meds count:", meds.length, "investigations count:", investigations.length)
    const lang = clinic?.regional_language || null
    const t = lang && TRANSLATIONS[lang] ? TRANSLATIONS[lang] : null

    console.log("Regional language:", lang, "Has translations:", !!t)

    const getAge = (dob: string) => dob
      ? String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : "N/A"

    let clinicNameRegional = ""
    let doctorNameRegional = ""
    if (t && anthropicKey && lang) {
      const [cn, dn] = await Promise.all([
        transliterateWithClaude(clinic?.name || "", lang, anthropicKey),
        transliterateWithClaude(doctor?.name || "", lang, anthropicKey)
      ])
      clinicNameRegional = cn
      doctorNameRegional = dn
      console.log("Transliterated clinic:", clinicNameRegional, "doctor:", doctorNameRegional)
    }

    let logoDataUrl = ""
    if (clinic?.logo_url) {
      try {
        const { data: logoData } = supabaseAdmin.storage.from("clinic-assets").getPublicUrl(clinic.logo_url)
        if (logoData?.publicUrl) {
          const logoRes = await fetch(logoData.publicUrl)
          const logoBuffer = await logoRes.arrayBuffer()
          const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoBuffer)))
          const logoMime = clinic.logo_url.endsWith(".png") ? "image/png" : "image/jpeg"
          logoDataUrl = `data:${logoMime};base64,${logoBase64}`
        }
      } catch { /* logo fetch failed, skip */ }
    }

    let signatureDataUrl = ""
    if (doctor?.signature_url) {
      try {
        const { data: sigData } = await supabaseAdmin.storage.from("signatures").createSignedUrl(doctor.signature_url, 3600)
        if (sigData?.signedUrl) {
          const sigRes = await fetch(sigData.signedUrl)
          const sigBuffer = await sigRes.arrayBuffer()
          const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
          const sigMime = doctor.signature_url.endsWith(".png") ? "image/png" : "image/jpeg"
          signatureDataUrl = `data:${sigMime};base64,${sigBase64}`
        }
      } catch { /* signature fetch failed */ }
    }

    const checkmark = (val: boolean) => val
      ? `<span style="color:#0D6E6E;font-weight:700;">✓</span>`
      : `<span style="color:#ccc;">—</span>`

    const escHtml = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    const templateName = soap._template || "SOAP Notes"
    const clinicalNotesHtml = buildClinicalNotesHtml(soap, escHtml)

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+Tamil:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Telugu:wght@400;700&family=Noto+Sans+Kannada:wght@400;700&family=Noto+Sans+Malayalam:wght@400;700&family=Noto+Sans+Bengali:wght@400;700&family=Noto+Sans+Gujarati:wght@400;700&family=Noto+Sans+Gurmukhi:wght@400;700&family=Noto+Sans+Oriya:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { overflow-x: hidden; }
  body { font-family: 'Noto Sans', Arial, sans-serif; font-size: 11px; color: #1a1a1a; max-width: 210mm; width: 100%; margin: 0 auto; padding: 14mm; word-break: break-word; }
  table { table-layout: auto; word-break: break-word; }
  .regional { font-family: 'Noto Sans Tamil','Noto Sans Devanagari','Noto Sans Telugu','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Nastaliq Urdu','Noto Sans', sans-serif; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; background: #0D4444; color: white; padding: 14px 16px; border-radius: 6px 6px 0 0; }
  .clinic-block .clinic-name { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; }
  .clinic-block .clinic-regional { font-size: 13px; color: #a7d4d4; margin-top: 1px; }
  .clinic-block .clinic-sub { font-size: 9.5px; color: #c8e6e6; margin-top: 5px; line-height: 1.6; }
  .doctor-block { text-align: right; }
  .doctor-block .doctor-name { font-size: 15px; font-weight: 700; color: #ffffff; }
  .doctor-block .doctor-regional { font-size: 11px; color: #a7d4d4; margin-top: 1px; }
  .doctor-block .doctor-sub { font-size: 9px; color: #c8e6e6; margin-top: 4px; line-height: 1.7; }
  .patient-bar { display: grid; grid-template-columns: repeat(4, 1fr); background: #e8f5f5; border: 1px solid #b2d8d8; padding: 10px 14px; gap: 8px; margin-bottom: 14px; }
  .patient-bar .field label { font-size: 8.5px; color: #5a7a7a; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; }
  .patient-bar .field label .regional-label { font-weight: 400; color: #7a9a9a; }
  .patient-bar .field p { font-size: 11.5px; font-weight: 700; margin-top: 2px; }
  .patient-bar .field p.hid { color: #0D6E6E; }
  .section { margin-bottom: 13px; }
  .section-title { font-size: 10px; font-weight: 800; color: #0D6E6E; text-transform: uppercase; letter-spacing: 0.7px; border-bottom: 1.5px solid #0D6E6E; padding-bottom: 3px; margin-bottom: 7px; }
  .section-title .regional-title { font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 11px; }
  .vitals-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .vital-chip { background: #f0fafa; border: 1px solid #b2d8d8; border-radius: 4px; padding: 3px 9px; font-size: 10px; color: #1a1a1a; }
  .vital-chip strong { color: #0D6E6E; }
  .soap-grid { display: grid; grid-template-columns: 140px 1fr; row-gap: 6px; }
  .soap-label { font-size: 9px; font-weight: 700; color: #666; text-transform: uppercase; padding-top: 1px; }
  .soap-value { font-size: 11px; color: #1a1a1a; line-height: 1.5; }
  .rx-header { font-size: 14px; font-weight: 800; color: #0D6E6E; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead tr { background: #0D6E6E; color: white; }
  th { padding: 6px 7px; text-align: left; font-weight: 600; font-size: 9.5px; }
  th .regional-th { display: block; font-weight: 400; font-size: 8.5px; opacity: 0.85; }
  td { padding: 5px 7px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
  tr:nth-child(even) td { background: #f9fbfb; }
  td.check { text-align: center; font-size: 13px; }
  .followup { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; padding: 7px 12px; font-size: 11px; margin-top: 8px; }
  .signature { margin-top: 28px; text-align: right; }
  .sig-line { border-top: 1px solid #333; width: 200px; margin-left: auto; padding-top: 5px; }
  .sig-name { font-size: 11px; font-weight: 700; }
  .sig-detail { font-size: 9.5px; color: #555; line-height: 1.6; margin-top: 2px; }
  .footer { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 7px; display: flex; justify-content: space-between; font-size: 8.5px; color: #aaa; }
  @media print {
    @page { size: A4; margin: 16mm 14mm; }
    body { padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 7px 14mm; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="clinic-block" style="display:flex;align-items:center;gap:12px;">
    ${logoDataUrl ? `
    <img src="${logoDataUrl}" alt="Logo"
      style="width:56px;height:56px;object-fit:contain;border-radius:6px;background:white;padding:2px;flex-shrink:0;" />
    ` : ""}
    <div>
      <div class="clinic-name">${escHtml(clinic?.name || "Clinic")}</div>
      ${clinicNameRegional ? `<div class="clinic-regional regional">${clinicNameRegional}</div>` : ""}
      <div class="clinic-sub">
        ${escHtml(clinic?.address || "")}<br>
        ${clinic?.phone ? "Tel: " + escHtml(clinic.phone) : ""}
      </div>
    </div>
  </div>
  <div class="doctor-block">
    <div class="doctor-name">${escHtml(doctor?.name || "Doctor")}</div>
    ${doctorNameRegional ? `<div class="doctor-regional regional">${doctorNameRegional}</div>` : ""}
    <div class="doctor-sub">
      ${escHtml(doctor?.qualification || "")}<br>
      ${doctor?.registration_number ? "Reg: " + escHtml(doctor.registration_number) : ""}<br>
      ${escHtml(doctor?.specialty || "")}
    </div>
  </div>
</div>

<div class="patient-bar">
  <div class="field">
    <label>${t ? `<span class="regional-label regional">${t.patient}</span> / ` : ""}Patient</label>
    <p>${escHtml(patient?.name || "—")}</p>
  </div>
  <div class="field">
    <label>Healthcare ID</label>
    <p class="hid">${escHtml(patient?.healthcare_id || "—")}</p>
  </div>
  <div class="field">
    <label>Age / Gender</label>
    <p>${getAge(patient?.dob)}y / ${escHtml(patient?.gender || "—")}</p>
  </div>
  <div class="field">
    <label>${t ? `<span class="regional-label regional">${t.date}</span> / ` : ""}Date</label>
    <p>${new Date().toLocaleDateString("en-IN")}</p>
  </div>
</div>

${Object.keys(vitals).length > 0 ? `
<div class="section">
  <div class="section-title">Vitals</div>
  <div class="vitals-row">
    ${vitals.bp_sys ? `<div class="vital-chip"><strong>BP</strong> ${escHtml(vitals.bp_sys)}/${escHtml(vitals.bp_dia)} mmHg</div>` : ""}
    ${vitals.pulse ? `<div class="vital-chip"><strong>Pulse</strong> ${escHtml(vitals.pulse)} bpm</div>` : ""}
    ${vitals.temp || vitals.temperature ? `<div class="vital-chip"><strong>Temp</strong> ${escHtml(vitals.temp || vitals.temperature)}°F</div>` : ""}
    ${vitals.spo2 ? `<div class="vital-chip"><strong>SpO2</strong> ${escHtml(vitals.spo2)}%</div>` : ""}
    ${vitals.weight ? `<div class="vital-chip"><strong>Wt</strong> ${escHtml(vitals.weight)} kg</div>` : ""}
    ${vitals.height ? `<div class="vital-chip"><strong>Ht</strong> ${escHtml(vitals.height)} cm</div>` : ""}
  </div>
</div>` : ""}

${visit.chief_complaint ? `
<div class="section">
  <div class="section-title">Chief Complaint</div>
  <p>${escHtml(visit.chief_complaint)}</p>
</div>` : ""}

${clinicalNotesHtml ? `
<div class="section">
  <div class="section-title">
    ${t ? `<span class="regional-title regional">${t.soap}</span> / ` : ""}Clinical Notes
    <span style="font-size:9px;font-weight:normal;color:#6B7280;margin-left:8px;">(${escHtml(templateName)})</span>
  </div>
  <div class="soap-grid">
    ${clinicalNotesHtml}
  </div>
</div>` : ""}

<div class="section">
  <div class="rx-header">℞  ${t ? `<span class="regional">${t.rx}</span> / ` : ""}Prescription</div>
  ${meds.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Drug / Medicine</th>
        <th>Dosage</th>
        <th>M${t ? `<span class="regional-th regional">${t.morning}</span>` : ""}</th>
        <th>A${t ? `<span class="regional-th regional">${t.afternoon}</span>` : ""}</th>
        <th>E${t ? `<span class="regional-th regional">${t.evening}</span>` : ""}</th>
        <th>N${t ? `<span class="regional-th regional">${t.night}</span>` : ""}</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      ${meds.map((m: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escHtml(m.name || "—")}</strong></td>
        <td>${escHtml(m.dosage || "—")}</td>
        <td class="check">${checkmark(m.morning)}</td>
        <td class="check">${checkmark(m.afternoon)}</td>
        <td class="check">${checkmark(m.evening)}</td>
        <td class="check">${checkmark(m.night)}</td>
        <td>${escHtml(m.duration || "—")}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  ` : `<p style="color:#9CA3AF;font-size:11px;">No medications prescribed</p>`}
</div>

${investigations.length > 0 ? `
<div class="section">
  <div class="section-title">${t ? `<span class="regional-title regional">${t.investigations}</span> / ` : ""}Investigations</div>
  <p>${investigations.map(escHtml).join("  •  ")}</p>
</div>` : ""}

${prescription.follow_up_date ? `
<div class="followup">
  📅 ${t ? `<span class="regional">${t.followUp}</span> / ` : ""}Follow-up:
  ${new Date(prescription.follow_up_date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
</div>` : ""}

<div class="signature">
  <div class="sig-line">
    ${signatureDataUrl ? `
    <img src="${signatureDataUrl}" alt="Signature"
      style="height:50px;object-fit:contain;margin-bottom:4px;display:block;margin-left:auto;" />
    ` : ""}
    <div class="sig-name">${escHtml(doctor?.name || "Doctor")}</div>
    ${doctorNameRegional ? `<div class="sig-detail regional">${doctorNameRegional}</div>` : ""}
    <div class="sig-detail">${escHtml(doctor?.qualification || "")}</div>
    <div class="sig-detail">${doctor?.registration_number ? "Reg: " + escHtml(doctor.registration_number) : ""}</div>
  </div>
</div>

<div class="footer">
  <span>Generated by StethoScribe</span>
  <span>${new Date().toLocaleString("en-IN")}</span>
</div>

<div style="margin-top:14px;padding:10px 12px;border:1px dashed #14b8a6;border-radius:8px;background:#f0fdfa;text-align:center;font-size:10px;color:#0f766e;">
  <div style="font-weight:600;">📱 View your health records anytime at ${(Deno.env.get("SITE_URL") || "https://medicarescribe.lovable.app").replace(/\/$/, "")}/patient-portal</div>
  <div style="margin-top:3px;color:#0f766e99;">Login with your registered mobile number and date of birth</div>
</div>

</body>
</html>`

    const path = `${visit.clinic_id}/${new Date().getFullYear()}/${prescription_id}.html`
    const bytes = new TextEncoder().encode(html)
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("prescriptions")
      .upload(path, bytes, { contentType: "text/html;charset=utf-8", upsert: true })
    if (uploadErr) {
      console.error("Prescription HTML upload failed:", uploadErr)
      throw new Error(`Storage upload failed: ${uploadErr.message}`)
    }
    const { error: updateErr } = await supabaseAdmin.from("prescriptions")
      .update({ pdf_url: path }).eq("id", prescription_id)
    if (updateErr) {
      console.error("Prescription pdf_url update failed:", updateErr)
      throw new Error(`DB update failed: ${updateErr.message}`)
    }

    return new Response(JSON.stringify({ success: true, path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("Prescription generation error:", error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
