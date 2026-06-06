import SeoHead from "@/components/SeoHead";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Privacy Policy — StethoScribe"
        description="How StethoScribe collects, processes, and protects clinic and patient data under India's DPDP Act 2023."
        path="/privacy"
      />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">1. Introduction</h2>
            <p>StethoScribe ("we", "our", or "us") is an AI-powered clinic management and e-prescription platform operated by StethoScribe Technologies. We are committed to protecting the privacy and security of personal data processed through our platform in accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act), the Information Technology Act, 2000, and the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.</p>
            <p className="mt-2">This Privacy Policy explains how we collect, use, store, share, and protect personal data when clinics and their staff use our services.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">2. Data We Collect</h2>
            <p className="font-medium mt-2">Clinic and Staff Data:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1 text-muted-foreground">
              <li>Clinic name, address, phone number, logo</li>
              <li>Doctor name, qualification, registration number, specialty, signature</li>
              <li>Staff email addresses and role assignments</li>
              <li>Login credentials (passwords stored as encrypted hashes, never in plain text)</li>
            </ul>
            <p className="font-medium mt-3">Patient Data (Sensitive Personal Data):</p>
            <ul className="list-disc pl-5 space-y-1 mt-1 text-muted-foreground">
              <li>Name, date of birth, gender, contact information</li>
              <li>Healthcare ID (auto-generated, format: MED-YYYY-XXXXX)</li>
              <li>Blood group, allergies, chronic conditions</li>
              <li>Vitals (blood pressure, pulse, temperature, SpO2, weight, height)</li>
              <li>Clinical notes, diagnoses, treatment plans</li>
              <li>Prescriptions and medications</li>
              <li>Lab orders and results</li>
              <li>Uploaded documents (scans, X-rays, lab reports)</li>
              <li>Voice recordings (temporarily, for transcription only)</li>
            </ul>
            <p className="font-medium mt-3">Usage Data:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1 text-muted-foreground">
              <li>Login and logout timestamps</li>
              <li>Actions performed within the platform (audit logs)</li>
              <li>Browser type and device information</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">3. How We Use Data</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>To provide clinic management, patient record keeping, and e-prescription services</li>
              <li>To generate AI-powered clinical notes using voice transcription</li>
              <li>To generate bilingual prescription documents</li>
              <li>To facilitate lab order and result workflows between clinics and laboratories</li>
              <li>To send prescription links to patients via WhatsApp or email</li>
              <li>To maintain audit trails for compliance and security</li>
              <li>To improve our services and fix technical issues</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">4. AI Processing and Third-Party Services</h2>
            <p>To provide AI features, your data is processed by the following third-party services:</p>
            <div className="space-y-3 mt-3">
              <div className="border border-border rounded-lg p-3">
                <p className="font-semibold">OpenAI (Whisper API)</p>
                <p className="text-muted-foreground">Voice recordings are sent to OpenAI for transcription. Audio is processed in real-time and not stored by OpenAI beyond processing. Privacy policy: openai.com/privacy</p>
              </div>
              <div className="border border-border rounded-lg p-3">
                <p className="font-semibold">Anthropic (Claude API)</p>
                <p className="text-muted-foreground">Clinical transcripts and notes are sent to Anthropic's Claude AI for formatting into clinical templates and generating prescription summaries. Privacy policy: anthropic.com/privacy</p>
              </div>
              <div className="border border-border rounded-lg p-3">
                <p className="font-semibold">Supabase</p>
                <p className="text-muted-foreground">All data is stored in Supabase's managed PostgreSQL database hosted on AWS. Data is encrypted at rest and in transit. Privacy policy: supabase.com/privacy</p>
              </div>
            </div>
            <p className="mt-3">By using StethoScribe, clinics acknowledge that patient data necessary for AI processing is shared with these subprocessors under appropriate data processing agreements.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">5. Data Storage and Security</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>All data is stored on servers located in Singapore (AWS ap-southeast-1 region)</li>
              <li>Data is encrypted at rest using AES-256 encryption</li>
              <li>All data transmission is encrypted using TLS 1.2 or higher</li>
              <li>Row Level Security (RLS) ensures clinic data is completely isolated — no clinic can access another clinic's data</li>
              <li>Access is controlled by role-based permissions (Admin, Doctor, Receptionist, Lab)</li>
              <li>Session timeout after 30 minutes of inactivity</li>
              <li>All user actions are logged in an audit trail</li>
              <li>Automatic daily backups with point-in-time recovery</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">6. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Patient data is retained for the duration of the clinic's active subscription</li>
              <li>Upon subscription cancellation, data is retained for 90 days then permanently deleted</li>
              <li>Clinics may export all their data at any time before deletion</li>
              <li>Voice recordings used for transcription are not permanently stored</li>
              <li>Audit logs are retained for 2 years</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">7. Your Rights Under DPDP Act 2023</h2>
            <p>As a Data Principal (clinic or patient), you have the following rights:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-muted-foreground">
              <li><strong className="text-foreground">Right to Access:</strong> Request a copy of all personal data held about you</li>
              <li><strong className="text-foreground">Right to Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong className="text-foreground">Right to Erasure:</strong> Request deletion of your personal data (subject to legal retention requirements)</li>
              <li><strong className="text-foreground">Right to Grievance Redressal:</strong> Lodge a complaint with our Data Protection Officer</li>
              <li><strong className="text-foreground">Right to Nominate:</strong> Nominate another person to exercise your rights in case of death or incapacity</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at <strong>privacy@stethoscribe.app</strong>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">8. Cookies and Local Storage</h2>
            <p>StethoScribe uses session cookies and browser local storage solely for authentication and user preferences. We do not use advertising cookies or track users across other websites. No third-party advertising networks have access to your data.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">9. Data Breach Notification</h2>
            <p>In the event of a personal data breach, we will notify affected clinics within 72 hours of becoming aware of the breach. We will provide details of the breach, data affected, and steps taken to mitigate impact.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">10. Children's Data</h2>
            <p>StethoScribe may process health records of minor patients as part of clinic operations. Such data is handled with additional care and only processed on the instruction of the treating clinic. We do not knowingly collect data directly from individuals under 18.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify registered clinics of material changes via email at least 30 days before they take effect. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">12. Contact Us</h2>
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <p className="font-semibold">Data Protection Officer</p>
              <p>StethoScribe Technologies</p>
              <p className="mt-1">Email: <a href="mailto:privacy@stethoscribe.app" className="text-primary underline">privacy@stethoscribe.app</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}