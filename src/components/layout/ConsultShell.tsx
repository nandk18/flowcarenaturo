import { ReactNode } from "react";
import { LayoutDashboard, Users, Calendar, Clock, CalendarRange } from "lucide-react";
import SectionShell, { ShellNavGroup } from "./SectionShell";

const NAV: ShellNavGroup[] = [
  {
    items: [
      {
        to: "/consult/dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
        match: (p) => p === "/consult" || p === "/consult/dashboard" || p === "/dashboard",
      },
      {
        to: "/consult/patients",
        icon: Users,
        label: "Patients",
        match: (p) =>
          p === "/consult/patients" ||
          p.startsWith("/consult/patients/") ||
          p === "/dashboard/patients" ||
          p.startsWith("/dashboard/patients/"),
      },
      {
        to: "/consult/appointments",
        icon: Calendar,
        label: "Appointments",
        match: (p) =>
          p.startsWith("/consult/appointments") || p.startsWith("/dashboard/appointments"),
      },
      {
        to: "/consult/queue",
        icon: Clock,
        label: "Queue",
      },
      {
        to: "/consult/availability",
        icon: CalendarRange,
        label: "Availability",
      },
    ],
  },
];

export default function ConsultShell({
  title,
  children,
  headerRight,
}: {
  title?: ReactNode;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  return (
    <SectionShell title={title} navGroups={NAV} accent="green" headerRight={headerRight}>
      {children}
    </SectionShell>
  );
}
