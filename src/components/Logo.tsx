import BrandLogo from "@/components/BrandLogo";

interface LogoProps {
  className?: string;
  /** Height in pixels — width auto-scales to preserve aspect ratio. */
  height?: number;
  alt?: string;
}

/** FlowCare logo lockup used across the app chrome. */
export default function Logo({ className, height = 40 }: LogoProps) {
  return <BrandLogo className={className} height={height} />;
}
