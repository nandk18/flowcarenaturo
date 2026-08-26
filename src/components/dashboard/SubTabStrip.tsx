import type { ReactNode } from "react";

export interface SubTabItem {
  value: string;
  label: ReactNode;
  count: number;
}

interface SubTabStripProps {
  items: SubTabItem[];
  value: string;
  onChange: (value: string) => void;
  /** Underlined style (used for Active/Completed) vs plain top-level style */
  variant?: "underline" | "plain";
}

export default function SubTabStrip({ items, value, onChange, variant = "underline" }: SubTabStripProps) {
  return (
    <div className={`flex items-center gap-5 ${variant === "underline" ? "border-b border-border" : ""}`}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={`flex items-center gap-2 pb-2 text-sm transition-colors ${
              variant === "underline" ? "border-b-2" : ""
            } ${
              active
                ? `font-medium text-foreground ${variant === "underline" ? "border-primary" : ""}`
                : `text-muted-foreground hover:text-foreground ${variant === "underline" ? "border-transparent" : ""}`
            }`}
          >
            {item.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
