import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PatientRegistration from "@/components/receptionist/PatientRegistration";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, UserPlus, User, Phone, Mail, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Patient = {
  id: string;
  name: string;
  healthcare_id: string | null;
  gender: string | null;
  dob: string | null;
  phone: string | null;
  email: string | null;
  blood_group: string | null;
  allergies: any;
  chronic_conditions: any;
};

export default function PatientsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = profile?.role === "admin";

  const fetchPatients = useCallback(async () => {
    if (!profile?.clinic_id) return;
    let query = supabase.from("patients").select("*").eq("clinic_id", profile.clinic_id).order("created_at", { ascending: false });
    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,healthcare_id.ilike.%${search}%`);
    }
    const { data } = await query.limit(100);
    if (data) setPatients(data);
    setLoading(false);
  }, [profile?.clinic_id, search]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const handleDeletePatient = async (patientId: string) => {
    setIsDeleting(true);
    try {
      // Get all visit IDs for this patient
      const { data: visits } = await supabase.from("visits").select("id").eq("patient_id", patientId);
      const visitIds = visits?.map(v => v.id) || [];

      if (visitIds.length > 0) {
        // Get prescription IDs for document_shares deletion
        const { data: prescriptions } = await supabase.from("prescriptions").select("id").in("visit_id", visitIds);
        const prescriptionIds = prescriptions?.map(p => p.id) || [];

        if (prescriptionIds.length > 0) {
          await supabase.from("document_shares").delete().in("prescription_id", prescriptionIds);
        }
        await supabase.from("prescriptions").delete().in("visit_id", visitIds);
        await supabase.from("clinical_notes").delete().in("visit_id", visitIds);
        await supabase.from("patient_documents").delete().in("visit_id", visitIds);
        await supabase.from("visits").delete().eq("patient_id", patientId);
      }

      // Also delete documents linked directly to patient
      await supabase.from("patient_documents").delete().eq("patient_id", patientId);
      await supabase.from("patients").delete().eq("id", patientId);

      toast({ title: "Patient record deleted permanently" });
      setDeleteTarget(null);
      fetchPatients();
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground">{patients.length} patient{patients.length !== 1 ? "s" : ""} registered</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> New Patient</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>Register New Patient</DialogTitle></DialogHeader>
            <PatientRegistration onSuccess={() => { setDialogOpen(false); fetchPatients(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : patients.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center py-16">
            <User className="mb-4 h-16 w-16 text-muted-foreground/30" />
            <h3 className="font-display text-lg font-semibold">No patients found</h3>
            <p className="text-sm text-muted-foreground">Register your first patient to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {patients.map(p => (
            <Card key={p.id} className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer" onClick={() => navigate(`/dashboard/patients/${p.id}`)}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{p.name}</p>
                    {p.healthcare_id && (
                      <p className="font-mono text-[10px] text-primary">{p.healthcare_id}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {p.gender}{p.dob && `, ${getAge(p.dob)}y`}{p.blood_group && ` · ${p.blood_group}`}
                    </p>
                  </div>
                  {p.allergies && Array.isArray(p.allergies) && p.allergies.length > 0 && (
                    <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px] flex-shrink-0">Allergies</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pl-13 sm:pl-0 sm:ml-auto">
                  {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                  {p.email && <span className="flex items-center gap-1 truncate max-w-[200px]"><Mail className="h-3 w-3" />{p.email}</span>}
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p); }}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Patient Record
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete <strong className="text-foreground">{deleteTarget?.name}</strong> ({deleteTarget?.healthcare_id})?
          </p>
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 mt-1 border border-destructive/20">
            ⚠️ This will permanently delete all visits, clinical notes, prescriptions, and documents for this patient. This cannot be undone.
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteTarget && handleDeletePatient(deleteTarget.id)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
