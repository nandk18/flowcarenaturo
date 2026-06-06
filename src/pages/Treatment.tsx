import ComingSoon from "./ComingSoon";
import { HeartPulse } from "lucide-react";

export default function Treatment() {
  return (
    <ComingSoon
      tag="Treatment"
      title="Care Plans"
      description="Design patient journeys, treatment plans and follow-ups. This section is on the way."
      Icon={HeartPulse}
      accentClass="text-purple-500 bg-purple-500/10"
    />
  );
}
