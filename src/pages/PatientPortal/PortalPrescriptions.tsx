import { useEffect, useState } from "react";
import { usePatientPortal } from "@/hooks/usePatientPortal";
import { openPrescription } from "@/lib/prescriptionUtils";
import { Eye, Loader2 } from "lucide-react";

export default function PortalPrescriptions() {
  const { session, callPortal } = usePatientPortal();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetchPrescriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchPrescriptions = async () => {
    const data = await callPortal<{ prescriptions: any[] }>("prescriptions");
    setPrescriptions(data?.prescriptions ?? []);
    setLoading(false);
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900 px-1">My Prescriptions</h2>

      {prescriptions.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-sm text-gray-500">No prescriptions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((p) => (
            <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.visit?.chief_complaint || "Consultation"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.visit?.doctors?.name} · {p.visit?.clinics?.name}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {p.visit?.visit_date &&
                      new Date(p.visit.visit_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                  </p>
                </div>
                <button
                  onClick={() => openPrescription(p.id)}
                  className="flex items-center gap-1.5 bg-teal-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
              </div>

              {(p.medications as any[])?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {(p.medications as any[]).slice(0, 3).map((med: any, i: number) => (
                    <span
                      key={i}
                      className="text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full"
                    >
                      {med.name} {med.dosage}
                    </span>
                  ))}
                  {(p.medications as any[]).length > 3 && (
                    <span className="text-xs text-gray-500 px-2 py-0.5">
                      +{(p.medications as any[]).length - 3} more
                    </span>
                  )}
                </div>
              )}

              {p.follow_up_date && (
                <p className="text-[11px] text-gray-500 mt-2">
                  📅 Follow-up:{" "}
                  {new Date(p.follow_up_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}