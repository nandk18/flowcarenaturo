import markAsset from "@/assets/flowcare-mark.png.asset.json";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  /** Height of the wave mark in pixels. */
  height?: number;
  /** Show the FLOWCARE wordmark next to the mark. */
  showName?: boolean;
  /** Show the "Your remote admin partner" tagline under the name. */
  showTagline?: boolean;
  /** Color of the wordmark text. */
  color?: string;
}

const NAVY = "#002E71";

/**
 * FlowCare brand lockup: the wave mark plus the FLOWCARE wordmark,
 * matching the official logo (geometric sans, wide tracking, navy).
 */
export default function BrandLogo({
  className,
  height = 36,
  showName = true,
  showTagline = false,
  color = NAVY,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex select-none items-center gap-2", className)}>
      <img
        src={markAsset.url}
        alt="FlowCare"
        style={{ height, width: "auto" }}
        className="object-contain"
        draggable={false}
      />
      {showName && (
        <span className="flex flex-col leading-none">
          <span
            style={{
              color,
              fontFamily: "'Montserrat', 'Space Grotesk', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: Math.round(height * 0.52),
              letterSpacing: "0.02em",
            }}
          >
            FLOWCARE
          </span>
          {showTagline && (
            <span
              style={{
                color,
                fontFamily: "'Montserrat', 'Space Grotesk', system-ui, sans-serif",
                fontWeight: 600,
                fontSize: Math.max(7, Math.round(height * 0.17)),
                letterSpacing: "0.22em",
                marginTop: Math.round(height * 0.11),
              }}
            >
              YOUR REMOTE ADMIN PARTNER
            </span>
          )}
        </span>
      )}
    </span>
  );
}
