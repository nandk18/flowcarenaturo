import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import PatientsPage from "./pages/PatientsPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import Settings from "./pages/Settings";
import TemplatesPage from "./pages/TemplatesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import LabResultsInbox from "./pages/LabResultsInbox";
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
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { session, profile, loading } = useAuth();
  const [clinicReady, setClinicReady] = useState<boolean | null>(null);

  const path = useLocation().pathname;

  if (import.meta.env.DEV && path === "/__test/whatsapp") {
    return (
      <Routes>
        <Route path="/__test/whatsapp" element={<TestWhatsApp />} />
      </Routes>
    );
  }

  // Public-only routes (no auth required, render outside the main gate)
  if (
    path === "/accept-invite" ||
    path === "/reset-password" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/dpa" ||
    path === "/security" ||
    path.startsWith("/invoice/")
  ) {
    return (
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/dpa" element={<DataProcessingAgreement />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/invoice/:invoiceId" element={<PublicInvoiceViewer />} />
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
        <Route path="/rx/:prescriptionId" element={<PrescriptionViewer />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
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

  // Anyone other than admin/super_admin is rejected — only those two roles are supported.
  if (profile.role !== "admin") {
    return (
      <Routes>
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  if (profile?.clinic_id && clinicReady === null) {
    supabase
      .from("clinics")
      .select("onboarding_complete")
      .eq("id", profile.clinic_id)
      .single()
      .then(({ data }) => {
        setClinicReady(data?.onboarding_complete ?? false);
      });
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
      <Route path="/dashboard" element={<AdminDashboard />} />
      <Route path="/dashboard/lab-results" element={<LabResultsInbox />} />
      <Route path="/dashboard/consultation/:visitId" element={<DoctorConsultationPage />} />
      <Route path="/dashboard/patients" element={<PatientsPage />} />
      <Route path="/dashboard/patients/:patientId" element={<PatientDetailPage />} />
      <Route path="/dashboard/templates" element={<TemplatesPage />} />
      <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
      <Route path="/dashboard/appointments" element={<AppointmentsPage />} />
      <Route path="/dashboard/settings" element={<Settings />} />
      <Route path="/dashboard/billing" element={<BillingPage />} />
      <Route path="/dashboard/billing/:invoiceId" element={<InvoiceDetailPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
      <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
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
