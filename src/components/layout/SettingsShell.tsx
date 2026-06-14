import { ReactNode } from "react";
import {
  Building2,
  Clock,
  Users,
  Receipt,
  ShoppingBag,
  SlidersHorizontal,
  BarChart3,
  FileText,
  MessageCircle,
  MessageSquare,
} from "lucide-react";
import SectionShell, { ShellNavGroup } from "./SectionShell";

const NAV: ShellNavGroup[] = [
  {
    label: "Clinic",
    items: [
      {
        to: "/settings/clinic",
        icon: Building2,
        label: "Clinic Profile",
        match: (p) => p === "/settings" || p === "/settings/clinic",
      },
      { to: "/settings/hours", icon: Clock, label: "Opening Hours" },
    ],
  },
  {
    label: "Users",
    items: [{ to: "/settings/staff", icon: Users, label: "Staff Members" }],
  },
  {
    label: "Billing",
    items: [
      { to: "/settings/services", icon: Receipt, label: "Invoice Services" },
      { to: "/settings/store-items", icon: ShoppingBag, label: "Store Items" },
      { to: "/settings/billing-config", icon: SlidersHorizontal, label: "Billing" },
    ],
  },
  {
    label: "Reports",
    items: [{ to: "/settings/analytics", icon: BarChart3, label: "Analytics" }],
  },
  {
    label: "Clinical",
    items: [{ to: "/settings/templates", icon: FileText, label: "Templates" }],
  },
  {
    label: "Integrations",
    items: [
      {
        to: "/settings/integrations/whatsapp",
        icon: MessageCircle,
        label: "WhatsApp",
        badge: "Soon",
      },
      {
        to: "/settings/integrations/sms",
        icon: MessageSquare,
        label: "SMS",
        badge: "Soon",
      },
    ],
  },
];

export default function SettingsShell({
  title,
  children,
  headerRight,
}: {
  title?: ReactNode;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  return (
    <SectionShell title={title} navGroups={NAV} accent="purple" headerRight={headerRight}>
      {children}
    </SectionShell>
  );
}
