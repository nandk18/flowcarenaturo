import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, subMonths } from "date-fns";

export const RANGES = ["Today", "This Week", "This Month", "Last 3 Months", "This Year"] as const;
export type Range = typeof RANGES[number];

export function dateRange(range: Range): { start: string; end: string } {
  const now = new Date();
  const end = format(now, "yyyy-MM-dd");
  switch (range) {
    case "Today": return { start: format(startOfDay(now), "yyyy-MM-dd"), end };
    case "This Week": return { start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), end };
    case "This Month": return { start: format(startOfMonth(now), "yyyy-MM-dd"), end };
    case "Last 3 Months": return { start: format(subMonths(now, 3), "yyyy-MM-dd"), end };
    case "This Year": return { start: format(startOfYear(now), "yyyy-MM-dd"), end };
  }
}

export const inr = (n: number | null | undefined) =>
  "₹" + (Number(n || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const num = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString("en-IN");

export const pct = (n: number | null | undefined, d = 0) =>
  `${(Number(n || 0)).toFixed(d)}%`;

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map(r => r.map(c => {
      const s = c == null ? "" : String(c);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
}

export function downloadCSV(name: string, csv: string) {
  // Prepend UTF-8 BOM so Excel/Windows decode ₹ and other UTF-8 chars correctly.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
