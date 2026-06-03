import { useEffect, useState } from "react";
import { usePatientPortal } from "@/hooks/usePatientPortal";
import { Loader2, ExternalLink } from "lucide-react";

export default function PortalLabReports() {
  const { session, callPortal } = usePatientPortal();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetchLabResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchLabResults = async () => {
    const data = await callPortal<{ results: any[] }>("lab_results");
    setResults(data?.results ?? []);
    setLoading(false);
  };

  const openLabResult = (result: any) => {
    if (!result.file_url) return;
    if (/^https?:\/\//i.test(result.file_url)) {
      window.open(result.file_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (result.signed_url) {
      window.open(result.signed_url, "_blank", "noopener,noreferrer");
    }
  };

  const statusColor = (status: string) =>
    status === "normal"
      ? "bg-green-100 text-green-700"
      : status === "abnormal"
        ? "bg-orange-100 text-orange-700"
        : status === "critical"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600";

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900 px-1">My Lab Reports</h2>

      {results.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-2">🧪</div>
          <p className="text-sm text-gray-500">No lab reports yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">
                      {r.lab_orders?.test_name || r.file_name}
                    </p>
                    {r.ai_summary?.overall_status && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${statusColor(
                          r.ai_summary.overall_status,
                        )}`}
                      >
                        {r.ai_summary.overall_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{r.lab_orders?.labs?.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(r.uploaded_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {r.file_url && (
                  <button
                    onClick={() => openLabResult(r)}
                    className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </button>
                )}
              </div>

              {r.ai_summary?.one_line_summary && (
                <div className="mt-3 bg-teal-50 border border-teal-100 rounded-lg p-2.5">
                  <p className="text-xs text-teal-800">🤖 {r.ai_summary.one_line_summary}</p>
                </div>
              )}

              {r.ai_summary?.abnormal_values?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {r.ai_summary.abnormal_values.slice(0, 2).map((v: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between gap-2 text-xs bg-red-50 rounded px-2 py-1"
                    >
                      <span className="font-medium text-red-700">{v.parameter}</span>
                      <span className="text-red-700">{v.value}</span>
                      <span className="text-red-500/70">Normal: {v.normal_range}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}