import { ReactNode, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  CalendarDays,
  Calendar,
  Phone,
  UserPlus,
  Settings as SettingsIcon,
  LogOut,
  Receipt,
  BarChart3,
  FileText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import SidebarLogo from "@/components/SidebarLogo";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import SessionTimeoutWarning from "@/components/SessionTimeoutWarning";
import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";

type NavItem = {
  to: string;
  icon: typeof Users;
  label: string;
  end?: boolean;
  match?: (pathname: string) => boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Consult",
    items: [
      { to: "/dashboard", icon: CalendarDays, label: "Queue", end: true },
      { to: "/dashboard/appointments", icon: Calendar, label: "Appointments" },
      { to: "/consult/patients", icon: Users, label: "Patients" },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        to: "/sales/leads",
        icon: Users,
        label: "Leads",
        match: (p) => p === "/sales" || p === "/sales/leads",
      },
      { to: "/sales/call-task", icon: Phone, label: "Call Task" },
      { to: "/sales/add-lead", icon: UserPlus, label: "Add Patient" },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/dashboard/billing", icon: Receipt, label: "Billing" },
      { to: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
      { to: "/dashboard/templates", icon: FileText, label: "Templates" },
      { to: "/settings", icon: SettingsIcon, label: "Settings" },
    ],
  },
];

function InnerSidebar() {
  const { state, setOpen, isMobile, setOpenMobile } = useSidebar();
  const { clinic } = useClinic();
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { log } = useAuditLog();
  const collapsed = state === "collapsed";

  // Responsive default: desktop (>=1024px) open, tablet (768-1023) icon-only collapsed.
  // Mobile (<768) uses Sheet — independent of `open`.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const apply = () => setOpen(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [setOpen]);

  const handleSignOut = async () => {
    await log(AUDIT_ACTIONS.LOGOUT, "auth", user?.id, user?.email);
    await signOut();
    navigate("/login");
  };

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isItemActive = (item: NavItem) => {
    if (item.match) return item.match(pathname);
    if (item.end) return pathname === item.to;
    return pathname === item.to || pathname.startsWith(item.to + "/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <button
          type="button"
          onClick={() => {
            handleNavClick();
            navigate("/home");
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent/50"
        >
          <SidebarLogo clinicName={clinic?.name} size={28} />
          {!collapsed && (
            <span className="truncate font-display text-sm font-semibold text-sidebar-foreground">
              {clinic?.name ?? "Clinic"}
            </span>
          )}
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Home"
                  isActive={pathname === "/home"}
                >
                  <NavLink to="/home" onClick={handleNavClick}>
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={isItemActive(item)}
                      >
                        <NavLink
                          to={item.to}
                          end={item.end}
                          onClick={handleNavClick}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-medium text-sidebar-foreground">
                {profile?.full_name}
              </p>
              <p className="truncate text-[10px] capitalize text-sidebar-foreground/60">
                {profile?.role}
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const { session } = useAuth();
  const { showWarning, timeLeft, stayLoggedIn, logoutNow } = useSessionTimeout(!!session);

  const defaultOpen =
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <InnerSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger />
          {title && (
            <h1 className="truncate font-display text-base font-semibold sm:text-lg">
              {title}
            </h1>
          )}
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <SessionTimeoutWarning
        open={showWarning}
        timeLeft={timeLeft}
        onStay={stayLoggedIn}
        onLogout={logoutNow}
      />
    </SidebarProvider>
  );
}
