import SeoHead from "@/components/SeoHead";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Terms of Service — StethoScribe"
        description="Terms governing use of the StethoScribe clinic management platform by doctors, clinics, and diagnostic labs."
        path="/terms"
      />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By registering for or using StethoScribe ("the Platform"), you ("the Clinic" or "User") agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Platform. These terms constitute a legally binding agreement between you and StethoScribe Technologies.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">2. Eligibility</h2>
            <p>StethoScribe is intended solely for use by:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-muted-foreground">
              <li>Licensed medical practitioners registered with a recognized medical council in India</li>
              <li>Registered clinical establishments under the Clinical Establishments Act, 2010</li>
              <li>Authorized clinical staff (receptionists, administrators) employed by eligible clinics</li>
              <li>Registered diagnostic laboratories</li>
            </ul>
            <p className="mt-3">By registering, you confirm that you meet these eligibility requirements. We reserve the right to terminate accounts that do not comply.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">3. Nature of Service</h2>
            <div className="border-l-4 border-warning bg-warning/5 p-4 my-3 rounded">
              <p className="font-semibold text-warning-foreground">⚠️ Important Medical Disclaimer</p>
              <p className="mt-1">StethoScribe is a software tool for clinic management and documentation. It is NOT a medical device, does NOT provide medical advice, and does NOT make clinical decisions. All clinical decisions, diagnoses, and prescriptions remain the sole responsibility of the licensed medical practitioner.</p>
            </div>
            <p>The AI features (voice transcription, note formatting, lab result summaries) are assistive tools only. The accuracy of AI-generated content must always be verified by the treating doctor before use.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">4. Account Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>You are responsible for maintaining the confidentiality of your login credentials</li>
              <li>You must not share your account with unauthorized individuals</li>
              <li>You are responsible for all activities that occur under your account</li>
              <li>You must notify us immediately of any unauthorized access at <a href="mailto:security@stethoscribe.app" className="text-primary underline">security@stethoscribe.app</a></li>
              <li>Each clinic admin is responsible for managing staff access and revoking access for departed employees</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">5. Data Responsibility</h2>
            <p>As a Data Controller under the DPDP Act 2023:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-muted-foreground">
              <li>The clinic is responsible for obtaining appropriate consent from patients before entering their data into the Platform</li>
              <li>The clinic is responsible for ensuring data entered is accurate and lawfully obtained</li>
              <li>StethoScribe acts as a Data Processor on behalf of the clinic</li>
              <li>The clinic agrees to the terms of our Data Processing Agreement</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">6. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-muted-foreground">
              <li>Use the Platform for any unlawful purpose</li>
              <li>Enter false or misleading patient information</li>
              <li>Attempt to access another clinic's data</li>
              <li>Reverse engineer, decompile, or attempt to extract source code</li>
              <li>Use the Platform to generate fraudulent prescriptions</li>
              <li>Share patient data with unauthorized third parties</li>
              <li>Use automated scripts or bots to access the Platform</li>
              <li>Resell or sublicense access to the Platform</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">7. Subscription and Payment</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>StethoScribe is offered on a subscription basis with plans as published on our website</li>
              <li>A 14-day free trial is available without requiring payment details</li>
              <li>Subscriptions renew automatically unless cancelled before the renewal date</li>
              <li>Refunds are available within 7 days of payment if the service has not been substantially used</li>
              <li>We reserve the right to change pricing with 30 days notice to existing subscribers</li>
              <li>Non-payment will result in account suspension after a 7-day grace period</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">8. Intellectual Property</h2>
            <p>StethoScribe and all associated software, designs, algorithms, and content are the intellectual property of StethoScribe Technologies. You are granted a limited, non-exclusive, non-transferable license to use the Platform for its intended purpose. Patient data entered by clinics remains the property of the clinic.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by applicable law:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-muted-foreground">
              <li>StethoScribe shall not be liable for any clinical outcomes resulting from use of the Platform</li>
              <li>Our total liability for any claim shall not exceed the subscription fees paid in the 3 months preceding the claim</li>
              <li>We are not liable for indirect, consequential, or incidental damages</li>
              <li>We are not liable for service interruptions caused by third-party providers (Supabase, OpenAI, Anthropic)</li>
              <li>We are not responsible for data loss caused by user error</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">10. Service Availability</h2>
            <p>We aim for 99.5% uptime but do not guarantee uninterrupted service. Planned maintenance will be communicated 24 hours in advance. We are not liable for losses due to service unavailability.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">11. Termination</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>You may cancel your subscription at any time from the Settings page</li>
              <li>We may terminate accounts for violation of these terms with immediate effect</li>
              <li>Upon termination, you will have 90 days to export your data before it is permanently deleted</li>
              <li>Clauses relating to intellectual property, liability, and dispute resolution survive termination</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">12. Governing Law and Disputes</h2>
            <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Karur, Tamil Nadu, India. We encourage resolution of disputes through mediation before litigation.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">13. Contact</h2>
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <p className="font-semibold">StethoScribe Technologies</p>
              <p className="mt-1">Email: <a href="mailto:legal@stethoscribe.app" className="text-primary underline">legal@stethoscribe.app</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}