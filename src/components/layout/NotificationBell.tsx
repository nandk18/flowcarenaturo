import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, FormInput, CalendarX, IndianRupee, PhoneOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  type: string | null;
  message: string;
  is_read: boolean;
  is_cleared: boolean | null;
  created_at: string;
};

const ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  patient_form_completed: { icon: FormInput, color: "text-[#1D9E75]" },
  appointment_cancelled: { icon: CalendarX, color: "text-red-600" },
  payment_received: { icon: IndianRupee, color: "text-green-600" },
  call_task_overdue: { icon: PhoneOff, color: "text-amber-600" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const clinicId = profile?.clinic_id ?? null;

  const load = async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("is_cleared", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setItems(data as Notification[]);
  };

  useEffect(() => {
    if (!clinicId) return;
    load();
    const interval = setInterval(load, 60_000);
    const channel = supabase
      .channel(`notif-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `clinic_id=eq.${clinicId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!clinicId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("clinic_id", clinicId)
      .eq("is_read", false)
      .eq("is_cleared", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const clearAll = async () => {
    if (!clinicId) return;
    await supabase
      .from("notifications")
      .update({ is_cleared: true, is_read: true })
      .eq("clinic_id", clinicId)
      .eq("is_cleared", false);
    setItems([]);
  };

  const clearOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from("notifications").update({ is_cleared: true, is_read: true }).eq("id", id);
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.patient_id) navigate(`/patients/${n.patient_id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="text-xs text-primary disabled:opacity-40"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={items.length === 0}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              Clear all
            </button>
          </div>
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            items.map((n) => {
              const meta = ICONS[n.type ?? ""] ?? { icon: Bell, color: "text-muted-foreground" };
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "group flex w-full items-start gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50",
                    !n.is_read && "bg-primary/5",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="flex flex-1 items-start gap-2 text-left"
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.color)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-foreground">{n.message}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => clearOne(e, n.id)}
                    aria-label="Clear notification"
                    className="rounded p-1 text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="border-t px-3 py-2 text-center">
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="text-xs text-primary hover:underline"
          >
            View all
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
