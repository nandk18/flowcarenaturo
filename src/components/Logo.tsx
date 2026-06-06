import logoAsset from "@/assets/flowcare-logo.png.asset.json";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Height in pixels — width auto-scales to preserve aspect ratio. */
  height?: number;
  alt?: string;
}

/**
 * FlowCare logo. The source PNG has a white background, so we use
 * `mix-blend-mode: multiply` in light mode to blend with the surrounding
 * surface, and invert in dark mode so the strokes remain visible.
 */
export default function Logo({ className, height = 40, alt = "FlowCare" }: LogoProps) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      style={{ height, width: "auto" }}
      className={cn(
        "select-none object-contain mix-blend-multiply dark:mix-blend-screen dark:invert",
        className,
      )}
      draggable={false}
    />
  );
}
