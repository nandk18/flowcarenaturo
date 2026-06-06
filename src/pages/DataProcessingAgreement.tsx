import SeoHead from "@/components/SeoHead";

export default function DataProcessingAgreement() {
  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Data Processing Agreement — StethoScribe"
        description="DPA terms between StethoScribe (processor) and clinics (controllers) under India's DPDP Act 2023."
        path="/dpa"
      />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Data Processing Agreement</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">1. Parties</h2>
            <p>This Data Processing Agreement ("DPA") is between:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-muted-foreground">
              <li><strong className="text-foreground">Data Controller:</strong> The clinic or healthcare provider ("Clinic") registering for StethoScribe</li>
              <li><strong className="text-foreground">Data Processor:</strong> StethoScribe Technologies ("StethoScribe")</li>
            </ul>
            <p className="mt-3">This DPA forms part of the Terms of Service and governs the processing of personal data by StethoScribe on behalf of the Clinic.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">2. Subject Matter</h2>
            <p>StethoScribe processes personal data on behalf of the Clinic to provide clinic management, e-prescription, and AI medical scribe services as described in the Terms of Service.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">3. Nature and Purpose of Processing</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Storage and retrieval of patient health records</li>
              <li>Generation of clinical notes via AI voice transcription</li>
              <li>Generation and delivery of electronic prescriptions</li>
              <li>Lab order and result management</li>
              <li>Appointment scheduling and queue management</li>
              <li>Analytics and reporting for the Clinic</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">4. Types of Personal Data</h2>
            <p>Categories of data processed include:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-muted-foreground">
              <li>Patient identifiers (name, DOB, gender, contact details)</li>
              <li>Health data (diagnoses, medications, vitals, lab results)</li>
              <li>Voice recordings (transient, for transcription only)</li>
              <li>Clinical documents and prescriptions</li>
              <li>Staff identity and access credentials</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">5. Obligations of StethoScribe</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Process personal data only on documented instructions from the Clinic</li>
              <li>Ensure persons authorized to process data are bound by confidentiality</li>
              <li>Implement appropriate technical and organizational security measures</li>
              <li>Not engage sub-processors without informing the Clinic</li>
              <li>Assist the Clinic in responding to data subject rights requests</li>
              <li>Delete or return all personal data upon termination of the agreement</li>
              <li>Notify the Clinic of any data breach within 72 hours</li>
              <li>Make available all information necessary to demonstrate compliance</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">6. Obligations of the Clinic</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Ensure lawful basis exists for processing patient data</li>
              <li>Obtain appropriate patient consent before entering data</li>
              <li>Ensure data entered is accurate and up to date</li>
              <li>Manage staff access and revoke access when staff leave</li>
              <li>Not instruct StethoScribe to process data in violation of applicable law</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">7. Sub-processors</h2>
            <p>StethoScribe uses the following sub-processors to deliver its services:</p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs border border-border rounded-lg">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-semibold">Sub-processor</th>
                    <th className="text-left p-2 font-semibold">Purpose</th>
                    <th className="text-left p-2 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-t border-border"><td className="p-2">Supabase Inc.</td><td className="p-2">Database, authentication, file storage</td><td className="p-2">Singapore (AWS)</td></tr>
                  <tr className="border-t border-border"><td className="p-2">OpenAI LLC</td><td className="p-2">Voice transcription (Whisper API)</td><td className="p-2">United States</td></tr>
                  <tr className="border-t border-border"><td className="p-2">Anthropic PBC</td><td className="p-2">Clinical note formatting (Claude API)</td><td className="p-2">United States</td></tr>
                  <tr className="border-t border-border"><td className="p-2">Vercel Inc.</td><td className="p-2">Frontend hosting and delivery</td><td className="p-2">Global CDN</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">8. Security Measures</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>AES-256 encryption at rest</li>
              <li>TLS 1.2+ encryption in transit</li>
              <li>Row Level Security ensuring complete data isolation between clinics</li>
              <li>Role-based access control</li>
              <li>Automated daily backups</li>
              <li>Session timeout after 30 minutes of inactivity</li>
              <li>Complete audit logging of all data access and modifications</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">9. Term and Termination</h2>
            <p>This DPA remains in effect for the duration of the Terms of Service. Upon termination, StethoScribe will retain data for 90 days to allow export, after which all data will be permanently deleted.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">10. Contact</h2>
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <p className="font-semibold">For DPA-related queries:</p>
              <p className="mt-1">Email: <a href="mailto:privacy@stethoscribe.app" className="text-primary underline">privacy@stethoscribe.app</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}