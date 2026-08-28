type Row = { label: string; value: number; color: string };

type Props = {
  title: string;
  sub?: string;
  rows: Row[];
};

/** Horizontal-bar funnel (e.g. Sent → Booked) with counts. */
export function FunnelChart({ title, sub, rows }: Props) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const hasData = rows.some((r) => r.value > 0);

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {sub && <p className="mb-2 text-[11px] text-muted-foreground">{sub}</p>}
      {!hasData ? (
        <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">No data yet</div>
      ) : (
        <div className="mt-2 space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-muted-foreground">{r.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded"
                  style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 4 : 0)}%`, backgroundColor: r.color }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-semibold text-foreground">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
