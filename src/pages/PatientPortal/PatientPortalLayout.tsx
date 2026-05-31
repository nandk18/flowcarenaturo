import { useEffect } from "react";
import { useNavigate, Outlet, NavLink } from "react-router-dom";
import { usePatientPortal } from "@/hooks/usePatientPortal";
import { Home, FileText, FlaskConical, Calendar, User, LogOut } from "lucide-react";

export default function PatientPortalLayout() {
  const navigate = useNavigate();
  const { session, loading, logout } = usePatientPortal();

  useEffect(() => {
    if (!loading && !session) {
      navigate("/patient-portal/login");
    }
  }, [session, loading, navigate]);

  if (loading || !session) return null;

  const navItems = [
    { to: "/patient-portal/dashboard", icon: Home, label: "Home" },
    { to: "/patient-portal/prescriptions", icon: FileText, label: "Prescriptions" },
    { to: "/patient-portal/labs", icon: FlaskConical, label: "Lab Reports" },
    { to: "/patient-portal/appointments", icon: Calendar, label: "Appointments" },
    { to: "/patient-portal/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-teal-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🩺</span>
          <div>
            <div className="text-sm font-semibold leading-tight">
              {session.primaryPatient.name}
            </div>
            <div className="text-[11px] text-teal-100 leading-tight">
              {session.primaryPatient.healthcare_id}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/patient-portal/login");
          }}
          className="flex items-center gap-1 text-xs text-teal-200 hover:text-white"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      <div className="px-4 py-4">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[11px] transition-colors ${
                    isActive ? "text-teal-600" : "text-gray-400 hover:text-gray-600"
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}