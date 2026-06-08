import { useState } from "react";
import logoAsset from "@/assets/flowcare-logo.png.asset.json";

interface SidebarLogoProps {
  clinicName?: string | null;
  /** Override the image source. Defaults to the FlowCare logo asset. */
  src?: string;
  size?: number;
}

/**
 * Square logo for sidebars. Renders a real <img> at a fixed size with
 * `object-fit: contain`. If the image fails to load, falls back to a
 * colored circle showing the first letter of the clinic name.
 * Works on light and dark sidebar backgrounds.
 */
export default function SidebarLogo({
  clinicName,
  src = logoAsset.url,
  size = 32,
}: SidebarLogoProps) {
  const [failed, setFailed] = useState(false);
  const letter = (clinicName?.trim()?.[0] ?? "F").toUpperCase();

  if (failed || !src) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-sm font-bold"
        aria-label={clinicName ?? "Logo"}
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={clinicName ?? "Logo"}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
      className="shrink-0 rounded bg-white/90 p-0.5"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
