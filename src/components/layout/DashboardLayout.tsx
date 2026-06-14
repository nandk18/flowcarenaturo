import { ReactNode, useEffect } from "react";
import { requestPushPermission } from "@/lib/pushNotifications";
import ConsultShell from "./ConsultShell";

export default function DashboardLayout({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      requestPushPermission();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return <ConsultShell title={title}>{children}</ConsultShell>;
}
