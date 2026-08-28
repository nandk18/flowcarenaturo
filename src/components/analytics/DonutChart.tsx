type Segment = { label: string; value: number; color: string; formatted?: string };

type Props = {
  title: string;
  sub?: string;
  segments: Segment[];
  centerLabel?: string;
  size?: number;
};

/** Pure-SVG donut chart with a centre label and a colour legend. */
export function DonutChart({ title, sub, segments, centerLabel, size = 116 }: Props) {
  const total = segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0);
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {sub && <p className="mb-2 text-[11px] text-muted-foreground">{sub}</p>}
      {total <= 0 ? (
        <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No data yet</div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segments.map((seg) => {
              const frac = Math.max(seg.value, 0) / total;
              const dash = frac * c;
              const el = (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={14}
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += dash;
              return el;
            })}
            <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={17} fontWeight={600} fill="hsl(var(--foreground))">
              {centerLabel}
            </text>
          </svg>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {segments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: seg.color }} />
                {seg.label} {seg.formatted}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
