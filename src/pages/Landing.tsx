import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import patientProfileAsset from "@/assets/landing/patient-profile.png.asset.json";
import "./Landing.css";

const LAPSE_RATE = 0.49;
const WHATSAPP_NUMBER = "919042866990";
const WA_MESSAGE = "Hi, I'd like to know more about FlowCare for my clinic.";
const whatsappUrl = (message: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

function formatINR(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(2).replace(/\.00$/, "")}L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.07-1.35A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.6 0-3.09-.44-4.37-1.2l-.31-.19-3.13.83.84-3.05-.2-.32A7.94 7.94 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" /></svg>;
}

const features = [
  ["Session tracking", "Every treatment plan, every session used and remaining, tracked automatically — no spreadsheet, no guessing.", <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>],
  ["Electronic Health Records", "Every patient's history, notes, and documents in one digital record — nothing lost in a paper file or a register.", <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6M9 9h1"/></>],
  ["Automated, GST-ready billing", "Invoices generated automatically at each visit — no manual bill-writing, no end-of-day reconciliation headache.", <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>],
  ["Treatment progress tracking", "Photos and feedback logged at every session, so progress across a treatment plan is visible at a glance — not just remembered.", <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>],
  ["Automatic WhatsApp follow-ups", "If a patient's overdue for their next session, a reminder goes out on its own — before front desk even has to think about it.", <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>],
  ["Lead & enquiry follow-up", "New enquiries that haven't booked yet get tracked the same way lapsed patients do — nobody falls through simply because they hadn't started treatment yet.", <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>],
  ["A queue that catches what reminders miss", "If someone still hasn't booked, they land in a call-task queue for your front desk — nothing depends on someone remembering.", <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/></>],
  ["One view per patient", "Appointments, payments, notes, and history — all in one place, not spread across five tabs.", <><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 9v11"/></>],
] as const;

const faqs = [
  ["Does FlowCare integrate with Practo Ray, MocDoc, or whatever I use now?", "No — FlowCare isn't a plug-in or add-on that connects to your existing software. It's a standalone system built to run your clinic on its own, not sit alongside another tool."],
  ["Do I have to stop using my current system once I switch?", "Yes. Running two systems side by side usually causes more confusion than it solves — once you're set up on FlowCare, it becomes your main system."],
  ["Will I lose my existing patient records?", "No — your existing patient data is migrated over during setup, so your history moves with you rather than starting from zero."],
  ["What if my staff aren't comfortable with new software?", "Setup and training are done live, in person or by call — not a manual you're left to figure out alone."],
  ["What if my clinic doesn't sell treatment plans?", "FlowCare is built specifically for clinics running multi-session treatment plans — wellness, aesthetic, physio, and dental. If that's not your clinic, it may not be the right fit yet."],
  ["If my clinic relies on several connected tools today, is FlowCare still a fit?", "Possibly not yet. FlowCare is built to be your one self-contained system, not a piece that plugs into a larger stack of separate tools. If your clinic depends on deep integrations across multiple platforms, that's worth talking through honestly before switching."],
  ["Is my patients' data secure?", "Your patient data stays private to your clinic — it's never shared or used for anything beyond running your own clinic."],
];

function useReveal() {
  const observerRef = useRef<IntersectionObserver>();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    observerRef.current = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("in"); observerRef.current?.unobserve(entry.target); }
    }), { threshold: 0.12 });
    document.querySelectorAll(".landing-page .reveal").forEach(element => observerRef.current?.observe(element));
    return () => observerRef.current?.disconnect();
  }, []);
}

export default function Landing() {
  const [patients, setPatients] = useState(60);
  const [price, setPrice] = useState(2000);
  const [sessions, setSessions] = useState(8);
  const [showFloat, setShowFloat] = useState(false);
  useReveal();
  useEffect(() => {
    const onScroll = () => setShowFloat(window.scrollY > 420);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const lostPatients = patients * LAPSE_RATE;
  const averageUsed = sessions <= 1 ? sessions : Math.min(2, sessions - 1);
  const monthlyLeak = lostPatients * Math.max(sessions - averageUsed, 0) * price;
  const calculatorMessage = `Hi, I saw on your site I might be losing around ${formatINR(monthlyLeak)}/month to lapsed patients. Can you tell me more?`;

  return <div className="landing-page">
    <Helmet>
      <title>FlowCare — Clinic Treatment Plan Tracking</title>
      <meta name="description" content="Track every clinic treatment plan, catch lapsed patients, and automate WhatsApp follow-ups with FlowCare." />
      <link rel="canonical" href="https://flowcarenaturo.lovable.app/" />
      <meta property="og:title" content="FlowCare — Clinic Treatment Plan Tracking" />
      <meta property="og:description" content="Track every clinic treatment plan, catch lapsed patients, and automate WhatsApp follow-ups with FlowCare." />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
    </Helmet>

    <header className="landing-header"><div className="nav">
      <Link to="/" className="brand" aria-label="FlowCare home"><BrandLogo height={30} /></Link>
      <nav className="nav-links" aria-label="Website"><a href="#calc">Your number</a><a href="#how">How it works</a><a href="#faq">FAQ</a></nav>
      <div className="auth-links"><Link to="/login">Sign in</Link><Link to="/login?tab=signup">Sign up</Link><a href={whatsappUrl(WA_MESSAGE)} className="nav-cta" target="_blank" rel="noreferrer"><WhatsAppIcon size={15}/><span className="nav-cta-label">Talk to us</span></a></div>
    </div></header>

    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 0 }}>
        <span className="eyebrow">For clinics running multi-session treatment plans</span>
        <h1 className="headline">Most clinics don't know how many patients stop mid-treatment. <em>You could</em>, in the next 20 seconds.</h1>
        <div className="trust-chip"><b>49%</b> of patients stop mid-treatment <span className="dot">·</span> <b>₹13L/mo</b> unbilled — from one clinic's real billing data</div>
        <p className="sub">FlowCare tracks every treatment plan and catches patients who lapse — before they're gone for good.</p>
        <div className="hero-ctas"><a href="#calc" className="btn-primary teal pulse"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></svg>See your number</a><a href="#how" className="btn-ghost">See how it works ↓</a></div>
        <div className="hero-microcopy"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4A5F68" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>No sales pitch — just your own numbers.</div>
        <div className="flow-stage"><div className="flow-label">Patients on a treatment plan, this month</div><svg className="flow" viewBox="0 0 620 130"><line x1="10" y1="35" x2="600" y2="35" stroke="#D7E0DD" strokeWidth="1.5" strokeDasharray="1 6" strokeLinecap="round"/><rect x="255" y="14" width="2" height="42" fill="#1C8C82" opacity=".35"/><text x="262" y="10" fontFamily="IBM Plex Mono" fontSize="10" fill="#4A5F68">session tracked</text><text x="330" y="112" fontFamily="IBM Plex Mono" fontSize="10" fill="#DB9A3C">lapses mid-plan</text>{[0,1.2,3.6].map(delay => <circle key={delay} className="dot" cx="10" cy="35" r="5" fill="#3FA66B" style={{animationDelay:`${delay}s`}}/>)}{[.6,2.4].map(delay => <circle key={delay} className="dot leak" cx="10" cy="35" r="5" fill="#DB9A3C" style={{animationDelay:`${delay}s`}}/>)}</svg><div className="flow-caption"><span>Every patient agrees to a plan.</span><span><span className="kept">~51% finish it</span> · <span className="lost">~49% lapse</span></span></div></div>
      </section>

      <svg className="wave-divider" viewBox="0 0 1080 40" preserveAspectRatio="none"><path d="M0 20C90 5 180 35 270 20C360 5 450 35 540 20C630 5 720 35 810 20C900 5 990 35 1080 20" stroke="#D7E0DD" strokeWidth="1.5" fill="none"/></svg>
      <section style={{padding:"40px 0 60px"}}><div className="segment-strip reveal">{[
        ["Aesthetic & Skin","Laser, facials, injectables",<><path d="M12 2a5 5 0 015 5c0 3-2 4-2 7h-6c0-3-2-4-2-7a5 5 0 015-5z"/><path d="M9 21h6"/></>],
        ["Physiotherapy","Rehab & recovery plans",<path d="M6 4v16M18 4v16M6 12h12"/>],
        ["Dental","Ortho & implant plans",<><path d="M12 3c-2 3-3 5-3 8a3 3 0 006 0c0-3-1-5-3-8z"/><path d="M9 15v6M15 15v6"/></>],
        ["Wellness","Multi-therapy centres",<><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>]
      ].map(([title,desc,icon]) => <div className="segment-item" key={String(title)}><div className="seg-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2FAE9C" strokeWidth="1.8">{icon}</svg></div><h4>{title}</h4><p>{desc}</p></div>)}</div></section>

      <section id="calc"><div className="section-head reveal"><span className="kicker">Try it with your own numbers</span><h2 className="section-title">What might your clinic be leaving on the table?</h2><p className="section-body">A rough estimate — move the sliders to match your clinic.</p></div><div className="calc-card reveal"><div>
        <div className="calc-field"><label>New patients per month: <span className="calc-value">{patients}</span></label><input aria-label="New patients per month" type="range" min="10" max="250" value={patients} step="5" onChange={e=>setPatients(Number(e.target.value))}/></div>
        <div className="calc-field"><label>Average session price: <span className="calc-value">₹{price.toLocaleString("en-IN")}</span></label><input aria-label="Average session price" type="range" min="500" max="5000" value={price} step="100" onChange={e=>setPrice(Number(e.target.value))}/></div>
        <div className="calc-field"><label>Typical sessions per treatment plan: <span className="calc-value">{sessions}</span></label><input aria-label="Typical sessions per treatment plan" type="range" min="1" max="16" value={sessions} step="1" onChange={e=>setSessions(Number(e.target.value))}/></div>
      </div><div className="calc-result"><span className="kicker">Estimated monthly leak</span><div className="calc-amount">{formatINR(monthlyLeak)}</div><div className="calc-amount-label">at ~49% of patients lapsing before finishing a {sessions}-session plan</div><a href={whatsappUrl(calculatorMessage)} className="btn-primary" style={{marginTop:20,width:"fit-content"}} target="_blank" rel="noreferrer"><WhatsAppIcon/>Message us this number on WhatsApp</a><div className="calc-disclaimer">Illustrative only, based on the ~49% of patients who stop mid-treatment in one clinic's real data. Your clinic's actual number may differ — FlowCare calculates it precisely once you're set up.</div></div></div>
      </section>

      <section style={{paddingTop:0}}><div className="section-head reveal"><span className="kicker">The lapse most clinics can't see</span><h2 className="section-title">Patients commit to a treatment plan. You just can't see who quietly stops halfway through.</h2><p className="section-body">No system, no reminders, no way of knowing how many patients agreed to a multi-session plan and stopped showing up partway through — until someone actually goes and checks the numbers by hand.</p></div><div className="proof reveal"><span className="kicker">From one clinic's own billing data</span><div className="proof-grid"><div><div className="stat-num">49%</div><div className="stat-label">of patients lapse before finishing their treatment plan — completely invisible until the billing data was actually pulled and checked.</div></div><div><div className="stat-num green">₹13L<span style={{fontSize:18}}>/mo</span></div><div className="stat-label">in unbilled sessions at just one mid-size clinic — patients who started a plan, paid session-by-session for a while, and never came back to finish it.</div></div></div><div className="proof-note">Based on 6 months of real billing data from a wellness clinic in Chennai, where treatment plan length varies by patient. Your own numbers will differ — the calculator above gives you a rough version for your clinic specifically.</div></div><div className="inline-cta reveal"><p>Want to know if this is happening at your clinic too?</p><a href={whatsappUrl(WA_MESSAGE)} className="btn-primary" target="_blank" rel="noreferrer"><WhatsAppIcon size={15}/>Message us on WhatsApp</a></div></section>

      <section id="how"><div className="section-head reveal"><span className="kicker">How it works</span><h2 className="section-title">Built around how your clinic already runs</h2><p className="section-body">A standalone system built around how your clinic's day already runs — front desk, doctor, billing — so it feels familiar, not foreign, even though it replaces what you use today.</p></div>
        <div className="product-shot-wrap reveal"><img src={patientProfileAsset.url} alt="FlowCare patient profile showing treatment progress, contact history, appointments, and billing" className="product-shot" loading="lazy"/></div>
        <div className="feature-grid reveal">{features.map(([title,desc,icon]) => <article className="feature" key={title}><div className="feature-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2FAE9C" strokeWidth="2">{icon}</svg></div><h3>{title}</h3><p>{desc}</p></article>)}</div>
        <div className="inline-cta reveal"><p>See these features on your own clinic's data.</p><a href={whatsappUrl(WA_MESSAGE)} className="btn-primary" target="_blank" rel="noreferrer"><WhatsAppIcon size={15}/>Book a live walkthrough</a></div>
      </section>

      <section><div className="section-head reveal"><span className="kicker">What actually changes</span><h2 className="section-title">Not a comparison with another tool — a comparison with today</h2></div><div className="compare-grid reveal"><div className="compare-col"><div className="compare-label before">Right now</div><ul className="compare-list">{["A register, a spreadsheet, or memory — whichever staff happens to update","No one notices a patient stopped mid-plan until someone happens to check","Follow-up depends on someone remembering to call","Bills written by hand at the counter, reconciled at the end of the day","Patient history split across paper files and WhatsApp chats"].map(x=><li key={x}>{x}</li>)}</ul></div><div className="compare-col"><div className="compare-label after">With FlowCare</div><ul className="compare-list">{["Every treatment plan and session tracked automatically, for every patient","A lapsed patient is flagged the moment they're overdue — not weeks later","WhatsApp reminders go out on their own, backed by a call-task queue","Invoices generated at the visit, GST-ready, no manual write-up","One record per patient — history, notes, and payments together"].map(x=><li key={x}>{x}</li>)}</ul></div></div></section>

      <section style={{paddingTop:0}}><div className="founder-note reveal"><div className="founder-mark">“</div><p>I found this problem by going through one clinic's own billing data myself — line by line, six months of it. Nearly half of every patient who walked in never came back to finish their treatment plan, and nobody at the clinic had any way of knowing that until I checked. FlowCare exists because that shouldn't take a manual audit to find out.</p><div className="founder-sign">— Founder, FlowCare</div></div></section>

      <section id="faq" style={{paddingTop:0}}><div className="section-head reveal"><span className="kicker">Common questions</span><h2 className="section-title">Before you ask</h2></div><div className="faq-list reveal">{faqs.map(([q,a])=><article className="faq-item" key={q}><h3>{q}</h3><p>{a}</p></article>)}</div></section>

      <section><div className="pricing-card reveal" style={{justifyContent:"center",textAlign:"center",flexDirection:"column"}}><h2 className="section-title" style={{fontSize:26,marginBottom:8}}>See where your clinic stands</h2><p className="section-body" style={{marginBottom:20}}>No sales pitch — just tell us about your clinic and we'll take it from there.</p><a href={whatsappUrl(WA_MESSAGE)} className="btn-primary" target="_blank" rel="noreferrer"><WhatsAppIcon/>Message us on WhatsApp</a></div></section>
    </main>

    <a href={whatsappUrl(WA_MESSAGE)} className={`float-wa${showFloat ? " show" : ""}`} target="_blank" rel="noreferrer" aria-label="Message us on WhatsApp"><WhatsAppIcon size={26}/></a>
    <footer className="landing-footer"><div className="wrap"><div className="footer-row"><Link to="/" className="brand"><BrandLogo height={24}/></Link><div className="auth-links"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms</Link><Link to="/dpa">DPA</Link><Link to="/security">Security</Link><Link to="/login">Sign in</Link></div><a href={whatsappUrl(WA_MESSAGE)} className="btn-ghost" style={{borderBottom:"none"}} target="_blank" rel="noreferrer">Message on WhatsApp →</a></div></div></footer>
  </div>;
}
