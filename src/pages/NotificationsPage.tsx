import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Bell, FormInput, CalendarX, IndianRupee, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type N = {
  id: string;
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

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const clinicId = profile?.clinic_id ?? null;
  const [filter, setFilter] = useState<"all" | "unread" | "cleared">("all");
  const [items, setItems] = useState<N[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    if (!clinicId) return;
    let q = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("clinic_id", clinicId);
    if (filter === "unread") q = q.eq("is_read", false).eq("is_cleared", false);
    if (filter === "cleared") q = q.eq("is_cleared", true);
    const { data, count } = await q
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    setItems((data ?? []) as N[]);
    setTotal(count ?? 0);
  }, [clinicId, filter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [filter]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashboardLayout title="Notifications">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold">All Notifications</h1>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="cleared">Cleared</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="divide-y rounded-2xl border bg-card shadow-card">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No notifications</div>
          ) : items.map((n) => {
            const meta = ICONS[n.type ?? ""] ?? { icon: Bell, color: "text-muted-foreground" };
            const Icon = meta.icon;
            return (
              <button
                key={n.id}
                onClick={() => n.patient_id && navigate(`/patients/${n.patient_id}`)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50",
                  !n.is_read && !n.is_cleared && "bg-primary/5",
                  n.is_cleared && "opacity-60",
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(n.created_at), "dd MMM yyyy, h:mm a")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
