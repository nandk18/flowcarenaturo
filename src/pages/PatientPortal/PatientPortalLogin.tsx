import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePatientPortal } from "@/hooks/usePatientPortal";
import { Loader2 } from "lucide-react";

export default function PatientPortalLogin() {
  const navigate = useNavigate();
  const { login, selectProfile } = usePatientPortal();
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [multipleProfiles, setMultipleProfiles] = useState<any[]>([]);

  const handleLogin = async () => {
    if (!phone.trim()) {
      setError("Enter your phone number");
      return;
    }
    if (!dob) {
      setError("Enter your date of birth");
      return;
    }
    setIsLoading(true);
    setError("");
    const result = await login(phone, dob);
    if (result.success) {
      navigate("/patient-portal/dashboard");
    } else if (result.multipleProfiles) {
      setMultipleProfiles(result.multipleProfiles);
    } else {
      setError(result.error || "Verification failed");
    }
    setIsLoading(false);
  };

  if (multipleProfiles.length > 0) {
    const uniqueNames = [...new Set(multipleProfiles.map((p) => p.name))];
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">👥</div>
            <h1 className="text-xl font-bold text-gray-900">Multiple Profiles Found</h1>
            <p className="text-sm text-gray-500 mt-1">Select your name to continue</p>
          </div>
          <div className="space-y-2">
            {uniqueNames.map((name) => {
              const patient = multipleProfiles.find((p) => p.name === name);
              return (
                <button
                  key={name as string}
                  onClick={() => {
                    selectProfile(patient, multipleProfiles);
                    navigate("/patient-portal/dashboard");
                  }}
                  className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-teal-300 hover:bg-teal-50 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold">
                    {String(name).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{String(name)}</div>
                    <div className="text-xs text-gray-500">{patient?.healthcare_id}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🩺</div>
          <h1 className="text-2xl font-bold text-gray-900">StethoScribe</h1>
          <p className="text-sm text-gray-500 mt-1">Your Health Records Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">Access Your Records</h2>
          <p className="text-xs text-gray-500 mt-1 mb-5">
            View your prescriptions, lab reports and visit history
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700">Mobile Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your registered mobile number"
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-teal-600 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              View My Records
            </button>
          </div>

          <p className="text-[11px] text-gray-400 text-center mt-4">
            Use the mobile number and date of birth registered at your clinic
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Your health data is private and secure
        </p>
      </div>
    </div>
  );
}