import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const PAPER = "#F6F8F7";
const PAPER_2 = "#EFF3F1";
const INK = "#0E2A38";
const INK_SOFT = "#4A5F68";
const TEAL = "#1C8C82";
const GREEN = "#3FA66B";
const AMBER = "#DB9A3C";
const LINE = "#D7E0DD";
const WA = "#25D366";
const WA_DARK = "#1DA851";

const LAPSE_RATE = 0.49;

function formatINR(n: number) {
  if (n >= 100000) {
    return "₹" + (n / 100000).toFixed(2).replace(/\.00$/, "") + "L";
  }
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function LogoSvg({ width = 30, height = 30 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 40 40" fill="none">
      <path
        d="M4 22C10 14 14 30 20 22C26 14 30 30 36 22"
        stroke="url(#landing-logo-gradient)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="landing-logo-gradient" x1="4" y1="22" x2="36" y2="22">
          <stop stopColor={TEAL} />
          <stop offset="1" stopColor={GREEN} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.07-1.35A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.6 0-3.09-.44-4.37-1.2l-.31-.19-3.13.83.84-3.05-.2-.32A7.94 7.94 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
    </svg>
  );
}

function SectionHead({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <div className="max-w-[640px] mb-12">
      <span className="mb-3.5 block font-mono text-xs uppercase tracking-[0.06em]" style={{ color: INK_SOFT }}>
        {kicker}
      </span>
      <h2 className="font-serif text-[clamp(26px,3.4vw,36px)] leading-[1.2]" style={{ color: INK }}>
        {title}
      </h2>
      {body && (
        <p className="mt-4 text-base leading-[1.65]" style={{ color: INK_SOFT }}>
          {body}
        </p>
      )}
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      className="group bg-white p-7 md:p-8 transition-all duration-200 hover:-translate-y-[3px]"
      style={{
        borderRight: `1px solid ${LINE}`,
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      <div
        className="mb-5 flex h-[38px] w-[38px] items-center justify-center rounded-[10px] transition-colors duration-200 group-hover:bg-[#1C8C82]"
        style={{ background: "rgba(28,140,130,0.08)" }}
      >
        <div className="[&_svg]:stroke-[#1C8C82] group-hover:[&_svg]:stroke-white">{icon}</div>
      </div>
      <h3 className="mb-2 font-serif text-[19px]" style={{ color: INK }}>
        {title}
      </h3>
      <p className="text-sm leading-[1.6]" style={{ color: INK_SOFT }}>
        {desc}
      </p>
    </div>
  );
}

function useScrollReveal() {
  const observedRef = useRef<Set<Element>>(new Set());
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const targets = document.querySelectorAll(".landing-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("landing-reveal-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    targets.forEach((el) => {
      observedRef.current.add(el);
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
}

export default function Landing() {
  const [patients, setPatients] = useState(60);
  const [price, setPrice] = useState(2000);
  const [sessions, setSessions] = useState(8);
  const [showFloatWa, setShowFloatWa] = useState(false);

  const avgSessionsBeforeLapse = Math.min(2, sessions - 1 > 0 ? 2 : 1);
  const lostPatients = patients * LAPSE_RATE;
  const unbilledSessionsPerPatient = Math.max(sessions - avgSessionsBeforeLapse, 0);
  const monthlyLeak = lostPatients * unbilledSessionsPerPatient * price;
  const waText = encodeURIComponent(
    `Hi, I saw on your site I might be losing around ${formatINR(monthlyLeak)}/month to lapsed patients. Can you tell me more?`,
  );

  useScrollReveal();

  useEffect(() => {
    const onScroll = () => setShowFloatWa(window.scrollY > 420);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const brandName = "FlowCare";
  const canonicalUrl = "https://flowcarenaturo.lovable.app/";
  const description =
    "FlowCare is your remote admin partner for clinics running multi-session treatment plans. Track every session, catch lapsed patients, and automate WhatsApp follow-ups — before revenue slips through the cracks.";

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: PAPER,
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(14,42,56,0.05) 1px, transparent 0)",
        backgroundSize: "22px 22px",
        color: INK,
        fontFamily: "'Work Sans', Inter, system-ui, sans-serif",
      }}
    >
      <Helmet>
        <title>{`${brandName} — Your Remote Admin Partner`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={`${brandName} — Your Remote Admin Partner`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${brandName} — Your Remote Admin Partner`} />
        <meta name="twitter:description" content={description} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: brandName,
            url: canonicalUrl,
            logo: "https://flowcarenaturo.lovable.app/favicon.png",
            description,
            sameAs: [],
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: brandName,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "INR",
              description: "14-day trial, then subscription plans",
            },
            description,
          })}
        </script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <style>{`
        .font-serif { font-family: 'Fraunces', serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        .landing-reveal {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .landing-reveal-in {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-reveal {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
        .dot-travel {
          animation: travel 6s linear infinite;
        }
        .dot-leak {
          animation: leakpath 6s linear infinite;
        }
        @keyframes travel {
          0% { transform: translateX(0); opacity: 0; }
          8% { opacity: 1; }
          92% { opacity: 1; }
          100% { transform: translateX(560px); opacity: 0; }
        }
        @keyframes leakpath {
          0% { transform: translate(0,0); opacity: 0; }
          8% { opacity: 1; }
          45% { transform: translate(230px,0); opacity: 1; }
          70% { transform: translate(280px,60px); opacity: 0.6; }
          78% { opacity: 0; }
          100% { transform: translate(280px,60px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dot-travel, .dot-leak { animation: none; opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: "rgba(246,248,247,0.88)", backdropFilter: "blur(8px)", borderColor: LINE }}
      >
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoSvg width={30} height={30} />
            <span className="font-serif text-xl font-semibold" style={{ color: INK }}>
              FlowCare
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden text-sm font-medium sm:inline-block" style={{ color: INK }}>
              Sign in
            </Link>
            <Link
              to="/login?tab=signup"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white sm:inline-block"
              style={{ background: TEAL }}
            >
              Sign up
            </Link>
            <a
              href="https://wa.me/?text=Hi,%20I%27d%20like%20to%20know%20more%20about%20FlowCare%20for%20my%20clinic."
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: WA, boxShadow: "0 1px 2px rgba(14,42,56,0.06)" }}
            >
              <WhatsAppIcon size={15} />
              Talk to us
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1080px] px-5 sm:px-8">
        {/* Hero */}
        <section className="relative pt-20 pb-10">
          <div
            className="pointer-events-none absolute -top-28 -right-40 -z-10 h-[520px] w-[520px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(63,166,107,0.14), rgba(28,140,130,0.08) 55%, transparent 72%)",
            }}
          />
          <span
            className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-[0.06em]"
            style={{ color: TEAL, background: "rgba(28,140,130,0.08)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TEAL }} />
            For clinics running multi-session treatment plans
          </span>
          <h1
            className="max-w-[820px] font-serif font-medium leading-[1.08]"
            style={{ fontSize: "clamp(34px, 5vw, 56px)", color: INK }}
          >
            Nearly half your patients might be <em style={{ color: TEAL, fontStyle: "normal" }}>lapsing</em> right now — and you'd have no way of knowing.
          </h1>
          <p className="mt-6 max-w-[560px] text-lg leading-[1.6]" style={{ color: INK_SOFT }}>
            Bringing visibility to your clinic, so nothing quietly slips through the cracks. FlowCare tracks every session against every treatment plan, and catches patients who lapse partway through — before they're gone for good.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <a
              href="#calc"
              className="inline-flex items-center gap-2.5 rounded-full px-6 py-4 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-xl"
              style={{
                background: TEAL,
                boxShadow: "0 1px 2px rgba(14,42,56,0.08)",
                animation: "pulseGlowTeal 2.6s ease-in-out infinite",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 5-6" />
              </svg>
              See your number
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 border-b pb-3.5 pt-3 text-base font-medium"
              style={{ color: INK, borderColor: LINE }}
            >
              See how it works ↓
            </a>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm" style={{ color: INK_SOFT }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4A5F68" strokeWidth="2">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Takes 20 seconds — move a few sliders, see your estimate.
          </p>

          {/* Flow visualization */}
          <div
            className="mt-16 overflow-hidden rounded-[20px] border bg-white p-6 pb-5"
            style={{ borderColor: LINE }}
          >
            <div className="mb-3.5 pl-2 font-mono text-[11px] uppercase tracking-[0.05em]" style={{ color: INK_SOFT }}>
              Patients on a treatment plan, this month
            </div>
            <svg className="block h-auto w-full" viewBox="0 0 620 130" xmlns="http://www.w3.org/2000/svg">
              <line x1="10" y1="35" x2="600" y2="35" stroke={LINE} strokeWidth="1.5" strokeDasharray="1 6" strokeLinecap="round" />
              <rect x="255" y="14" width="2" height="42" fill={TEAL} opacity="0.35" />
              <text x="262" y="10" fontFamily="IBM Plex Mono" fontSize="10" fill={INK_SOFT}>
                session tracked
              </text>
              <text x="330" y="112" fontFamily="IBM Plex Mono" fontSize="10" fill={AMBER}>
                lapses mid-plan
              </text>
              <circle className="dot-travel" cx="10" cy="35" r="5" fill={GREEN} style={{ animationDelay: "0s" }} />
              <circle className="dot-travel" cx="10" cy="35" r="5" fill={GREEN} style={{ animationDelay: "1.2s" }} />
              <circle className="dot-travel" cx="10" cy="35" r="5" fill={GREEN} style={{ animationDelay: "3.6s" }} />
              <circle className="dot-leak" cx="10" cy="35" r="5" fill={AMBER} style={{ animationDelay: "0.6s" }} />
              <circle className="dot-leak" cx="10" cy="35" r="5" fill={AMBER} style={{ animationDelay: "2.4s" }} />
            </svg>
            <div
              className="mt-3 flex justify-between border-t px-2 pt-3.5 font-mono text-xs"
              style={{ color: INK_SOFT, borderColor: LINE }}
            >
              <span>Every patient agrees to a plan.</span>
              <span>
                <span className="font-semibold" style={{ color: GREEN }}>
                  ~51% finish it
                </span>{" "}
                ·{" "}
                <span className="font-semibold" style={{ color: AMBER }}>
                  ~49% lapse
                </span>
              </span>
            </div>
          </div>
        </section>

        <style>{`
          @keyframes pulseGlowTeal {
            0%,100% { box-shadow: 0 0 0 0 rgba(28,140,130,0.32); }
            50% { box-shadow: 0 0 0 10px rgba(28,140,130,0); }
          }
        `}</style>

        {/* Wave divider */}
        <svg className="block h-10 w-full" viewBox="0 0 1080 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0 20C90 5 180 35 270 20C360 5 450 35 540 20C630 5 720 35 810 20C900 5 990 35 1080 20"
            stroke={LINE}
            strokeWidth="1.5"
            fill="none"
          />
        </svg>

        {/* Segments */}
        <section className="py-10 md:py-16">
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: LINE, background: LINE }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px">
              {[
                {
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8">
                      <path d="M12 2a5 5 0 015 5c0 3-2 4-2 7h-6c0-3-2-4-2-7a5 5 0 015-5z" />
                      <path d="M9 21h6" />
                    </svg>
                  ),
                  title: "Aesthetic & Skin",
                  desc: "Laser, facials, injectables",
                },
                {
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8">
                      <path d="M6 4v16M18 4v16M6 12h12" />
                    </svg>
                  ),
                  title: "Physiotherapy",
                  desc: "Rehab & recovery plans",
                },
                {
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8">
                      <path d="M12 3c-2 3-3 5-3 8a3 3 0 006 0c0-3-1-5-3-8z" />
                      <path d="M9 15v6M15 15v6" />
                    </svg>
                  ),
                  title: "Dental",
                  desc: "Ortho & implant plans",
                },
                {
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                    </svg>
                  ),
                  title: "Wellness",
                  desc: "Multi-therapy centres",
                },
              ].map((s) => (
                <div key={s.title} className="bg-white p-5 text-center transition-colors hover:bg-[rgba(28,140,130,0.05)]">
                  <div className="mx-auto mb-3 flex h-[34px] w-[34px] items-center justify-center">{s.icon}</div>
                  <h4 className="text-sm font-semibold" style={{ color: INK }}>
                    {s.title}
                  </h4>
                  <p className="mt-1 text-xs" style={{ color: INK_SOFT }}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Leak Calculator */}
        <section id="calc" className="py-16 md:py-20">
          <SectionHead
            kicker="Try it with your own numbers"
            title="What might your clinic be leaving on the table?"
            body="A rough estimate — move the sliders to match your clinic."
          />
          <div
            className="grid gap-8 rounded-[20px] border bg-white p-6 md:grid-cols-2 md:p-10"
            style={{ borderColor: LINE }}
          >
            <div>
              <div className="mb-6">
                <label className="mb-2 block font-mono text-xs" style={{ color: INK_SOFT }}>
                  New patients per month:{" "}
                  <span className="text-base font-semibold" style={{ color: TEAL }}>
                    {patients}
                  </span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={250}
                  step={5}
                  value={patients}
                  onChange={(e) => setPatients(Number(e.target.value))}
                  className="w-full accent-[#1C8C82]"
                  style={{ accentColor: TEAL }}
                />
              </div>
              <div className="mb-6">
                <label className="mb-2 block font-mono text-xs" style={{ color: INK_SOFT }}>
                  Average session price:{" "}
                  <span className="text-base font-semibold" style={{ color: TEAL }}>
                    ₹{price.toLocaleString("en-IN")}
                  </span>
                </label>
                <input
                  type="range"
                  min={500}
                  max={5000}
                  step={100}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: TEAL }}
                />
              </div>
              <div>
                <label className="mb-2 block font-mono text-xs" style={{ color: INK_SOFT }}>
                  Typical sessions per treatment plan:{" "}
                  <span className="text-base font-semibold" style={{ color: TEAL }}>
                    {sessions}
                  </span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={16}
                  step={1}
                  value={sessions}
                  onChange={(e) => setSessions(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: TEAL }}
                />
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-2xl p-7" style={{ background: INK }}>
              <span className="mb-2.5 font-mono text-xs uppercase tracking-[0.06em]" style={{ color: "rgba(246,248,247,0.55)" }}>
                Estimated monthly leak
              </span>
              <div className="font-mono text-[38px] font-semibold leading-[1.1]" style={{ color: AMBER }}>
                {formatINR(monthlyLeak)}
              </div>
              <p className="mt-2 text-sm leading-[1.5]" style={{ color: "rgba(246,248,247,0.7)" }}>
                at ~49% of patients lapsing before finishing a {sessions}-session plan
              </p>
              <a
                href={`https://wa.me/?text=${waText}`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: WA }}
              >
                <WhatsAppIcon size={16} />
                Message us this number on WhatsApp
              </a>
              <p className="mt-5 text-xs leading-[1.5]" style={{ color: "rgba(246,248,247,0.4)" }}>
                Illustrative only, based on the ~49% lapse rate seen in one clinic's real data. Your clinic's actual number may differ — FlowCare calculates it precisely once you're set up.
              </p>
            </div>
          </div>
        </section>

        {/* Problem / Proof */}
        <section className="pb-16 md:pb-20">
          <SectionHead
            kicker="The lapse most clinics can't see"
            title="Patients commit to a treatment plan. You just can't see who quietly stops halfway through."
            body="No system, no reminders, no way of knowing how many patients agreed to a multi-session plan and stopped showing up partway through — until someone actually goes and checks the numbers by hand."
          />
          <div className="rounded-3xl p-8 md:p-14" style={{ background: INK, color: PAPER }}>
            <span className="mb-8 block font-mono text-xs uppercase tracking-[0.06em]" style={{ color: "rgba(246,248,247,0.6)" }}>
              From one clinic's own billing data
            </span>
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <div className="font-mono text-[clamp(34px,4.2vw,48px)] font-semibold leading-none" style={{ color: AMBER }}>
                  49%
                </div>
                <p className="mt-3 max-w-[320px] text-sm leading-[1.5]" style={{ color: "rgba(246,248,247,0.75)" }}>
                  of patients lapse before finishing their treatment plan — completely invisible until the billing data was actually pulled and checked.
                </p>
              </div>
              <div>
                <div className="font-mono text-[clamp(34px,4.2vw,48px)] font-semibold leading-none" style={{ color: "#7CD9A5" }}>
                  ₹13L<span className="text-lg">/mo</span>
                </div>
                <p className="mt-3 max-w-[320px] text-sm leading-[1.5]" style={{ color: "rgba(246,248,247,0.75)" }}>
                  in unbilled sessions at just one mid-size clinic — patients who started a plan, paid session-by-session for a while, and never came back to finish it.
                </p>
              </div>
            </div>
            <p className="mt-10 border-t pt-6 text-xs leading-[1.6]" style={{ color: "rgba(246,248,247,0.55)", borderColor: "rgba(246,248,247,0.15)" }}>
              Based on 6 months of real billing data from a wellness clinic in Chennai, where treatment plan length varies by patient. Your own numbers will differ — the calculator above gives you a rough version for your clinic specifically.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="pb-16 md:pb-20">
          <SectionHead
            kicker="How it works"
            title="Built around how your clinic already runs"
            body="Not a system you switch to — a layer that plugs into your existing front desk, doctor, and billing flow. Everything from records to reminders, in one place."
          />

          <div
            className="rounded-3xl px-5 pb-0 pt-10 md:px-10"
            style={{ background: "linear-gradient(180deg, rgba(28,140,130,0.06), transparent 60%)" }}
          >
            <div
              className="mx-auto max-w-[760px] overflow-hidden rounded-t-2xl border border-b-0 bg-white"
              style={{ borderColor: LINE, boxShadow: "0 30px 60px -20px rgba(14,42,56,0.18)" }}
            >
              <div className="flex items-center gap-1.5 border-b px-4 py-3" style={{ borderColor: LINE }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE }} />
              </div>
              <div className="grid md:grid-cols-[1fr_1.3fr]" style={{ background: LINE, gap: "1px" }}>
                <div className="bg-white p-5">
                  <div className="mb-4 flex items-center gap-2.5">
                    <div
                      className="h-[34px] w-[34px] rounded-full"
                      style={{ background: "linear-gradient(135deg,#1C8C82,#3FA66B)" }}
                    />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: INK }}>
                        Priya R.
                      </div>
                      <div className="text-xs" style={{ color: INK_SOFT }}>
                        Laser treatment plan
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: INK_SOFT, fontFamily: "IBM Plex Mono" }}>
                    <span>3 of 8 sessions</span>
                    <span>38%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: PAPER_2 }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: "38%", background: "linear-gradient(90deg,#1C8C82,#3FA66B)" }}
                    />
                  </div>
                  <div
                    className="mt-3.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: "rgba(219,154,60,0.12)", color: AMBER }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
                    18 days since last visit
                  </div>
                  <div className="mt-3.5 rounded-xl p-3 text-xs leading-[1.5]" style={{ background: PAPER_2, color: INK_SOFT }}>
                    <b style={{ color: INK }}>WhatsApp reminder sent</b> — "Hi Priya, you're due for session 4 of your treatment plan. Book anytime this week?"
                  </div>
                </div>
                <div className="bg-[#EFF3F1] p-5">
                  <div className="mb-2 flex justify-between text-xs" style={{ color: INK_SOFT, fontFamily: "IBM Plex Mono" }}>
                    <span className="font-semibold" style={{ color: INK }}>
                      FRONT DESK QUEUE
                    </span>
                    <span>TODAY</span>
                  </div>
                  {[
                    { label: "Priya R. — session 4 overdue", tag: "CALL", done: false },
                    { label: "Arjun K. — enquiry, not booked", tag: "FOLLOW UP", done: false },
                    { label: "Meera S. — payment pending", tag: "BILL", done: false },
                    { label: "Kavya T. — plan completed", tag: "DONE", done: true },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between border-t py-2.5 text-xs"
                      style={{ color: INK, borderColor: PAPER_2 }}
                    >
                      <span>{row.label}</span>
                      <span
                        className="rounded-full px-2 py-0.5 font-mono text-[10px]"
                        style={{
                          background: row.done ? "rgba(63,166,107,0.14)" : "rgba(219,154,60,0.14)",
                          color: row.done ? GREEN : AMBER,
                        }}
                      >
                        {row.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            className="mt-2 overflow-hidden rounded-[20px] border bg-white"
            style={{ borderColor: LINE, background: LINE }}
          >
            <div className="grid md:grid-cols-2" style={{ gap: "1px" }}>
              <FeatureCard
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C8C82" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                }
                title="Session tracking"
                desc="Every treatment plan, every session used and remaining, tracked automatically — no spreadsheet, no guessing."
              />
              <FeatureCard
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C8C82" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" />
                  </svg>
                }
                title="Electronic Health Records"
                desc="Every patient's history, notes, and documents in one digital record — nothing lost in a paper file or a register."
              />
              <FeatureCard
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C8C82" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 10h18M7 15h4" />
                  </svg>
                }
                title="Automated, GST-ready billing"
                desc="Invoices generated automatically at each visit — no manual bill-writing, no end-of-day reconciliation headache."
              />
              <FeatureCard
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C8C82" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                }
                title="Treatment progress tracking"
                desc="Photos and feedback logged at every session, so progress across a treatment plan is visible at a glance — not just remembered."
              />
              <FeatureCard
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C8C82" strokeWidth="2">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                }
                title="Automatic WhatsApp follow-ups"
                desc="If a patient's overdue for their next session, a reminder goes out on its own — before front desk even has to think about it."
              />
              <FeatureCard
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C8C82" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                  </svg>
                }
                title="Lead & enquiry follow-up"
                desc="New enquiries that haven't booked yet get tracked the same way lapsed patients do — nobody falls through simply because they hadn't started treatment yet."
              />
              <FeatureCard
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C8C82" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M3 9h18M8 4v5" />
                  </svg>
                }
                title="A queue that catches what reminders miss"
                desc="If someone still hasn't booked, they land in a call-task queue for your front desk — nothing depends on someone remembering."
              />
              <FeatureCard
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C8C82" strokeWidth="2">
                    <path d="M4 4h16v16H4z" />
                    <path d="M4 9h16M9 9v11" />
                  </svg>
                }
                title="One view per patient"
                desc="Appointments, payments, notes, and history — all in one place, not spread across five tabs."
              />
            </div>
          </div>
        </section>

        {/* Before / After */}
        <section className="pb-16 md:pb-20">
          <SectionHead
            kicker="What actually changes"
            title="Not a comparison with another tool — a comparison with today"
          />
          <div
            className="overflow-hidden rounded-[20px] border bg-white"
            style={{ borderColor: LINE, background: LINE }}
          >
            <div className="grid md:grid-cols-2" style={{ gap: "1px" }}>
              <div className="bg-white p-7 md:p-8">
                <span
                  className="mb-4 inline-block rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.05em]"
                  style={{ background: "rgba(219,154,60,0.12)", color: AMBER }}
                >
                  Right now
                </span>
                <ul className="space-y-0">
                  {[
                    "A register, a spreadsheet, or memory — whichever staff happens to update",
                    "No one notices a patient stopped mid-plan until someone happens to check",
                    "Follow-up depends on someone remembering to call",
                    "Bills written by hand at the counter, reconciled at the end of the day",
                    "Patient history split across paper files and WhatsApp chats",
                  ].map((item) => (
                    <li
                      key={item}
                      className="relative border-t py-3 pl-6 text-sm leading-[1.6]"
                      style={{ color: INK_SOFT, borderColor: PAPER_2 }}
                    >
                      <span className="absolute left-0 top-3 text-sm opacity-40" style={{ color: INK_SOFT }}>
                        —
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white p-7 md:p-8">
                <span
                  className="mb-4 inline-block rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.05em]"
                  style={{ background: "rgba(28,140,130,0.1)", color: TEAL }}
                >
                  With FlowCare
                </span>
                <ul className="space-y-0">
                  {[
                    "Every treatment plan and session tracked automatically, for every patient",
                    "A lapsed patient is flagged the moment they're overdue — not weeks later",
                    "WhatsApp reminders go out on their own, backed by a call-task queue",
                    "Invoices generated at the visit, GST-ready, no manual write-up",
                    "One record per patient — history, notes, and payments together",
                  ].map((item) => (
                    <li
                      key={item}
                      className="relative border-t py-3 pl-6 text-sm leading-[1.6]"
                      style={{ color: INK_SOFT, borderColor: PAPER_2 }}
                    >
                      <span className="absolute left-0 top-3 text-sm opacity-40" style={{ color: INK_SOFT }}>
                        —
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Founder note */}
        <section className="pb-16 md:pb-20">
          <div className="mx-auto max-w-[680px] px-5 text-center">
            <div className="mb-1 font-serif text-6xl leading-none" style={{ color: TEAL, opacity: 0.35 }}>
              "
            </div>
            <p className="font-serif text-xl leading-[1.55]" style={{ color: INK }}>
              I found this problem by going through one clinic's own billing data myself — line by line, six months of it. Nearly half of every patient who walked in never came back to finish their treatment plan, and nobody at the clinic had any way of knowing that until I checked. FlowCare exists because that shouldn't take a manual audit to find out.
            </p>
            <div className="mt-5 font-mono text-xs" style={{ color: INK_SOFT }}>
              — Founder, FlowCare
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-16 md:pb-20">
          <SectionHead kicker="Common questions" title="Before you ask" />
          <div className="border-t" style={{ borderColor: LINE }}>
            {[
              {
                q: "Do I have to switch my whole system?",
                a: "No. FlowCare is built to layer onto how your clinic already runs — your front desk, your doctor's flow, your billing — not replace it overnight.",
              },
              {
                q: "What if my staff aren't comfortable with new software?",
                a: "Setup and training are done live, in person or by call — not a manual you're left to figure out alone.",
              },
              {
                q: "What if my clinic doesn't sell treatment plans?",
                a: "FlowCare is built specifically for clinics running multi-session treatment plans — wellness, aesthetic, physio, and dental. If that's not your clinic, it may not be the right fit yet.",
              },
              {
                q: "Is my patients' data secure?",
                a: "Your patient data stays private to your clinic — it's never shared or used for anything beyond running your own clinic.",
              },
            ].map((faq) => (
              <div key={faq.q} className="border-b py-6" style={{ borderColor: LINE }}>
                <h3 className="mb-2 font-serif text-[17px]" style={{ color: INK }}>
                  {faq.q}
                </h3>
                <p className="max-w-[640px] text-sm leading-[1.6]" style={{ color: INK_SOFT }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="pb-20 md:pb-24">
          <div
            className="flex flex-col items-center justify-center gap-5 rounded-[20px] border bg-white p-8 text-center md:p-10"
            style={{ borderColor: LINE }}
          >
            <h2 className="font-serif text-[26px] font-medium leading-tight" style={{ color: INK }}>
              See where your clinic stands
            </h2>
            <p className="max-w-[380px] text-sm leading-[1.6]" style={{ color: INK_SOFT }}>
              No sales pitch — just tell us about your clinic and we'll take it from there.
            </p>
            <a
              href="https://wa.me/?text=Hi,%20I%27d%20like%20to%20know%20more%20about%20FlowCare%20for%20my%20clinic."
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-6 py-4 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-xl"
              style={{ background: WA }}
            >
              <WhatsAppIcon size={16} />
              Message us on WhatsApp
            </a>
          </div>
        </section>
      </div>

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/?text=Hi,%20I%27d%20like%20to%20know%20more%20about%20FlowCare%20for%20my%20clinic."
        target="_blank"
        rel="noreferrer"
        aria-label="Message us on WhatsApp"
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full text-white transition-all hover:scale-105"
        style={{
          background: WA,
          opacity: showFloatWa ? 1 : 0,
          transform: showFloatWa ? "translateY(0) scale(1)" : "translateY(16px) scale(0.9)",
          pointerEvents: showFloatWa ? "auto" : "none",
          transition: "opacity 0.3s ease, transform 0.3s ease, background 0.15s ease",
          boxShadow: "0 6px 20px rgba(37,211,102,0.4)",
        }}
      >
        <WhatsAppIcon size={26} />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            animation: "pulseGlow 2.6s ease-in-out infinite",
            boxShadow: "0 0 0 0 rgba(37,211,102,0.35)",
          }}
        />
      </a>

      <style>{`
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(37,211,102,0.35); }
          50% { box-shadow: 0 0 0 10px rgba(37,211,102,0); }
        }
      `}</style>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: LINE, padding: "48px 0 40px" }}>
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-5 px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoSvg width={24} height={24} />
            <span className="font-serif text-base font-semibold" style={{ color: INK }}>
              FlowCare
            </span>
          </Link>
          <span className="text-sm" style={{ color: INK_SOFT }}>
            Your Remote Admin Partner
          </span>
          <a
            href="https://wa.me/?text=Hi,%20I%27d%20like%20to%20know%20more%20about%20FlowCare%20for%20my%20clinic."
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 border-b border-transparent pb-1 text-sm font-medium transition-colors hover:border-current"
            style={{ color: INK }}
          >
            Message on WhatsApp →
          </a>
        </div>
        <div className="mx-auto mt-6 flex max-w-[1080px] flex-wrap items-center gap-4 px-5 text-xs sm:px-8" style={{ color: INK_SOFT }}>
          <Link to="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:underline">
            Terms of Service
          </Link>
          <Link to="/dpa" className="hover:underline">
            DPA
          </Link>
          <Link to="/security" className="hover:underline">
            Security
          </Link>
          <span className="ml-auto">© {new Date().getFullYear()} FlowCare</span>
        </div>
      </footer>
    </div>
  );
}
