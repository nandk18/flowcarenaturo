import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import PatientLink from "@/components/PatientLink";

export type RowTone = "overdue" | "due" | "done";

const TONE_TEXT: Record<RowTone, string> = {
  overdue: "text-destructive",
  due: "text-warning",
  done: "text-muted-foreground",
};

const TONE_CHIP: Record<RowTone, string> = {
  overdue: "bg-destructive/10 text-destructive",
  due: "bg-warning/10 text-warning",
  done: "bg-success/10 text-success",
};

/**
 * Shared Daily Ops call-task row — used by lead calls, appointment-tomorrow
 * calls, care calls and cancelled-appointment calls so all four look identical.
 */
export default function CallTaskRow({
  icon: Icon,
  tone,
  patientId,
  name,
  phone,
  meta,
  actions,
  children,
}: {
  icon: LucideIcon;
  tone: RowTone;
  patientId?: string | null;
  name: string;
  phone?: string | null;
  meta: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="rounded-[10px] border bg-card px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px]",
            TONE_CHIP[tone],
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            {patientId ? (
              <PatientLink patientId={patientId} className="text-sm font-semibold">
                {name}
              </PatientLink>
            ) : (
              <span className="text-sm font-semibold">{name}</span>
            )}
            {phone && <span className="text-xs text-muted-foreground">{phone}</span>}
          </div>
          <p className={cn("mt-0.5 text-xs", TONE_TEXT[tone])}>{meta}</p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 self-center">{actions}</div>}
      </div>
      {children && <div className="mt-2 sm:pl-[38px]">{children}</div>}
    </li>
  );
}
