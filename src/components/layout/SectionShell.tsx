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
  blue: "",
  green: "",
  purple: "",
};

const ACCENT_BG: Record<ShellAccent, string> = {
  blue: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
  green: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
  purple: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
};



const SHELL_STYLE = {
  // 248px desktop, 56px tablet icon-only
  "--sidebar-width": "232px",
  "--sidebar-width-icon": "56px",
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
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
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


  const closeIfMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isItemActive = (item: ShellNavItem) => {
    if (item.match) return item.match(pathname);
    if (item.end) return pathname === item.to;
    return pathname === item.to || pathname.startsWith(item.to + "/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border gradient-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border/60">

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
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
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
                          "h-10 gap-2.5 rounded-full px-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                          active && cn("font-semibold", ACCENT_BG[accent]),
                        )}
                      >
                        <NavLink to={item.to} end={item.end} onClick={closeIfMobile}>
                          <Icon className="h-4 w-4" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && !collapsed && (
                            <span className={cn(
                              "ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                              /^\d+$/.test(item.badge)
                                ? "bg-destructive text-destructive-foreground"
                                : "bg-sidebar-accent text-sidebar-accent-foreground",
                            )}>
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

      <SidebarFooter className="border-t border-sidebar-border/60">
        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                onClick={() => {
                  closeIfMobile();
                  navigate("/settings/clinic");
                }}
                aria-label="Settings"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
          {!collapsed && (
            <span className="ml-auto truncate text-[10px] text-sidebar-foreground/60">
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-3 safe-top safe-x no-select sm:px-6">
          <SidebarTrigger />
          {title && (
            <div className="flex min-w-0 flex-1 items-center">
              {typeof title === "string" ? (
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  {title}
                </h1>
              ) : (
                title
              )}
            </div>
          )}
          {headerRight && <div className="ml-auto flex items-center gap-2">{headerRight}</div>}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 pb-safe safe-x sm:p-6 lg:p-8 no-bounce">
          <div className="animate-enter mx-auto w-full max-w-[1500px]">{children}</div>
        </main>


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
