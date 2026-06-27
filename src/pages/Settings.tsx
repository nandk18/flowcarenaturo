import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import InvoiceServicesSection from "@/components/billing/InvoiceServicesSection";
import StoreItemsSection from "@/components/billing/StoreItemsSection";
import SettingsShell from "@/components/layout/SettingsShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Building2, User, Save, Loader2, UserPlus, Send, Shield, Users, Trash2, Globe, Pencil, FileDown, Upload, Code2, ClipboardList, ChevronDown, ChevronUp, Database, AlertTriangle, Download, ArrowLeft, Settings as SettingsIcon } from "lucide-react";

import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";
import { clientCache, CACHE_KEYS } from "@/lib/clientCache";
import { Receipt } from "lucide-react";

const LANGUAGES = [
  "Tamil","Hindi","Telugu","Kannada","Malayalam","Marathi",
  "Bengali","Gujarati","Punjabi","Odia","Assamese","Urdu",
  "Konkani","Manipuri","Sindhi"
];

type TeamMember = {
  user_id: string;
  full_name: string | null;
  role: string;
  created_at: string;
  display_name: string;
  qualification: string;
  specialty: string;
  registration_number: string;
};

export default function Settings() {
  const { user, profile } = useAuth();
  const { clinic, doctor, loading, refetch } = useClinic();
  const navigate = useNavigate();
  const { section: sectionParam, subsection } = useParams<{ section?: string; subsection?: string }>();
  const section = sectionParam || "clinic";
  const sectionTitles: Record<string, string> = {
    clinic: "Clinic Profile",
    hours: "Opening Hours",
    staff: "Staff Members",
    services: "Invoice Services",
    "store-items": "Store Items",
    billing: "Billing",
    analytics: "Analytics",
    templates: "Templates",
    integrations: subsection === "whatsapp" ? "WhatsApp Integration" : subsection === "sms" ? "SMS Integration" : "Integrations",
  };
  const sectionTitle = sectionTitles[section] || "Settings";
  const [saving, setSaving] = useState(false);
  const { log: auditLog } = useAuditLog();

  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicEmail, setClinicEmail] = useState("");
  const [clinicWebsite, setClinicWebsite] = useState("");
  const [regionalLanguage, setRegionalLanguage] = useState("Tamil");

  // Billing settings moved to /settings/billing-config (BillingConfigPage)

  const [doctorName, setDoctorName] = useState("");
  const [qualification, setQualification] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [specialty, setSpecialty] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("admin");
  const [inviting, setInviting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // Edit panel
  const [editOpen, setEditOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editQualification, setEditQualification] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [editRegNumber, setEditRegNumber] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Logo & Signature
  const [logoPreview, setLogoPreview] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState("");
  const [uploadingSignature, setUploadingSignature] = useState(false);

  // Developer section
  const [devExpanded, setDevExpanded] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState<{ role: string; action: string; date: string }>({
    role: "", action: "", date: ""
  });

  // Data export
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  // Danger zone — account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (clinic) {
      setClinicName(clinic.name || "");
      setClinicAddress(clinic.address || "");
      setClinicPhone(clinic.phone || "");
      setClinicEmail((clinic as any).email || "");
      setClinicWebsite((clinic as any).website || "");
      setRegionalLanguage((clinic as any).regional_language || "Tamil");
    }
  }, [clinic]);

  useEffect(() => {
    if (doctor) {
      setDoctorName(doctor.name || "");
      setQualification(doctor.qualification || "");
      setRegNumber(doctor.registration_number || "");
      setSpecialty(doctor.specialty || "");
      // Load signature
      if (doctor.signature_url) {
        supabase.storage.from("signatures").createSignedUrl(doctor.signature_url, 3600)
          .then(({ data }) => { if (data?.signedUrl) setSignatureUrl(data.signedUrl); });
      }
    }
  }, [doctor]);

  useEffect(() => {
    if (clinic) {
      // Load logo
      if ((clinic as any).logo_url) {
        const { data } = supabase.storage.from("clinic-assets").getPublicUrl((clinic as any).logo_url);
        if (data?.publicUrl) setLogoPreview(data.publicUrl);
      }
    }
  }, [clinic]);

  useEffect(() => {
    if (user) fetchTeam();
  }, [user]);

  const fetchTeam = async () => {
    if (!user) return;
    setLoadingTeam(true);

    const { data: myProfile } = await supabase
      .from("profiles").select("clinic_id").eq("user_id", user.id).single();
    if (!myProfile?.clinic_id) { setLoadingTeam(false); return; }

    const [profilesRes, doctorsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, role, created_at")
        .eq("clinic_id", myProfile.clinic_id)
        .not("clinic_id", "is", null)
        .not("role", "is", null)
        .order("created_at", { ascending: true }),
      supabase.from("doctors").select("user_id, name, qualification, specialty, registration_number")
        .eq("clinic_id", myProfile.clinic_id),
    ]);

    const enriched = (profilesRes.data || []).map(p => {
      const doctorDetail = doctorsRes.data?.find(d => d.user_id === p.user_id);
      return {
        ...p,
        display_name: doctorDetail?.name || p.full_name || p.user_id,
        qualification: doctorDetail?.qualification || "",
        specialty: doctorDetail?.specialty || "",
        registration_number: doctorDetail?.registration_number || "",
      };
    });

    setTeamMembers(enriched as TeamMember[]);
    setLoadingTeam(false);
  };

  const handleSaveClinic = async () => {
    if (!profile?.clinic_id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("clinics").update({
        name: clinicName,
        address: clinicAddress || null,
        phone: clinicPhone || null,
        email: clinicEmail || null,
        website: clinicWebsite || null,
        regional_language: regionalLanguage,
      } as any).eq("id", profile.clinic_id);
      if (error) throw error;
      toast.success("Clinic details saved!");
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // Billing settings handler removed — now in BillingConfigPage.

  const handleSaveDoctor = async () => {
    if (!profile?.clinic_id || !user) return;
    setSaving(true);
    try {
      if (doctor) {
        const { error } = await supabase.from("doctors").update({
          name: doctorName, qualification, registration_number: regNumber, specialty,
        }).eq("id", doctor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("doctors").insert({
          clinic_id: profile.clinic_id, user_id: user.id,
          name: doctorName, qualification, registration_number: regNumber, specialty,
        });
        if (error) throw error;
      }
      toast.success("Doctor profile saved!");
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleInviteStaff = async () => {
    if (!inviteEmail.trim() || !profile?.clinic_id) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: { email: inviteEmail, role: inviteRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || `Invitation sent to ${inviteEmail} as ${inviteRole}`);
      auditLog(AUDIT_ACTIONS.STAFF_INVITED, "profile", null, inviteEmail, { role: inviteRole });
      setInviteEmail("");
      fetchTeam();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) { toast.error("Passwords do not match"); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!user?.email) return;
    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (signInError) { toast.error("Current password is incorrect"); setChangingPassword(false); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
    } catch (err: any) { toast.error(err.message); }
    finally { setChangingPassword(false); }
  };

  const handleRemoveStaff = async (userId: string) => {
    setIsRemoving(userId);
    try {
      const { data, error } = await supabase.functions.invoke("remove-staff", {
        body: { target_user_id: userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Team member removed successfully");
      setTeamMembers(prev => prev.filter(m => m.user_id !== userId));
      await fetchTeam();
    } catch (err: any) {
      toast.error("Failed to remove: " + err.message);
    } finally {
      setIsRemoving(null);
      setConfirmDeleteId(null);
    }
  };

  const confirmDeleteMember = teamMembers.find(m => m.user_id === confirmDeleteId);

  const openEditPanel = (member: TeamMember) => {
    setEditMember(member);
    setEditName(member.display_name);
    setEditQualification(member.qualification);
    setEditSpecialty(member.specialty);
    setEditRegNumber(member.registration_number);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editMember || !profile?.clinic_id) return;
    setEditSaving(true);
    try {
      if (editMember.role === "doctor") {
        const { error } = await supabase.from("doctors").update({
          name: editName, qualification: editQualification,
          specialty: editSpecialty, registration_number: editRegNumber,
        }).eq("user_id", editMember.user_id).eq("clinic_id", profile.clinic_id);
        if (error) throw error;
      }
      // Update profile name for all roles
      await supabase.from("profiles").update({ full_name: editName }).eq("user_id", editMember.user_id);
      toast.success("Updated successfully");
      setEditOpen(false);
      fetchTeam();
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setEditSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Logo must be under 3MB"); return; }
    if (!profile?.clinic_id) return;
    setUploadingLogo(true);
    try {
      const path = `${profile.clinic_id}/logo.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("clinic-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      await supabase.from("clinics").update({ logo_url: path } as any).eq("id", profile.clinic_id);
      const { data } = supabase.storage.from("clinic-assets").getPublicUrl(path);
      setLogoPreview(data.publicUrl);
      toast.success("Logo uploaded");
      refetch();
    } catch (err: any) { toast.error("Upload failed: " + err.message); }
    finally { setUploadingLogo(false); }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !doctor) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Signature must be under 2MB"); return; }
    setUploadingSignature(true);
    try {
      const path = `${doctor.id}/signature.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage.from("signatures").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      await supabase.from("doctors").update({ signature_url: path }).eq("id", doctor.id);
      const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 3600);
      setSignatureUrl(data?.signedUrl || "");
      toast.success("Signature uploaded successfully");
      refetch();
    } catch (err: any) { toast.error("Upload failed: " + err.message); }
    finally { setUploadingSignature(false); }
  };

  const handleRemoveSignature = async () => {
    if (!doctor) return;
    try {
      if (doctor.signature_url) {
        await supabase.storage.from("signatures").remove([doctor.signature_url]);
      }
      await supabase.from("doctors").update({ signature_url: null }).eq("id", doctor.id);
      setSignatureUrl("");
      toast.success("Signature removed");
      refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const fetchAuditLogs = async () => {
    if (!profile?.clinic_id) return;
    setLoadingAudit(true);
    let query = supabase
      .from("audit_logs" as any)
      .select("*")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (auditFilter.role) query = query.eq("user_role", auditFilter.role);
    if (auditFilter.action) query = query.eq("action", auditFilter.action);
    if (auditFilter.date) {
      const start = new Date(auditFilter.date).toISOString();
      const end = new Date(new Date(auditFilter.date).getTime() + 86400000).toISOString();
      query = query.gte("created_at", start).lt("created_at", end);
    }

    const { data } = await query;
    setAuditLogs((data as any) || []);
    setLoadingAudit(false);
  };

  useEffect(() => {
    if (devExpanded && profile?.role === "admin") fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devExpanded, auditFilter, profile?.clinic_id]);

  const exportAuditLogs = () => {
    if (auditLogs.length === 0) { toast.error("No logs to export"); return; }
    const csv = [
      ["Timestamp", "User", "Role", "Action", "Resource Type", "Record"].join(","),
      ...auditLogs.map(log => [
        new Date(log.created_at).toLocaleString("en-IN"),
        log.user_name || "",
        log.user_role || "",
        log.action || "",
        log.resource_type || "",
        log.resource_name || ""
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.csv`;
    a.click();
    toast.success("Audit log exported");
  };

  const handleDataExport = async () => {
    if (!profile?.clinic_id) return;
    const clinicId = profile.clinic_id;
    setIsExporting(true);
    setExportComplete(false);

    try {
      const [
        patientsRes, visitsRes, notesRes, prescriptionsRes,
        appointmentsRes, labOrdersRes, labResultsRes, doctorsRes
      ] = await Promise.all([
        supabase.from("patients").select("*").eq("clinic_id", clinicId),
        supabase.from("visits").select("*").eq("clinic_id", clinicId),
        supabase.from("clinical_notes").select("*, visits!inner(clinic_id)").eq("visits.clinic_id", clinicId),
        supabase.from("prescriptions").select("*, visits!inner(clinic_id)").eq("visits.clinic_id", clinicId),
        supabase.from("appointments").select("*").eq("clinic_id", clinicId),
        supabase.from("lab_orders").select("*").eq("clinic_id", clinicId),
        supabase.from("lab_results").select("*").eq("clinic_id", clinicId),
        supabase.from("doctors").select("*").eq("clinic_id", clinicId),
      ]);

      const toCSV = (data: any[]) => {
        if (!data || data.length === 0) return "No data";
        const headers = Object.keys(data[0]).join(",");
        const rows = data.map(row =>
          Object.values(row).map(v =>
            typeof v === "object" && v !== null
              ? `"${JSON.stringify(v).replace(/"/g, '""')}"`
              : `"${String(v ?? "").replace(/"/g, '""')}"`
          ).join(",")
        );
        return [headers, ...rows].join("\n");
      };

      const exports = [
        { name: "patients.csv", data: patientsRes.data || [] },
        { name: "visits.csv", data: visitsRes.data || [] },
        { name: "clinical_notes.csv", data: notesRes.data || [] },
        { name: "prescriptions.csv", data: prescriptionsRes.data || [] },
        { name: "appointments.csv", data: appointmentsRes.data || [] },
        { name: "lab_orders.csv", data: labOrdersRes.data || [] },
        { name: "lab_results.csv", data: labResultsRes.data || [] },
        { name: "doctors.csv", data: doctorsRes.data || [] },
      ];

      for (const file of exports) {
        const csv = toCSV(file.data);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stethoscribe-${file.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 300));
      }

      await auditLog(AUDIT_ACTIONS.SETTINGS_UPDATED, "clinic", clinicId, "Data export", { action: "full_data_export" });
      setExportComplete(true);
      toast.success("All data exported successfully");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (deleteConfirmText !== "DELETE" || !profile?.clinic_id || !user) return;
    setIsDeletingAccount(true);
    try {
      await auditLog("account_deletion_requested", "clinic", profile.clinic_id, clinic?.name || null, { reason: deleteReason });
      await supabase.functions.invoke("send-deletion-request", {
        body: {
          clinic_id: profile.clinic_id,
          clinic_name: clinic?.name,
          admin_email: user.email,
          reason: deleteReason,
          requested_at: new Date().toISOString(),
        },
      }).catch(() => { /* edge function optional */ });
      toast.success("Deletion request submitted");
      setShowDeleteConfirm(false);
      await supabase.auth.signOut();
      navigate("/login?reason=deletion_requested");
    } catch (err: any) {
      toast.error("Failed to submit deletion request: " + err.message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex h-16 w-full items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back to home">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-lg font-semibold">Settings</h1>
        </header>
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const grouped = {
    admin: teamMembers.filter(m => m.role === "admin"),
    doctor: teamMembers.filter(m => m.role === "doctor"),
    receptionist: teamMembers.filter(m => m.role === "receptionist"),
  };

  const roleBadgeClass: Record<string, string> = {
    admin: "bg-primary/10 text-primary",
    doctor: "bg-info/10 text-info",
    receptionist: "bg-warning/10 text-warning",
  };

  const ComingSoon = ({ label }: { label: string }) => (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <SettingsIcon className="h-8 w-8 text-primary" />
      </div>
      <h2 className="font-display text-xl font-semibold text-foreground">{label}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Coming Soon</p>
    </div>
  );

  const showClinic = section === "clinic";
  const showStaff = section === "staff";
  const showServices = section === "services";
  const showStoreItems = section === "store-items";
  const showBilling = section === "billing";
  const builtSections = new Set(["clinic", "staff", "services", "store-items", "billing"]);
  const isComingSoon = !builtSections.has(section);

  return (
    <SettingsShell title={`Settings · ${sectionTitle}`}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">{sectionTitle}</h1>
      </div>

      {isComingSoon && <ComingSoon label={sectionTitle} />}

      <div className="space-y-6 max-w-2xl">
        {/* Clinic Details */}
        {showClinic && (
        <Card className="rounded-2xl border-0 shadow-sm">

          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Building2 className="h-5 w-5 text-primary" /> Clinic Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo Upload */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-20 h-20 border-2 border-dashed border-border rounded-xl flex items-center justify-center overflow-hidden bg-muted/50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground/30" />
                )}
              </div>
              <div>
                <label className="cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 w-fit">
                  <Upload className="w-4 h-4" />
                  {uploadingLogo ? "Uploading..." : logoPreview ? "Change Logo" : "Upload Logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                </label>
                <p className="text-xs text-muted-foreground mt-1.5">PNG or JPG, max 3MB. Appears on prescription header</p>
              </div>
            </div>
            <div className="space-y-2"><Label>Clinic Name</Label><Input value={clinicName} onChange={e => setClinicName(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="contact@clinic.com" value={clinicEmail} onChange={e => setClinicEmail(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Website</Label><Input placeholder="www.clinic.com" value={clinicWebsite} onChange={e => setClinicWebsite(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Regional Language</Label>
              <Select value={regionalLanguage} onValueChange={setRegionalLanguage}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for bilingual prescription headers</p>
            </div>
            <Button onClick={handleSaveClinic} disabled={saving} className="rounded-lg">
              <Save className="mr-2 h-4 w-4" /> Save Clinic Details
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Quick links to other admin tools */}
        {showClinic && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <ClipboardList className="h-5 w-5 text-primary" /> Tools
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Templates, billing, and analytics now live under Settings.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="justify-start" onClick={() => navigate("/settings/templates")}>
              <ClipboardList className="mr-2 h-4 w-4" /> Templates
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate("/dashboard/billing")}>
              <Receipt className="mr-2 h-4 w-4" /> Billing
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate("/settings/analytics")}>
              <Database className="mr-2 h-4 w-4" /> Analytics
            </Button>
          </CardContent>
        </Card>
        )}


        {showServices && <InvoiceServicesSection />}

        {showStoreItems && <StoreItemsSection />}


        {/* Billing Settings moved to /settings/billing-config */}

        {/* Doctor Profile (only for doctor/admin roles) */}
        {showClinic && profile?.role === "admin" && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <User className="h-5 w-5 text-primary" /> Doctor Profile
                {!doctor && <span className="text-xs text-destructive font-normal ml-2">(Not set up yet)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Doctor Name</Label><Input value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr. Name" className="rounded-lg" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Qualification</Label><Input value={qualification} onChange={e => setQualification(e.target.value)} placeholder="MBBS, MD" className="rounded-lg" /></div>
                <div className="space-y-2"><Label>Specialty</Label><Input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="General Medicine" className="rounded-lg" /></div>
              </div>
              <div className="space-y-2"><Label>Registration Number</Label><Input value={regNumber} onChange={e => setRegNumber(e.target.value)} placeholder="MCI-123456" className="rounded-lg" /></div>
              {/* Signature Upload */}
              <div className="space-y-2">
                <Label className="block text-sm font-semibold">Doctor Signature</Label>
                {signatureUrl ? (
                  <div className="border border-border rounded-lg p-3 inline-block bg-muted/50 mb-2">
                    <img src={signatureUrl} alt="Signature" className="h-16 object-contain" />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center mb-2">
                    <p className="text-sm text-muted-foreground">No signature uploaded</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {uploadingSignature ? "Uploading..." : signatureUrl ? "Change Signature" : "Upload Signature"}
                    <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleSignatureUpload} disabled={uploadingSignature} />
                  </label>
                  {signatureUrl && (
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={handleRemoveSignature}>
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG or JPG, transparent background recommended. Used on prescriptions.</p>
              </div>
              <Button onClick={handleSaveDoctor} disabled={saving} className="rounded-lg">
                <Save className="mr-2 h-4 w-4" /> {doctor ? "Update" : "Create"} Doctor Profile
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Security */}
        {showClinic && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Shield className="h-5 w-5 text-primary" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" className="rounded-lg" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" className="rounded-lg" /></div>
              <div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Re-enter" className="rounded-lg" /></div>
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword} className="rounded-lg">
              <Shield className="mr-2 h-4 w-4" /> {changingPassword ? "Updating..." : "Update Password"}
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Invite Staff (Admin only) */}
        {showStaff && profile?.role === "admin" && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <UserPlus className="h-5 w-5 text-primary" /> Invite Staff
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Invite additional admins. They'll receive an email to activate their account.
              </p>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" placeholder="admin@clinic.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="rounded-lg" />
              </div>
              <Button onClick={handleInviteStaff} disabled={inviting || !inviteEmail.trim()} className="rounded-lg">
                <Send className="mr-2 h-4 w-4" /> {inviting ? "Sending..." : "Send Invitation"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Team Management */}
        {showStaff && profile?.role === "admin" && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Users className="h-5 w-5 text-primary" /> Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTeam ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members yet. Invite staff above.</p>
              ) : (
                <div className="space-y-5">
                  {(["admin", "doctor", "receptionist"] as const).map(role => {
                    const members = grouped[role];
                    if (members.length === 0) return null;
                    return (
                      <div key={role}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {role === "admin" ? "Admins" : role === "doctor" ? "Doctors" : "Receptionists"}
                        </p>
                        <div className="space-y-2">
                          {members.map(member => (
                            <div key={member.user_id} className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
                                  {(member.display_name || "?").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{member.display_name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge className={`capitalize text-xs ${roleBadgeClass[member.role] || ""} border-0`}>{member.role}</Badge>
                                    {member.qualification && <span className="text-xs text-muted-foreground">{member.qualification}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditPanel(member)}>
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                {member.user_id !== user?.id && (
                                  <Button
                                    variant="ghost" size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setConfirmDeleteId(member.user_id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </CardContent>
        </Card>
        )}



        {/* Developer (Admin only) */}
        {showClinic && profile?.role === "admin" && (
          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <button
              onClick={() => setDevExpanded(v => !v)}
              className="w-full flex items-center justify-between px-6 py-4 bg-muted/30 hover:bg-muted/50 transition-colors"
              type="button"
            >
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                <span className="font-display font-semibold text-foreground">Developer</span>
              </div>
              {devExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {devExpanded && (
              <CardContent className="space-y-6 pt-6">
                {/* Audit Logs */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-semibold text-foreground">Audit Logs</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Complete record of all actions performed in your clinic
                  </p>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <select
                      value={auditFilter.role}
                      onChange={e => setAuditFilter(p => ({ ...p, role: e.target.value }))}
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
                    >
                      <option value="">All Roles</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                    <select
                      value={auditFilter.action}
                      onChange={e => setAuditFilter(p => ({ ...p, action: e.target.value }))}
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
                    >
                      <option value="">All Actions</option>
                      <option value="login">Login</option>
                      <option value="logout">Logout</option>
                      <option value="patient_viewed">Patient Viewed</option>
                      <option value="consultation_opened">Consultation Opened</option>
                      <option value="notes_saved">Notes Saved</option>
                      <option value="prescription_generated">Prescription Generated</option>
                      <option value="prescription_shared">Prescription Shared</option>
                      <option value="lab_order_created">Lab Order Created</option>
                      <option value="staff_invited">Staff Invited</option>
                    </select>
                    <input
                      type="date"
                      value={auditFilter.date}
                      onChange={e => setAuditFilter(p => ({ ...p, date: e.target.value }))}
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
                    />
                    <Button
                      onClick={exportAuditLogs}
                      size="sm"
                      variant="secondary"
                      className="ml-auto text-xs h-8"
                    >
                      <FileDown className="h-3 w-3 mr-1" /> Export CSV
                    </Button>
                  </div>

                  {/* Table */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">When</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Who</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Action</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Record</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingAudit ? (
                            <tr><td colSpan={4} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline text-primary" /></td></tr>
                          ) : auditLogs.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No audit logs yet</td></tr>
                          ) : auditLogs.map(log => (
                            <tr key={log.id} className="border-t border-border hover:bg-muted/20">
                              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString("en-IN", {
                                  day: "numeric", month: "short",
                                  hour: "2-digit", minute: "2-digit"
                                })}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-foreground">{log.user_name || "—"}</div>
                                <div className="text-muted-foreground capitalize">{log.user_role || ""}</div>
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-block bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs capitalize">
                                  {String(log.action).replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-foreground">{log.resource_name || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Documentation */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileDown className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-semibold text-foreground">Documentation</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Download product documentation</p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="/STETHOSCRIBE_USER_GUIDE.md"
                      download
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <FileDown className="h-4 w-4" /> User Guide
                    </a>
                    <a
                      href="/STETHOSCRIBE_TECHNICAL_REFERENCE.md"
                      download
                      className="inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
                    >
                      <FileDown className="h-4 w-4" /> Technical Reference
                    </a>
                  </div>
                </div>

                {/* Data Export */}
                <div className="border-t border-border pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-semibold text-foreground">Data Export</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Download a complete copy of all your clinic data — patients, visits,
                    clinical notes, prescriptions, appointments, lab orders and results.
                    This is your right under the DPDP Act 2023.
                  </p>
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 mb-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-foreground">
                      The export contains sensitive patient health information. Store the
                      downloaded files securely and do not share them with unauthorized persons.
                    </p>
                  </div>
                  {isExporting ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing your data export... this may take a moment.
                    </div>
                  ) : (
                    <button
                      onClick={handleDataExport}
                      className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <Download className="h-4 w-4" />
                      Export All Clinic Data (CSV)
                    </button>
                  )}
                  {exportComplete && (
                    <p className="mt-3 text-xs text-success flex items-center gap-1">
                      ✓ Export complete — check your downloads folder
                    </p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Danger Zone (Admin only) */}
        {showClinic && profile?.role === "admin" && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-display font-semibold text-foreground mb-1">Delete Clinic Account</h3>
                <p className="text-sm text-muted-foreground">
                  Request permanent deletion of your clinic account and all associated data
                  including patients, visits, prescriptions, and staff accounts.
                  This is your right under the DPDP Act 2023.
                </p>
              </div>

              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-semibold text-foreground mb-2">Before deleting, please note:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Your account will be deactivated immediately</li>
                  <li>All data will be permanently deleted after a 30-day grace period</li>
                  <li>You can cancel the deletion request within 30 days by contacting us</li>
                  <li>After 30 days, deletion is irreversible and cannot be undone</li>
                  <li>Export your data before requesting deletion</li>
                </ul>
              </div>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-sm border border-destructive/30 text-destructive rounded-xl px-5 py-2.5 font-medium hover:bg-destructive/10 transition-colors"
                >
                  Request Account Deletion
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-destructive/40 p-4 bg-destructive/5">
                  <div className="space-y-2">
                    <Label className="text-xs">Type <span className="font-bold text-destructive">DELETE</span> to confirm:</Label>
                    <Input
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Your reason (optional):</Label>
                    <textarea
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      placeholder="Reason for deletion (helps us improve)"
                      rows={2}
                      className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-lg"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText("");
                        setDeleteReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 rounded-lg"
                      onClick={handleRequestDeletion}
                      disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                    >
                      {isDeletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirm Deletion Request
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Edit Member Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit {editMember?.role === "doctor" ? "Doctor" : "Staff Member"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="rounded-lg" />
            </div>
            {editMember?.role === "doctor" && (
              <>
                <div className="space-y-2">
                  <Label>Qualification</Label>
                  <Input value={editQualification} onChange={e => setEditQualification(e.target.value)} placeholder="MBBS, MD" className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label>Specialty</Label>
                  <Input value={editSpecialty} onChange={e => setEditSpecialty(e.target.value)} placeholder="General Medicine" className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input value={editRegNumber} onChange={e => setEditRegNumber(e.target.value)} placeholder="MCI-123456" className="rounded-lg" />
                </div>
              </>
            )}
            <Button onClick={handleSaveEdit} disabled={editSaving} className="w-full rounded-lg">
              <Save className="mr-2 h-4 w-4" /> {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl p-6 max-w-sm w-full shadow-xl border">
            <h3 className="font-display font-semibold text-foreground mb-2">Remove Team Member</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to remove <strong className="text-foreground">{confirmDeleteMember?.display_name}</strong> from the clinic?
              They will lose access immediately.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-lg"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-lg"
                onClick={() => handleRemoveStaff(confirmDeleteId)}
                disabled={isRemoving === confirmDeleteId}
              >
                {isRemoving === confirmDeleteId
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removing...</>
                  : "Remove"
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}

