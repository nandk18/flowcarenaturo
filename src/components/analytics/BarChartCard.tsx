type Bar = { label: string; value: number };

type Props = {
  title: string;
  sub?: string;
  data: Bar[];
  /** Tailwind classes for the bar fill; the tallest bar gets `highlightColor`. */
  color?: string;
  highlightColor?: string;
  height?: number;
  formatValue?: (v: number) => string;
};

/** Simple vertical bar chart built from plain divs — no chart library dependency. */
export function BarChartCard({
  title, sub, data, color = "bg-primary/15", highlightColor = "bg-primary", height = 140, formatValue,
}: Props) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const highlightIdx = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -Infinity) ? i : best), 0);

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {sub && <p className="mb-2 text-[11px] text-muted-foreground">{sub}</p>}
      {data.length === 0 ? (
        <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No data yet</div>
      ) : (
        <div className="flex items-end gap-1.5" style={{ height }}>
          {data.map((d, i) => (
            <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[10px] text-muted-foreground">{formatValue ? formatValue(d.value) : ""}</span>
              <div
                className={`w-full rounded-t-md ${i === highlightIdx ? highlightColor : color}`}
                style={{ height: `${Math.max((d.value / max) * 100, 3)}%` }}
                title={`${d.label}: ${d.value}`}
              />
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
