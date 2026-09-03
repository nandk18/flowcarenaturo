# FlowCare User Guide & Use-Case Document

Produce a complete, shareable onboarding document covering every feature currently in the app, with screenshots of each major screen. Delivered as both a markdown file in the project and a polished PDF.

## Deliverables

1. `public/FLOWCARE_USER_GUIDE.md` — full guide in markdown, linkable from the app/published site.
2. `/mnt/documents/FlowCare-User-Guide.pdf` — designed PDF (FlowCare navy/sky brand colors, logo mark on cover) with embedded screenshots, ready to send to a new user.
3. Screenshots saved under `docs/screenshots/` in the project and embedded in both outputs.

## How screenshots are captured

Sign in to the running app with a real session, drive it with Playwright at desktop width (1280 wide) plus a few mobile-width shots for the therapist app, and capture each major screen. If no session can be minted, the guide is written text-first and the missing screens are called out.

Screens to capture (~20):
- Landing page, Login, Onboarding
- Clinical Dashboard (queue, active/completed, start consult / start treatment)
- Consultation workspace (Summary, History, Voice Record, Notes, Rx, Docs)
- Patient list, Add patient, Patient profile (glance cards, tabs, treatment tab, invoices tab, documents, to-dos)
- Calendar / Availability (day, week, month, multi-doctor)
- Book / Reschedule / Cancel appointment modals
- Daily Ops (call tasks, to-do list, filters), Lead Pipeline board
- Pending invoices, Invoice detail, Create invoice, Record payment, Public invoice viewer
- Treatment Board and Schedule Therapy
- Analytics (Overview, Revenue, Patients, Appointments, Leads, Treatments, Therapists) incl. PIN gate
- Settings (clinic, team/invite staff, doctor schedule, message templates, patient import, templates, security)
- Therapist mobile app (PIN login, session list, start/stop session) at phone width
- PWA install (admin and therapist home-screen apps)

## Document structure

1. Welcome & what FlowCare is
2. Getting started — sign up, onboarding, inviting staff (admin, doctor-admin, receptionist), accepting an invite, PWA install for admin and therapist
3. Roles & what each can do
4. Day in the life — reception: registering a patient, booking, check-in, WhatsApp confirmation
5. Day in the life — doctor: consultation workspace, voice notes, templates, prescription, sharing
6. Treatments — creating a plan, scheduling therapy, the Treatment Board, therapist app flow, completion and review link
7. Leads & follow-ups — pipeline stages, drag-and-drop, the 10/5/3-day WhatsApp escalation, lapsed status
8. Daily Ops — call tasks, care calls, to-do list, overdue handling
9. Billing — invoices, services and store items, payments, pending invoices, public invoice link
10. Analytics — each of the seven views, the PIN gate, date ranges and custom range, CSV export
11. Settings reference — every settings page
12. Therapist mobile app guide (own short section, phone screenshots)
13. WhatsApp automation reference — which messages fire when
14. FAQ & troubleshooting
15. Glossary

Each feature section follows the same shape: what it's for → who uses it → step-by-step → screenshot → tips.

## Technical notes

- Content is derived by reading the actual pages/components and routes so nothing is invented; anything unverifiable is omitted rather than guessed.
- PDF generated with a Python/reportlab script writing to `/mnt/documents`, using DejaVu/Montserrat-style fonts, FlowCare navy `#002E71` headings and the wave mark on the cover.
- Every PDF page is rendered to an image and visually reviewed for clipped text, overflow, and broken screenshots before delivery.
- No application source or behaviour changes — this is documentation plus new screenshot assets only.
