import { ReactNode } from "react";
import { Users, Phone, UserPlus } from "lucide-react";
import SectionShell, { ShellNavGroup } from "./SectionShell";

const NAV: ShellNavGroup[] = [
  {
    items: [
      {
        to: "/sales/leads",
        icon: Users,
        label: "Lead List",
        match: (p) => p === "/sales" || p === "/sales/leads" || p.startsWith("/sales/patient"),
      },
      { to: "/sales/call-task", icon: Phone, label: "Call Task" },
      { to: "/sales/add-lead", icon: UserPlus, label: "Add Patient" },
    ],
  },
];

export default function SalesShell({
  title,
  children,
  headerRight,
}: {
  title?: ReactNode;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  return (
    <SectionShell title={title} navGroups={NAV} accent="blue" headerRight={headerRight}>
      {children}
    </SectionShell>
  );
}
