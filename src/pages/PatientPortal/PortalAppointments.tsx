import { useEffect, useState } from "react";
import { usePatientPortal } from "@/hooks/usePatientPortal";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PortalAppointments() {
  const { session, callPortal } = usePatientPortal();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    if (!session) return;
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchAppointments = async () => {
    const data = await callPortal<{ appointments: any[] }>("appointments");
    setAppointments(data?.appointments ?? []);
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    setCancelling(id);
    const res = await callPortal<{ success?: boolean; error?: string }>(
      "cancel_appointment",
      { appointment_id: id },
    );
    if (!res?.success) {
      toast.error("Could not cancel appointment");
    } else {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)),
      );
      toast.success("Appointment cancelled");
    }
    setCancelling(null);
  };

  const today = new Date().toISOString().split("T")[0];
  const upcoming = appointments.filter(
    (a) => a.appointment_date >= today && a.status !== "cancelled",
  );
  const past = appointments.filter(
    (a) => a.appointment_date < today || a.status === "cancelled",
  );
  const displayed = activeTab === "upcoming" ? upcoming : past;

  const statusColor = (status: string) =>
    status === "scheduled"
      ? "bg-blue-100 text-blue-700"
      : status === "confirmed"
        ? "bg-green-100 text-green-700"
        : status === "completed"
          ? "bg-gray-100 text-gray-600"
          : status === "cancelled"
            ? "bg-red-100 text-red-600"
            : "bg-gray-100 text-gray-600";

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900 px-1">My Appointments</h2>

      <div className="flex gap-2">
        {(["upcoming", "past"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${
              activeTab === tab
                ? "bg-teal-600 text-white"
                : "bg-white text-gray-500 border border-gray-200"
            }`}
          >
            {tab} {tab === "upcoming" ? `(${upcoming.length})` : ""}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-2">📅</div>
          <p className="text-sm text-gray-500">No {activeTab} appointments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((a) => (
            <div key={a.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{a.doctors?.name}</p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${statusColor(a.status)}`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{a.clinics?.name}</p>
                  <p className="text-[11px] text-gray-700 mt-1">
                    {new Date(a.appointment_date).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    at {a.appointment_time?.slice(0, 5)}
                  </p>
                  {a.reason && (
                    <p className="text-[11px] text-gray-500 mt-0.5">Reason: {a.reason}</p>
                  )}
                </div>
              </div>

              {a.status === "scheduled" && a.appointment_date >= today && (
                <button
                  onClick={() => handleCancel(a.id)}
                  disabled={cancelling === a.id}
                  className="mt-2 text-xs border border-red-200 text-red-500 rounded-lg px-3 py-1.5 flex items-center gap-1 disabled:opacity-50"
                >
                  {cancelling === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Cancel Appointment
                </button>
              )}

              {a.clinics?.phone && (
                <a
                  href={`tel:${a.clinics.phone}`}
                  className="mt-2 text-xs text-teal-600 flex items-center gap-1"
                >
                  📞 Call {a.clinics.name}: {a.clinics.phone}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}