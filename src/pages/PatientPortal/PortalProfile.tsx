import { usePatientPortal } from "@/hooks/usePatientPortal";

export default function PortalProfile() {
  const { session } = usePatientPortal();
  if (!session?.primaryPatient) {
    return <div className="py-20 text-center text-sm text-gray-500">Loading…</div>;
  }
  const patient = session.primaryPatient;

  const fields = [
    { label: "Full Name", value: patient.name },
    { label: "Healthcare ID", value: patient.healthcare_id },
    {
      label: "Date of Birth",
      value: patient.dob
        ? new Date(patient.dob).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "—",
    },
    { label: "Gender", value: patient.gender || "—" },
    { label: "Blood Group", value: patient.blood_group || "—" },
    { label: "Phone", value: patient.phone || "—" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 px-1">My Profile</h2>

      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-2xl font-semibold">
          {patient.name?.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {fields.map((f, i) => (
          <div
            key={f.label}
            className={`flex justify-between px-4 py-3 text-sm ${
              i > 0 ? "border-t border-gray-50" : ""
            }`}
          >
            <span className="text-gray-500">{f.label}</span>
            <span className="text-gray-900 font-medium text-right">{f.value}</span>
          </div>
        ))}
      </div>

      {(patient.allergies as any[])?.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 mb-2">⚠️ Allergies</p>
          <div className="flex flex-wrap gap-1">
            {(patient.allergies as any[]).map((a: any, i: number) => (
              <span
                key={i}
                className="text-xs bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-full"
              >
                {typeof a === "string" ? a : a.name || JSON.stringify(a)}
              </span>
            ))}
          </div>
        </div>
      )}

      {(patient.chronic_conditions as any[])?.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-orange-700 mb-2">🏥 Chronic Conditions</p>
          <div className="flex flex-wrap gap-1">
            {(patient.chronic_conditions as any[]).map((c: any, i: number) => (
              <span
                key={i}
                className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1 rounded-full"
              >
                {typeof c === "string" ? c : c.name || JSON.stringify(c)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-500">
          To update your profile details, contact your clinic directly.
        </p>
      </div>
    </div>
  );
}