import { Link } from "react-router-dom";
import { Lock, ShieldAlert, Bug, ScrollText, ArrowLeft } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <span className="font-bold text-primary text-sm">Security</span>
          <Link to="/auth" className="text-xs border border-primary/30 text-primary rounded-lg px-3 py-1.5 font-medium hover:bg-primary/10">Login</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">Security</h1>
        <p className="mt-2 text-muted-foreground">How we protect your clinic and patient data</p>

        <div className="mt-10 space-y-10">
          {/* Security measures */}
          <section>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground mb-4">
              <Lock className="h-5 w-5 text-primary" /> Security Measures
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: "🔐", title: "Encryption at Rest", desc: "All data encrypted using AES-256" },
                { icon: "🔒", title: "Encryption in Transit", desc: "TLS 1.2+ for all connections" },
                { icon: "🏥", title: "Data Isolation", desc: "Row Level Security — clinics cannot access each other's data" },
                { icon: "👤", title: "Role-based Access", desc: "Admin, Doctor, Receptionist, Lab roles with distinct permissions" },
                { icon: "⏱️", title: "Session Timeout", desc: "Automatic logout after 30 minutes of inactivity" },
                { icon: "📋", title: "Audit Logging", desc: "Every data access and modification is logged" },
                { icon: "💾", title: "Daily Backups", desc: "Automated backups with point-in-time recovery" },
                { icon: "🔑", title: "Password Security", desc: "Passwords hashed using bcrypt, never stored in plain text" },
              ].map(item => (
                <div key={item.title} className="flex gap-3 p-4 rounded-xl border border-border bg-card">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Incident Response */}
          <section>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground mb-4">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Incident Response Plan
            </h2>
            <div className="space-y-3">
              {[
                { step: "1", title: "Detection", desc: "Security incidents are detected via automated monitoring, user reports, or third-party notifications. Our team is alerted immediately.", time: "0-1 hours" },
                { step: "2", title: "Containment", desc: "Affected systems are isolated to prevent further exposure. Compromised accounts are suspended. Access logs are preserved.", time: "1-4 hours" },
                { step: "3", title: "Assessment", desc: "We determine the scope of the incident — what data was affected, how many clinics, and the root cause.", time: "4-24 hours" },
                { step: "4", title: "Notification", desc: "Affected clinics are notified within 72 hours via email with details of the breach, data affected, and mitigation steps.", time: "Within 72 hours" },
                { step: "5", title: "Remediation", desc: "Root cause is fixed. Security patches applied. Systems restored. Additional safeguards implemented to prevent recurrence.", time: "24-72 hours" },
                { step: "6", title: "Post-incident Review", desc: "Full incident report prepared. Lessons learned documented. Security policies updated. Report available to affected clinics on request.", time: "Within 2 weeks" },
              ].map(item => (
                <div key={item.step} className="flex gap-4 p-4 rounded-xl border border-border bg-card">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{item.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Vulnerability reporting */}
          <section>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground mb-4">
              <Bug className="h-5 w-5 text-primary" /> Report a Vulnerability
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              If you discover a security vulnerability in StethoScribe, please report it
              responsibly. We take all security reports seriously and will respond within 48 hours.
            </p>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-1">Responsible Disclosure</p>
              <p className="text-xs text-muted-foreground mb-3">Email your findings to:</p>
              <a href="mailto:security@stethoscribe.app" className="text-sm font-bold text-primary hover:underline">
                security@stethoscribe.app
              </a>
              <p className="text-xs text-muted-foreground mt-3">
                Please include: description of the vulnerability, steps to reproduce, potential
                impact, and your contact details. Do not publicly disclose until we have addressed the issue.
              </p>
            </div>
          </section>

          {/* Compliance */}
          <section>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground mb-4">
              <ScrollText className="h-5 w-5 text-primary" /> Compliance
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { name: "DPDP Act 2023", status: "Compliant", desc: "India's Digital Personal Data Protection Act", ok: true },
                { name: "IT Act 2000", status: "Compliant", desc: "Information Technology Act and IT Rules 2011", ok: true },
                { name: "ISO 27001", status: "In Progress", desc: "Information Security Management — certification planned", ok: false },
              ].map(item => (
                <div key={item.name} className="p-4 rounded-xl border border-border bg-card">
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">{item.desc}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {item.ok ? "✅" : "⏳"} {item.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}