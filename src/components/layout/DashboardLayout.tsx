import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { requestPushPermission } from "@/lib/pushNotifications";
import MainShell from "./MainShell";
import SettingsShell from "./SettingsShell";

export default function DashboardLayout({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const { pathname } = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      requestPushPermission();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (pathname.startsWith("/settings")) {
    return <SettingsShell title={title}>{children}</SettingsShell>;
  }

  return <MainShell title={title}>{children}</MainShell>;
}
