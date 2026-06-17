import ChecklistPage from "./_ChecklistPage";

const DEFAULTS = [
  "Unlock clinic",
  "Turn on AC / lights",
  "Check appointment schedule",
  "Prepare reception area",
  "Check stock / supplies",
  "Log in to FlowCare system",
];

export default function OpeningChecklistPage() {
  return <ChecklistPage type="opening" title="Opening Checklist" defaults={DEFAULTS} />;
}
