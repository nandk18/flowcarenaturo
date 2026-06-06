import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requestPushPermission, triggerPushNotification } from "@/lib/pushNotifications";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import SessionTimeoutWarning from "@/components/SessionTimeoutWarning";
import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";
import {
  Stethoscope, Users, CalendarDays, Settings, LogOut, Menu, X, FileText, BarChart2, Calendar, Receipt, ArrowLeft
} from "lucide-react";

const adminLinks = [
  { to: "/dashboard", icon: CalendarDays, label: "Queue" },
  { to: "/dashboard/appointments", icon: Calendar, label: "Appointments" },
  { to: "/dashboard/patients", icon: Users, label: "Patients" },
  { to: "/dashboard/templates", icon: FileText, label: "Templates" },
  { to: "/dashboard/billing", icon: Receipt, label: "Billing" },
  { to: "/dashboard/analytics", icon: BarChart2, label: "Analytics" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, session, user } = useAuth();
  const { clinic } = useClinic();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingLabCount, setPendingLabCount] = useState(0);
  const role = profile?.role ?? "admin";
  const clinicId = profile?.clinic_id;
  const { showWarning, timeLeft, stayLoggedIn, logoutNow } = useSessionTimeout(!!session);
  const { log } = useAuditLog();

  const links = adminLinks;

  useEffect(() => {
    if (!clinicId) return;

    const fetchPendingCount = async () => {
      const { count } = await supabase
        .from("lab_results")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "pending_review");
      setPendingLabCount(count || 0);
    };

    fetchPendingCount();

    const channel = supabase
      .channel(`lab-results-notify-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lab_results", filter: `clinic_id=eq.${clinicId}` },
        async (payload: any) => {
          fetchPendingCount();
          if (payload.eventType === "INSERT") {
            const newRow = payload.new;
            let testName = "Lab result";
            if (newRow?.lab_order_id) {
              const { data } = await supabase
                .from("lab_orders")
                .select("test_name")
                .eq("id", newRow.lab_order_id)
                .single();
              if (data?.test_name) testName = data.test_name;
            }
            triggerPushNotification({
              id: `lab-result-${newRow.id}`,
              title: "New Lab Result",
              body: `${testName} is ready for review`,
              url: "/dashboard/lab-results",
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clinicId]);

  useEffect(() => {
    const timer = setTimeout(() => { requestPushPermission(); }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSignOut = async () => {
    await log(AUDIT_ACTIONS.LOGOUT, "auth", user?.id, user?.email);
    await signOut();
    navigate("/auth");
  };

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/20">
          <Stethoscope className="h-5 w-5 text-sidebar-primary" />
        </div>
        <span className="font-display text-lg font-bold text-sidebar-foreground">{clinic?.name || "FlowCare"}</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map(link => {
          const showBadge = (link as any).notifyKey === "lab" && pendingLabCount > 0;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/dashboard"}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
              onClick={() => setMobileOpen(false)}
            >
              <link.icon className="h-4 w-4" />
              <span className="flex-1">{link.label}</span>
              {showBadge && (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                  </span>
                  <span className="rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center">
                    {pendingLabCount > 99 ? "99+" : pendingLabCount}
                  </span>
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
            <p className="truncate text-xs text-sidebar-foreground/50 capitalize">{role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full">
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between gradient-sidebar px-4 md:hidden">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-sidebar-primary" />
          <span className="font-display text-sm font-bold text-sidebar-foreground">{clinic?.name || "FlowCare"}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMobileOpen(!mobileOpen)} className="text-sidebar-foreground">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-14 bottom-0 w-64 flex flex-col gradient-sidebar">
            {sidebarContent}
          </aside>
        </div>
      )}

      <aside className="hidden w-64 flex-col gradient-sidebar md:flex">
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      <SessionTimeoutWarning
        open={showWarning}
        timeLeft={timeLeft}
        onStay={stayLoggedIn}
        onLogout={logoutNow}
      />
    </div>
  );
}
