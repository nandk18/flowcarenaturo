import ComingSoon from "./ComingSoon";
import { TrendingUp } from "lucide-react";

export default function Sales() {
  return (
    <ComingSoon
      tag="Sales"
      title="Revenue & Growth"
      description="Track leads, conversions and revenue metrics for your clinic. This section is on the way."
      Icon={TrendingUp}
      accentClass="text-blue-500 bg-blue-500/10"
    />
  );
}
