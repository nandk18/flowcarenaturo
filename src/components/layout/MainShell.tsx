import { ReactNode } from "react";
import { Users, UserPlus, CalendarDays, Phone, Sun, Moon, Receipt, CheckSquare } from "lucide-react";
import SectionShell, { ShellNavGroup } from "./SectionShell";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";

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
      { to: "/tasks/opening-checklist", icon: Sun, label: "Opening Checklist" },
      { to: "/tasks/closing-checklist", icon: Moon, label: "Closing Checklist" },
      { to: "/tasks/expense-list", icon: Receipt, label: "Expense List" },
      { to: "/tasks/todo-list", icon: CheckSquare, label: "To Do List" },
    ],
  },
];

export default function MainShell({
  title,
  children,
}: {
  title?: ReactNode;
  children: ReactNode;
}) {
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
