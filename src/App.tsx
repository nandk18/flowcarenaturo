import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import AcceptInvite from "./pages/AcceptInvite";
import PrescriptionViewer from "./pages/PrescriptionViewer";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import DoctorConsultationPage from "./pages/DoctorConsultationPage";
import AdminDashboard from "./pages/AdminDashboard";
import PatientDetailPage from "./pages/PatientDetailPage";
import SalesPatientDetail from "./pages/SalesPatientDetail";
import Settings from "./pages/Settings";
import TemplatesPage from "./pages/TemplatesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import DoctorSchedulePage from "./pages/DoctorSchedulePage";
import AvailabilityPage from "./pages/AvailabilityPage";
import PatientsListPage from "./pages/PatientsListPage";
import PatientAddPage from "./pages/PatientAddPage";
import CallTaskPage from "./pages/CallTaskPage";
import OpeningChecklistPage from "./pages/OpeningChecklistPage";
import ClosingChecklistPage from "./pages/ClosingChecklistPage";
import ExpenseListPage from "./pages/ExpenseListPage";
import TodoListPage from "./pages/TodoListPage";
import PatientImportPage from "./pages/PatientImportPage";
import PatientFormPublic from "./pages/PatientFormPublic";

import SuperAdmin from "./pages/SuperAdmin";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DataProcessingAgreement from "./pages/DataProcessingAgreement";
import SecurityPage from "./pages/SecurityPage";
import BillingPage from "./pages/BillingPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import PublicInvoiceViewer from "./pages/PublicInvoiceViewer";
import NotFound from "./pages/NotFound";
import CookieConsent from "./components/CookieConsent";
import TestWhatsApp from "./pages/__TestWhatsApp";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfileAndGetPostAuthRoute } from "@/lib/authRedirect";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

const isPublicRoute = (path: string) =>
  path === "/auth/callback" ||
  path === "/auth" ||
  path === "/login" ||
  path === "/accept-invite" ||
  path === "/reset-password" ||
  path === "/forgot-password" ||
  path === "/privacy" ||
  path === "/terms" ||
  path === "/dpa" ||
  path === "/security" ||
  path.startsWith("/invoice/") ||
  path.startsWith("/rx/") ||
  path.startsWith("/patient-form/");

const isAuthEntryRoute = (path: string) => path === "/" || path === "/auth" || path === "/login";

function AppRoutes() {
  const { session, profile, loading } = useAuth();
  const [clinicReady, setClinicReady] = useState<boolean | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  useEffect(() => {
    let cancelled = false;

    const redirectForSession = async (userId: string) => {
      const nextRoute = await ensureProfileAndGetPostAuthRoute(userId);
      if (!cancelled) navigate(nextRoute, { replace: true });
    };

    const checkInitialSession = async () => {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);

      if (cancelled) return;

      const currentSession = result?.data.session ?? null;
      if (currentSession) {
        if (isAuthEntryRoute(path)) {
          await redirectForSession(currentSession.user.id);
        }
        return;
      }

      if (!isPublicRoute(path)) {
        navigate("/login", { replace: true });
      }
    };

    checkInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === "SIGNED_IN" && authSession?.user) {
        if (path === "/reset-password" || path === "/accept-invite") return;
        setTimeout(() => {
          redirectForSession(authSession.user.id).catch(() => navigate("/login?error=auth_failed", { replace: true }));
        }, 0);
      }

      if (event === "SIGNED_OUT" && !isPublicRoute(window.location.pathname)) {
        navigate("/login", { replace: true });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate, path]);

  if (import.meta.env.DEV && path === "/__test/whatsapp") {
    return (
      <Routes>
        <Route path="/__test/whatsapp" element={<TestWhatsApp />} />
      </Routes>
    );
  }

  // Public-only routes (no auth required)
  if (
    path === "/auth/callback" ||
    path === "/accept-invite" ||
    path === "/reset-password" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/dpa" ||
    path === "/security" ||
    path.startsWith("/invoice/") ||
    path.startsWith("/patient-form/")
  ) {
    return (
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/dpa" element={<DataProcessingAgreement />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/invoice/:invoiceId" element={<PublicInvoiceViewer />} />
        <Route path="/patient-form/:token" element={<PatientFormPublic />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/rx/:prescriptionId" element={<PrescriptionViewer />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="*" element={<Navigate to="/login?error=auth_failed" replace />} />
      </Routes>
    );
  }

  if (profile.password_set === false) {
    return (
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/rx/:prescriptionId" element={<PrescriptionViewer />} />
        <Route path="*" element={<Navigate to="/accept-invite" replace />} />
      </Routes>
    );
  }

  if (profile.role === "super_admin") {
    return (
      <Routes>
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="*" element={<Navigate to="/super-admin" replace />} />
      </Routes>
    );
  }

  if (profile.role !== "admin") {
    return (
      <Routes>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (profile?.clinic_id && clinicReady === null) {
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("clinics")
          .select("onboarding_complete")
          .eq("id", profile.clinic_id)
          .single();
        setClinicReady(error ? false : data?.onboarding_complete ?? false);
      } catch {
        setClinicReady(false);
      }
    })();
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile.clinic_id || clinicReady === false) {
    return (
      <Routes>
        <Route path="/rx/:prescriptionId" element={<PrescriptionViewer />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/rx/:prescriptionId" element={<PrescriptionViewer />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<AdminDashboard />} />
      <Route path="/dashboard/consultation/:visitId" element={<DoctorConsultationPage />} />

      {/* Patients */}
      <Route path="/patients" element={<PatientsListPage />} />
      <Route path="/patients/add" element={<PatientAddPage />} />
      <Route path="/patients/:patientId" element={<SalesPatientDetail />} />
      <Route path="/patients/:patientId/edit" element={<SalesPatientDetail />} />

      {/* Availability */}
      <Route path="/availability" element={<AvailabilityPage />} />

      {/* Tasks */}
      <Route path="/tasks/call-task" element={<CallTaskPage />} />
      <Route path="/tasks" element={<Navigate to="/tasks/call-task" replace />} />

      {/* Billing detail (reachable from Settings → Billing) */}
      <Route path="/dashboard/billing/:invoiceId" element={<InvoiceDetailPage />} />

      {/* Settings */}
      <Route path="/settings" element={<Navigate to="/settings/clinic" replace />} />
      <Route path="/settings/templates" element={<TemplatesPage />} />
      <Route path="/settings/analytics" element={<AnalyticsPage />} />
      <Route path="/settings/billing-config" element={<BillingPage />} />
      <Route path="/settings/billing-config/:invoiceId" element={<InvoiceDetailPage />} />
      <Route path="/settings/doctor-schedule" element={<DoctorSchedulePage />} />
      <Route path="/settings/patient-import" element={<PatientImportPage />} />
      <Route path="/settings/:section" element={<Settings />} />
      <Route path="/settings/:section/:subsection" element={<Settings />} />

      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Legacy redirects */}
      <Route path="/home" element={<Navigate to="/dashboard" replace />} />
      <Route path="/sales" element={<Navigate to="/patients" replace />} />
      <Route path="/sales/leads" element={<Navigate to="/patients" replace />} />
      <Route path="/sales/call-task" element={<Navigate to="/tasks/call-task" replace />} />
      <Route path="/sales/add-lead" element={<Navigate to="/patients/add" replace />} />
      <Route path="/sales/patient/:patientId" element={<LegacyPatientRedirect />} />
      <Route path="/sales/patient/:patientId/edit" element={<LegacyPatientRedirect />} />
      <Route path="/consult" element={<Navigate to="/dashboard" replace />} />
      <Route path="/consult/dashboard" element={<Navigate to="/dashboard" replace />} />
      <Route path="/consult/queue" element={<Navigate to="/dashboard" replace />} />
      <Route path="/consult/appointments" element={<Navigate to="/availability" replace />} />
      <Route path="/consult/appointments/new" element={<Navigate to="/availability" replace />} />
      <Route path="/consult/patients" element={<Navigate to="/patients" replace />} />
      <Route path="/consult/patients/:patientId" element={<LegacyPatientRedirect />} />
      <Route path="/consult/availability" element={<Navigate to="/availability" replace />} />
      <Route path="/treatment" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/patients" element={<Navigate to="/patients" replace />} />
      <Route path="/dashboard/patients/:patientId" element={<LegacyPatientRedirect />} />
      <Route path="/dashboard/templates" element={<Navigate to="/settings/templates" replace />} />
      <Route path="/dashboard/analytics" element={<Navigate to="/settings/analytics" replace />} />
      <Route path="/dashboard/appointments" element={<Navigate to="/availability" replace />} />
      <Route path="/dashboard/billing" element={<Navigate to="/settings/billing-config" replace />} />
      <Route path="/dashboard/settings" element={<Navigate to="/settings/clinic" replace />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function LegacyPatientRedirect() {
  const { pathname } = useLocation();
  const id = pathname.split("/").filter(Boolean).pop();
  return <Navigate to={`/patients/${id}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <CookieConsent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
