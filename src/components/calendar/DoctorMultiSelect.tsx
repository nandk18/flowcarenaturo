import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { cn, formatDoctorName } from "@/lib/utils";
import { doctorColor, doctorInitial } from "./doctorColors";

type Doctor = { id: string; name: string };

export default function DoctorMultiSelect({
  doctors,
  selectedIds,
  onChange,
}: {
  doctors: Doctor[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const allIds = doctors.map((d) => d.id);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  const label = selectedIds.length === 0 || selectedIds.length === doctors.length
    ? "All doctors"
    : selectedIds.length === 1
      ? formatDoctorName(doctors.find((d) => d.id === selectedIds[0])?.name) ?? "1 doctor"
      : `${selectedIds.length} doctors`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex max-w-[230px] items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-sm",
          open && "border-primary",
        )}
      >
        <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-20 min-w-[220px] rounded-lg border bg-card p-1 shadow-lg">
          {doctors.map((d) => {
            const checked = selectedIds.includes(d.id);
            const color = doctorColor(allIds, d.id);
            return (
              <div
                key={d.id}
                onClick={() => toggle(d.id)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] hover:bg-muted"
              >
                <span className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px]",
                  checked ? "border-primary bg-primary" : "border-muted-foreground/40",
                )}>
                  {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </span>
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", color.avatarBg, color.avatarText)}>
                  {doctorInitial(d.name)}
                </span>
                <span className="truncate">{formatDoctorName(d.name)}</span>
              </div>
            );
          })}
          {doctors.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">No doctors found</div>
          )}
        </div>
      )}
    </div>
  );
}
