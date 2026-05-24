import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Mic, FileText, MessageSquare, ClipboardList, Calendar, BarChart3, Stethoscope, Clock, PenLine, Frown, Check, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { motion, useInView, useSpring, useMotionValue, useTransform } from "framer-motion";
import SeoHead from "@/components/SeoHead";

// --- Animated counter component ---
function CountUp({ value, suffix = "" }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const numMatch = value.match(/^(\d+)/);
  const num = numMatch ? parseInt(numMatch[1]) : 0;
  const rest = numMatch ? value.slice(numMatch[0].length) : value;

  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: 1500, bounce: 0 });
  const display = useTransform(spring, (v) => `${Math.round(v)}${rest}${suffix}`);

  useEffect(() => {
    if (isInView && num > 0) motionVal.set(num);
  }, [isInView, num, motionVal]);

  if (num === 0) return <span ref={ref}>{value}{suffix}</span>;
  return <motion.span ref={ref}>{display}</motion.span>;
}

// --- Reusable fade-up wrapper ---
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const slideInLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0 },
};

const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0 },
};

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Lab Workflow", href: "#lab-workflow" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

const PROBLEMS = [
  { icon: Clock, stat: "3-4 hours", desc: "daily on paperwork" },
  { icon: PenLine, stat: "Manual prescriptions", desc: "error-prone & slow" },
  { icon: Frown, stat: "Paper records", desc: "lost or illegible" },
];

const STEPS = [
  { num: 1, title: "Patient checks in", desc: "Token assigned automatically" },
  { num: 2, title: "Doctor opens consult", desc: "Full history ready" },
  { num: 3, title: "Doctor speaks", desc: "AI writes notes in real time" },
  { num: 4, title: "Review & prescribe", desc: "Medications with timing" },
  { num: 5, title: "Tap Complete", desc: "Prescription on patient's WhatsApp" },
];

const FEATURES = [
  { icon: Mic, title: "AI Voice Medical Scribe", desc: "Speak in any Indian language. AI transcribes and formats into clinical notes in 30 seconds." },
  { icon: FileText, title: "Bilingual Prescriptions", desc: "Clinic name and prescriptions in English + Tamil/Hindi/Telugu — all 15 Indian languages supported." },
  { icon: MessageSquare, title: "WhatsApp-First Delivery", desc: "Prescription link sent to patient's WhatsApp instantly. No app download. Works on any phone." },
  { icon: ClipboardList, title: "Complete Patient Records", desc: "Full visit history, vitals trends, lab reports and documents — all in one place." },
  { icon: Calendar, title: "Appointment Scheduling", desc: "Book, manage and convert appointments to queue automatically." },
  { icon: BarChart3, title: "Clinic Analytics", desc: "Top diagnoses, medication trends, doctor performance and patient demographics — all visual." },
];

const ROLES = [
  { icon: "👨‍⚕️", title: "Doctor", items: ["Voice to notes", "AI prescriptions", "Patient history", "10 templates"] },
  { icon: "🏥", title: "Receptionist", items: ["Patient registration", "Token queue", "Vitals entry", "Appointments"] },
  { icon: "👔", title: "Admin", items: ["Staff management", "Analytics", "Clinic settings", "Full access"] },
];

const LANGUAGES = ["Tamil", "Hindi", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Urdu", "Odia", "Assamese"];

const TESTIMONIALS = [
  { text: "I used to spend 3 hours after clinic finishing paperwork. Now I finish everything before the patient leaves the room.", name: "Dr. Rajesh Kumar", role: "General Physician, Chennai", initials: "RK" },
  { text: "My patients are impressed when they get the prescription on WhatsApp. The Tamil prescription header is brilliant.", name: "Dr. Priya Venkatesh", role: "Pediatrician, Coimbatore", initials: "PV" },
  { text: "Finally a clinic software that works on my phone and understands when I speak in Hindi during consultation.", name: "Dr. Amit Sharma", role: "Family Medicine, Delhi", initials: "AS" },
];

const COMPARISON = [
  { feature: "AI Voice Notes", ss: true, practo: false, evital: false, paper: false },
  { feature: "Bilingual Rx", ss: true, practo: false, evital: false, paper: false },
  { feature: "WhatsApp Sharing", ss: true, practo: false, evital: false, paper: false },
  { feature: "Mobile Friendly", ss: true, practo: "partial", evital: false, paper: false },
  { feature: "Regional Language", ss: true, practo: false, evital: false, paper: false },
  { feature: "Modern UI", ss: true, practo: "partial", evital: false, paper: null },
  { feature: "Price/month", ss: "₹799", practo: "₹1,500+", evital: "₹1,200+", paper: "—" },
];

const PLANS_MONTHLY = [
  { name: "Solo Doctor", price: 799, features: ["1 Doctor", "Unlimited patients", "Voice to notes", "All templates", "WhatsApp sharing", "Analytics"], cta: "Start Free Trial", popular: false },
  { name: "Small Clinic", price: 1499, features: ["Up to 5 Doctors", "Everything in Solo", "Multi-doctor queue", "Staff management", "Appointments", "Priority support"], cta: "Start Free Trial", popular: true },
  { name: "Hospital Plan", price: 3999, features: ["Unlimited Doctors", "Everything in Small", "Multi-branch ready", "Custom branding", "Dedicated support", "Custom onboarding"], cta: "Contact Us", popular: false },
];

function ComparisonCell({ value }: { value: boolean | string | null }) {
  if (value === true) return <span className="text-primary font-bold text-lg">✅</span>;
  if (value === false) return <span className="text-muted-foreground">❌</span>;
  if (value === "partial") return <span>⚠️</span>;
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <span className="text-sm font-medium">{value}</span>;
}

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white" style={{ scrollBehavior: "smooth" }}>
      <SeoHead
        title="StethoScribe — AI Clinic Management for Indian Doctors"
        description="AI-powered clinic management and e-prescription platform. Voice to notes in any Indian language. WhatsApp prescription sharing. Built for Indian doctors."
        path="/"
      />
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-lg shadow-sm" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-foreground">StethoScribe</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(l => (
              <button key={l.href} onClick={() => scrollTo(l.href.slice(1))} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/labs"><Button variant="ghost" size="sm">Labs Directory</Button></Link>
            <Link to="/auth"><Button variant="ghost" size="sm">Login</Button></Link>
            <Link to="/auth"><Button size="sm">Start Free Trial <ChevronRight className="h-4 w-4" /></Button></Link>
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-white border-t px-4 py-4 space-y-3 animate-fade-in">
            {NAV_LINKS.map(l => (
              <button key={l.href} onClick={() => scrollTo(l.href.slice(1))} className="block w-full text-left py-2 text-sm font-medium text-foreground">
                {l.label}
              </button>
            ))}
            <Link to="/labs" className="block"><Button variant="ghost" className="w-full" size="sm">Labs Directory</Button></Link>
            <Link to="/auth" className="block"><Button variant="outline" className="w-full" size="sm">Login</Button></Link>
            <Link to="/auth" className="block"><Button className="w-full" size="sm">Start Free Trial</Button></Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: "linear-gradient(135deg, #0D6E6E 0%, #0A8F8F 50%, #0D6E6E 100%)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24 pt-32 grid md:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
              AI-Powered Clinic Management Built for Indian Doctors
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-lg">
              Speak in Tamil, Hindi, Telugu or any Indian language. StethoScribe writes your clinical notes and sends the prescription to your patient's WhatsApp — automatically.
            </p>
            <motion.div className="mt-8 flex flex-wrap gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}>
              <Link to="/auth"><Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold text-base px-6">Start Free Trial — 14 Days Free</Button></Link>
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 text-base">Watch Demo →</Button>
            </motion.div>
            <motion.div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-white/70 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.6 }}>
              <span>🏥 Trusted by doctors</span>
              <span>🇮🇳 Built for India</span>
              <span>🔒 Secure & Private</span>
              <span>📱 Works on any device</span>
            </motion.div>
          </motion.div>
          <motion.div className="hidden md:block" initial={{ opacity: 0, x: 60, rotate: 3 }} animate={{ opacity: 1, x: 0, rotate: 1 }} transition={{ duration: 0.9, delay: 0.3 }}>
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl hover:rotate-0 transition-transform duration-500">
              <div className="bg-white rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm"><Stethoscope className="h-4 w-4" /> StethoScribe Prescription</div>
                <div className="h-px bg-border" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Patient: Arun Kumar</p>
                  <p>Date: 16 Apr 2026</p>
                </div>
                <div className="bg-muted rounded-lg p-3 space-y-1 text-xs">
                  <p className="font-semibold text-foreground">Rx</p>
                  <p>1. Tab Paracetamol 500mg — 1-0-1 × 3 days</p>
                  <p>2. Tab Cetirizine 10mg — 0-0-1 × 5 days</p>
                  <p>3. Syp Ambroxol 15ml — 1-1-1 × 5 days</p>
                </div>
                <div className="text-[10px] text-muted-foreground text-right">Sent via WhatsApp ✓</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 className="text-3xl sm:text-4xl font-bold text-foreground" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            Every day, Indian doctors lose hours to paperwork
          </motion.h2>
          <motion.div className="mt-12 grid sm:grid-cols-3 gap-8" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}>
            {PROBLEMS.map((p, i) => (
              <motion.div key={p.stat} variants={fadeUp} transition={{ duration: 0.5, delay: i * 0.15 }} className="rounded-xl border bg-card p-8 text-center">
                <p.icon className="h-10 w-10 text-primary mx-auto mb-4" />
                <p className="text-2xl font-bold text-primary"><CountUp value={p.stat} /></p>
                <p className="text-muted-foreground mt-2">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 className="text-3xl sm:text-4xl font-bold text-foreground" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.6 }}>
            From patient walk-in to WhatsApp prescription in minutes
          </motion.h2>
          {/* Desktop: horizontal flow */}
          <motion.div className="mt-12 hidden md:flex items-center justify-between gap-4" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {STEPS.map((s, i) => (
              <motion.div key={s.num} variants={fadeUp} transition={{ duration: 0.4, delay: i * 0.12 }} className="flex flex-col items-center gap-2 flex-1 relative">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg flex-shrink-0">{s.num}</div>
                {i < STEPS.length - 1 && <div className="absolute top-6 left-[calc(50%+24px)] w-[calc(100%-48px)] h-0.5 bg-primary/20" />}
                <div className="text-center">
                  <p className="font-semibold text-foreground text-sm">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
          {/* Mobile: vertical timeline */}
          <motion.div className="mt-12 md:hidden flex flex-col items-start gap-0 max-w-xs mx-auto" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {STEPS.map((s, i) => (
              <motion.div key={s.num} variants={slideInLeft} transition={{ duration: 0.4, delay: i * 0.1 }} className="flex items-start gap-4 relative">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0 z-10">{s.num}</div>
                  {i < STEPS.length - 1 && <div className="w-0.5 h-8 bg-primary/20" />}
                </div>
                <div className="pt-2 pb-4">
                  <p className="font-semibold text-foreground text-sm">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 className="text-3xl sm:text-4xl font-bold text-foreground" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.6 }}>
            Everything your clinic needs, powered by AI
          </motion.h2>
          <motion.div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}>
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} variants={fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="rounded-xl border border-primary/10 bg-card p-6 text-left hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-lg">{f.title}</h3>
                <p className="text-muted-foreground text-sm mt-2">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ROLES */}
      <section className="py-20" style={{ background: "linear-gradient(135deg, #0D6E6E, #0A5C5C)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 className="text-3xl sm:text-4xl font-bold text-white" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.6 }}>
            One platform for your entire clinic
          </motion.h2>
          <motion.div className="mt-12 grid sm:grid-cols-3 gap-6" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {ROLES.map((r, i) => (
              <motion.div key={r.title} variants={fadeUp} transition={{ duration: 0.5, delay: i * 0.15 }} className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-6 text-left">
                <div className="text-4xl mb-3">{r.icon}</div>
                <h3 className="text-xl font-bold text-white">{r.title}</h3>
                <ul className="mt-4 space-y-2">
                  {r.items.map(item => (
                    <li key={item} className="text-white/80 text-sm flex items-center gap-2">
                      <Check className="h-4 w-4 text-white/60 flex-shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* LANGUAGES */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 className="text-3xl sm:text-4xl font-bold text-foreground" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.6 }}>
            Prescriptions in your patient's language
          </motion.h2>
          <motion.div className="mt-8 flex flex-wrap justify-center gap-3" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {LANGUAGES.map((l, i) => (
              <motion.span key={l} variants={fadeUp} transition={{ duration: 0.3, delay: i * 0.04 }} className="px-4 py-2 rounded-full border-2 border-primary/30 text-primary font-medium text-sm hover:bg-primary hover:text-primary-foreground transition-colors cursor-default">{l}</motion.span>
            ))}
            <motion.span variants={fadeUp} transition={{ duration: 0.3, delay: 0.5 }} className="px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm">+ more</motion.span>
          </motion.div>
          <motion.p className="mt-6 text-muted-foreground max-w-lg mx-auto" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}>
            Clinic name, doctor name and all prescription labels appear in your regional language automatically.
          </motion.p>
        </div>
      </section>

      {/* LAB WORKFLOW SECTION */}
      <section id="lab-workflow" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-14">
            <span className="inline-block bg-teal-50 text-teal-700 text-xs font-semibold px-4 py-1.5 rounded-full border border-teal-200 mb-4">
              🧪 Lab Integration
            </span>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              From Lab Order to Prescription<br />Without the Patient Revisiting
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg">
              Order investigations during consultation, lab uploads results,
              AI summarises findings, doctor prescribes — all digitally.
              Patient receives prescription on WhatsApp.
            </p>
          </div>

          {/* Flow diagram — horizontal on desktop, vertical on mobile */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-16">
            {[
              { icon: "🩺", role: "Doctor", action: "Orders Investigation", detail: "Selects test, lab and urgency during consultation", color: "teal" },
              { icon: "🧪", role: "Lab", action: "Receives & Uploads Result", detail: "Lab logs in, sees pending orders, uploads PDF or image", color: "blue" },
              { icon: "🤖", role: "AI", action: "Summarises Report", detail: "Flags abnormal values, interprets findings, suggests actions", color: "purple" },
              { icon: "👨‍⚕️", role: "Doctor", action: "Reviews & Prescribes", detail: "Reads AI summary, adds notes, prescribes without patient visit", color: "teal" },
              { icon: "📱", role: "Patient", action: "Gets Prescription", detail: "Receives bilingual prescription on WhatsApp instantly", color: "green" },
            ].map((step, i, arr) => (
              <div key={i} className="flex flex-col md:flex-row items-center gap-4 flex-1">
                <div className="flex flex-col items-center text-center flex-1">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-sm ${
                    step.color === "teal" ? "bg-teal-50 border border-teal-200" :
                    step.color === "blue" ? "bg-blue-50 border border-blue-200" :
                    step.color === "purple" ? "bg-purple-50 border border-purple-200" :
                    "bg-green-50 border border-green-200"
                  }`}>
                    {step.icon}
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                    step.color === "teal" ? "text-teal-600" :
                    step.color === "blue" ? "text-blue-600" :
                    step.color === "purple" ? "text-purple-600" :
                    "text-green-600"
                  }`}>
                    {step.role}
                  </span>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{step.action}</p>
                  <p className="text-xs text-gray-500 max-w-[140px]">{step.detail}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="text-gray-300 text-2xl font-light hidden md:block flex-shrink-0">→</div>
                )}
                {i < arr.length - 1 && (
                  <div className="text-gray-300 text-2xl md:hidden">↓</div>
                )}
              </div>
            ))}
          </div>

          {/* Three feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
            <div className="bg-teal-50 border border-teal-100 rounded-2xl p-6">
              <div className="text-3xl mb-3">🏥</div>
              <h3 className="font-bold text-gray-900 mb-2">Internal & External Labs</h3>
              <p className="text-sm text-gray-600">
                Add your in-house lab as private or connect to external labs
                shared across clinics. Labs can also self-register on the platform.
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="font-bold text-gray-900 mb-2">AI Report Summary</h3>
              <p className="text-sm text-gray-600">
                Claude AI reads the uploaded report, flags abnormal values,
                interprets findings and suggests clinical actions — in seconds.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
              <div className="text-3xl mb-3">🔔</div>
              <h3 className="font-bold text-gray-900 mb-2">Real-time Notifications</h3>
              <p className="text-sm text-gray-600">
                Doctor gets an instant browser notification when a lab uploads
                results. Red badge on sidebar shows pending reviews.
              </p>
            </div>
          </div>

          {/* Lab portal highlight */}
          <div className="bg-gray-900 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🧪</span>
                <span className="text-white font-bold text-lg">Dedicated Lab Portal</span>
              </div>
              <p className="text-gray-400 text-sm max-w-lg">
                Labs get their own login. See pending orders with doctor's clinical
                notes for context. Upload results as PDF or image.
                No complex training needed — simple, clean interface.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                {["Pending order queue", "Doctor's notes visible", "PDF & image upload", "Urgency indicators", "Completed order history"].map(f => (
                  <span key={f} className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-3 py-1 rounded-full">
                    ✓ {f}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="bg-gray-800 rounded-xl p-4 min-w-[200px]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">🧪</span>
                  </div>
                  <span className="text-white text-xs font-semibold">Lab Portal</span>
                </div>
                {[
                  { test: "MRI Brain", urgency: "URGENT", status: "Pending" },
                  { test: "CBC Blood", urgency: "ROUTINE", status: "Pending" },
                  { test: "X-ray Chest", urgency: "STAT", status: "Done" },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-700 rounded-lg p-2.5 mb-2 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-xs font-medium">{item.test}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                        item.urgency === "URGENT" ? "bg-orange-500 text-white" :
                        item.urgency === "STAT" ? "bg-red-500 text-white" :
                        "bg-gray-600 text-gray-300"
                      }`}>
                        {item.urgency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Karur Clinic</span>
                      <span className={`text-xs ${item.status === "Done" ? "text-green-400" : "text-yellow-400"}`}>
                        {item.status === "Done" ? "✓ Uploaded" : "⏳ Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Review workflow highlight */}
          <div className="mt-6 bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-bold text-lg mb-1">Structured Review Workflow</h3>
              <p className="text-teal-100 text-sm">
                Doctor must review the AI summary before prescribing.
                Every result goes through: Pending → Reviewed → Actioned.
                Full audit trail maintained.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {["Pending Review", "Reviewed", "Actioned"].map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    i === 0 ? "bg-yellow-400 text-yellow-900" :
                    i === 1 ? "bg-green-400 text-green-900" :
                    "bg-white text-teal-700"
                  }`}>
                    {s}
                  </div>
                  {i < 2 && <span className="text-teal-300 text-sm">→</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 className="text-3xl sm:text-4xl font-bold text-foreground" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.6 }}>
            Simple pricing, no surprises
          </motion.h2>
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!yearly ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <Switch checked={yearly} onCheckedChange={setYearly} />
            <span className={`text-sm font-medium ${yearly ? "text-foreground" : "text-muted-foreground"}`}>Yearly — Save 20%</span>
          </div>
          <motion.div className="mt-10 grid sm:grid-cols-3 gap-6" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {PLANS_MONTHLY.map((plan, i) => {
              const price = yearly ? Math.round(plan.price * 0.8) : plan.price;
              return (
                <motion.div key={plan.name} variants={fadeUp} transition={{ duration: 0.5, delay: i * 0.15 }} className={`rounded-2xl p-6 text-left transition-all duration-300 ${plan.popular ? "bg-primary text-primary-foreground shadow-xl scale-105 border-2 border-primary" : "bg-card border shadow-sm"}`}>
                  {plan.popular && <span className="text-xs font-bold uppercase tracking-wider opacity-80">⭐ Most Popular</span>}
                  <h3 className={`text-xl font-bold mt-2 ${plan.popular ? "" : "text-foreground"}`}>{plan.name}</h3>
                  <div className="mt-3">
                    {yearly && <span className={`text-sm line-through ${plan.popular ? "opacity-60" : "text-muted-foreground"}`}>₹{plan.price}</span>}
                    <span className="text-4xl font-bold ml-1">₹{price}</span>
                    <span className={`text-sm ${plan.popular ? "opacity-80" : "text-muted-foreground"}`}>/mo</span>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map(f => (
                      <li key={f} className={`text-sm flex items-center gap-2 ${plan.popular ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                        <Check className="h-4 w-4 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="block mt-6">
                    <Button className={`w-full ${plan.popular ? "bg-white text-primary hover:bg-white/90" : ""}`} variant={plan.popular ? "default" : "outline"}>
                      {plan.cta}
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
          <p className="mt-8 text-sm text-muted-foreground">All plans include 14-day free trial. No credit card required.</p>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 className="text-3xl sm:text-4xl font-bold text-foreground" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.6 }}>
            Doctors love StethoScribe
          </motion.h2>
          <motion.div className="mt-12 grid sm:grid-cols-3 gap-6" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}>
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} variants={i === 0 ? slideInLeft : i === 2 ? slideInRight : fadeUp} transition={{ duration: 0.6, delay: i * 0.15 }} className="rounded-xl border bg-card p-6 text-left shadow-sm">
                <div className="flex gap-1 text-yellow-400 mb-3">{Array(5).fill(0).map((_, j) => <Star key={j} className="h-4 w-4 fill-current" />)}</div>
                <p className="text-sm text-muted-foreground italic">"{t.text}"</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">{t.initials}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.6 }}>
            See how StethoScribe compares
          </motion.h2>
          <motion.div className="mt-10 overflow-x-auto -mx-4 px-4" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}>
            <table className="w-full text-xs sm:text-sm min-w-0">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 sm:py-3 sm:px-3 text-muted-foreground font-medium">Feature</th>
                  <th className="py-2 px-1.5 sm:py-3 sm:px-3 font-bold text-primary bg-primary/5 rounded-t-lg whitespace-nowrap">Stetho</th>
                  <th className="py-2 px-1.5 sm:py-3 sm:px-3 text-muted-foreground font-medium">Practo</th>
                  <th className="py-2 px-1.5 sm:py-3 sm:px-3 text-muted-foreground font-medium">eVital</th>
                  <th className="py-2 px-1.5 sm:py-3 sm:px-3 text-muted-foreground font-medium">Paper</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : ""}>
                    <td className="text-left py-2 px-2 sm:py-3 sm:px-3 font-medium text-foreground whitespace-nowrap">{row.feature}</td>
                    <td className="py-2 px-1.5 sm:py-3 sm:px-3 bg-primary/5"><ComparisonCell value={row.ss} /></td>
                    <td className="py-2 px-1.5 sm:py-3 sm:px-3"><ComparisonCell value={row.practo} /></td>
                    <td className="py-2 px-1.5 sm:py-3 sm:px-3"><ComparisonCell value={row.evital} /></td>
                    <td className="py-2 px-1.5 sm:py-3 sm:px-3"><ComparisonCell value={row.paper} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-20" style={{ background: "linear-gradient(135deg, #0D6E6E, #0A8F8F)" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 className="text-3xl sm:text-4xl font-bold text-white" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.6 }}>
            Ready to transform your clinic?
          </motion.h2>
          <motion.p className="mt-4 text-lg text-white/80" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}>
            Join doctors across India who save hours every day with AI-powered clinic management.
          </motion.p>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.4 }}>
            <Link to="/auth">
              <Button size="lg" className="mt-8 bg-white text-primary hover:bg-white/90 font-semibold text-base px-8">
                Start Your Free Trial Today →
              </Button>
            </Link>
          </motion.div>
          <p className="mt-4 text-white/60 text-sm">No credit card required • Setup in 10 minutes • Cancel anytime</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="py-12" style={{ background: "#1A1A2E" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope className="h-6 w-6 text-white" />
                <span className="text-lg font-bold text-white">StethoScribe</span>
              </div>
              <p className="text-sm text-gray-400">AI-powered clinic management built for Indian doctors.</p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <button onClick={() => scrollTo("features")} className="text-gray-400 hover:text-white transition-colors">Features</button>
              <button onClick={() => scrollTo("pricing")} className="text-gray-400 hover:text-white transition-colors">Pricing</button>
              <Link to="/labs" className="text-gray-400 hover:text-white transition-colors">Labs Directory</Link>
              <Link to="/register-lab" className="text-gray-400 hover:text-white transition-colors">Register Your Lab</Link>
              <button onClick={() => scrollTo("contact")} className="text-gray-400 hover:text-white transition-colors">Contact</button>
              <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">Terms of Service</Link>
              <Link to="/dpa" className="text-gray-400 hover:text-white transition-colors">Data Processing Agreement</Link>
              <Link to="/security" className="text-gray-400 hover:text-white transition-colors">Security</Link>
            </div>
            <div className="text-sm text-gray-400 space-y-1">
              <p>📧 hello@stethoscribe.app</p>
              <p>📱 +91 XXXXX XXXXX</p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap justify-between text-xs text-gray-500">
            <span>© 2026 StethoScribe. All rights reserved.</span>
            <span>Made with ❤️ in India</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
