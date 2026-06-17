import ChecklistPage from "./_ChecklistPage";

const DEFAULTS = [
  "Complete all pending notes",
  "Process end of day billing",
  "Back up / log off system",
  "Turn off AC / equipment",
  "Lock clinic",
  "Check tomorrow's appointments",
  "Send appointment reminders",
];

export default function ClosingChecklistPage() {
  return <ChecklistPage type="closing" title="Closing Checklist" defaults={DEFAULTS} />;
}
