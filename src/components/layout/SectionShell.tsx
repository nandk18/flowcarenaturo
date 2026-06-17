import { ReactNode, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, type LucideIcon } from "lucide-react";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SidebarLogo from "@/components/SidebarLogo";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import SessionTimeoutWarning from "@/components/SessionTimeoutWarning";
import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";
import { cn } from "@/lib/utils";

export type ShellNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  badge?: string;
  match?: (pathname: string) => boolean;
};

export type ShellNavGroup = {
  label?: string;
  items: ShellNavItem[];
};

export type ShellAccent = "blue" | "green" | "purple";

const ACCENT_BORDER: Record<ShellAccent, string> = {
  blue: "border-r-blue-500",
  green: "border-r-green-500",
  purple: "border-r-purple-500",
};

const ACCENT_BG: Record<ShellAccent, string> = {
  blue: "bg-blue-500/10 text-blue-600",
  green: "bg-green-500/10 text-green-600",
  purple: "bg-purple-500/10 text-purple-600",
};

const SHELL_STYLE = {
  // 200px desktop, 52px tablet icon-only
  "--sidebar-width": "200px",
  "--sidebar-width-icon": "52px",
} as React.CSSProperties;

function InnerSidebar({
  navGroups,
  accent,
}: {
  navGroups: ShellNavGroup[];
  accent: ShellAccent;
}) {
  const { state, setOpen, isMobile, setOpenMobile } = useSidebar();
  const { clinic } = useClinic();
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { log } = useAuditLog();
  const collapsed = state === "collapsed";

  // Responsive: ≥1024 open, 768-1023 icon-collapsed, mobile uses Sheet.
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

  const closeIfMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isItemActive = (item: ShellNavItem) => {
    if (item.match) return item.match(pathname);
    if (item.end) return pathname === item.to;
    return pathname === item.to || pathname.startsWith(item.to + "/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r bg-secondary/30">
      <SidebarHeader className="border-b border-border/60">
        <button
          type="button"
          onClick={() => {
            closeIfMobile();
            navigate("/dashboard");
          }}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-sidebar-accent/50"
        >
          <SidebarLogo clinicName={clinic?.name} size={28} />
          {!collapsed && (
            <span className="truncate font-display text-sm font-semibold text-sidebar-foreground">
              {clinic?.name ?? "FlowCare"}
            </span>
          )}
        </button>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group, gi) => (
          <SidebarGroup key={group.label ?? `g-${gi}`}>
            {group.label && !collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={active}
                        className={cn(
                          "h-9 gap-2.5 px-3 text-sm",
                          active &&
                            cn("border-r-2", ACCENT_BORDER[accent], ACCENT_BG[accent]),
                        )}
                      >
                        <NavLink to={item.to} end={item.end} onClick={closeIfMobile}>
                          <Icon className="h-4 w-4" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && !collapsed && (
                            <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                              {item.badge}
                            </span>
                          )}
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

      <SidebarFooter className="border-t border-border/60">
        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                onClick={() => {
                  closeIfMobile();
                  navigate("/dashboard");
                }}
                aria-label="Home"
              >
                <HomeIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Home</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
          {!collapsed && (
            <span className="ml-auto truncate text-[10px] text-muted-foreground">
              {profile?.full_name}
            </span>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function SectionShell({
  title,
  navGroups,
  accent,
  children,
  headerRight,
}: {
  title?: ReactNode;
  navGroups: ShellNavGroup[];
  accent: ShellAccent;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  const { session } = useAuth();
  const { showWarning, timeLeft, stayLoggedIn, logoutNow } = useSessionTimeout(!!session);

  const defaultOpen =
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true;

  return (
    <SidebarProvider defaultOpen={defaultOpen} style={SHELL_STYLE}>
      <InnerSidebar navGroups={navGroups} accent={accent} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger />
          {title && (
            <div className="flex min-w-0 flex-1 items-center">
              {typeof title === "string" ? (
                <h1 className="truncate font-display text-base font-semibold sm:text-lg">
                  {title}
                </h1>
              ) : (
                title
              )}
            </div>
          )}
          {headerRight && <div className="ml-auto flex items-center gap-2">{headerRight}</div>}
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
