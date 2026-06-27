import { ReactNode, useEffect, useState } from "react";
import { Users, UserPlus, CalendarDays, Phone, Sun, Moon, Receipt, CheckSquare, HeartHandshake } from "lucide-react";
import SectionShell, { ShellNavGroup } from "./SectionShell";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function MainShell({
  title,
  children,
}: {
  title?: ReactNode;
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [careCallCount, setCareCallCount] = useState(0);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    const fetchCount = async () => {
      const { count } = await (supabase as any)
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("care_call_required", true)
        .eq("care_call_done", false);
      if (!cancelled) setCareCallCount(count ?? 0);
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [clinicId]);

  const NAV: ShellNavGroup[] = [
    {
      label: "Patients",
      items: [
        {
          to: "/patients",
          icon: Users,
          label: "Patient List",
          match: (p) => p === "/patients" || (p.startsWith("/patients/") && p !== "/patients/add"),
        },
        { to: "/patients/add", icon: UserPlus, label: "Add Patient" },
      ],
    },
    {
      label: "Availability",
      items: [{ to: "/availability", icon: CalendarDays, label: "Calendar" }],
    },
    {
      label: "Tasks",
      items: [
        { to: "/tasks/call-task", icon: Phone, label: "Call Task" },
        {
          to: "/tasks/care-call",
          icon: HeartHandshake,
          label: "Care Call",
          badge: careCallCount > 0 ? String(careCallCount) : undefined,
        },
        { to: "/tasks/opening-checklist", icon: Sun, label: "Opening Checklist" },
        { to: "/tasks/closing-checklist", icon: Moon, label: "Closing Checklist" },
        { to: "/tasks/expense-list", icon: Receipt, label: "Expense List" },
        { to: "/tasks/todo-list", icon: CheckSquare, label: "To Do List" },
      ],
    },
  ];

  return (
    <SectionShell
      navGroups={NAV}
      accent="green"
      title={
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {title && typeof title === "string" ? (
            <h1 className="hidden truncate font-display text-base font-semibold sm:block sm:text-lg">
              {title}
            </h1>
          ) : (
            title
          )}
          <div className="ml-auto flex flex-1 justify-end sm:ml-4 sm:max-w-xl">
            <GlobalSearch />
          </div>
        </div>
      }
      headerRight={
        <>
          <NotificationBell />
          <ProfileMenu />
        </>
      }
    >
      {children}
    </SectionShell>
  );
}
