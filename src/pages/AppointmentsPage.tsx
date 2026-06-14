import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calendar, List, Plus, Clock, User, ChevronLeft, ChevronRight,
  Loader2, CheckCircle, XCircle, ArrowRight, AlertCircle
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, isToday, parseISO } from "date-fns";
import { formatDoctorName } from "@/lib/utils";
import {
  DoctorSchedule, DoctorException, generateSlots, GeneratedSlot,
} from "@/lib/scheduleSlots";

type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  patient?: { name: string; healthcare_id: string | null; phone: string | null };
  doctor?: { name: string };
};

type Doctor = { id: string; name: string };
type Patient = { id: string; name: string; healthcare_id: string | null; phone: string | null };

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter((_, i) => i < 24);

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-info/15 text-info border-info/30",
  confirmed: "bg-primary/15 text-primary border-primary/30",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-success/15 text-success border-success/30",
  no_show: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function AppointmentsPage() {
  const { profile } = useAuth();
  const { clinic } = useClinic();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const urlPatientId = searchParams.get("patient_id");
  const fromSales = searchParams.get("from") === "sales";
  const isNewRoute = location.pathname.endsWith("/appointments/new");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [listDate, setListDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bookOpen, setBookOpen] = useState(false);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [patientLocked, setPatientLocked] = useState(false);

  // Book form state
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [bookDoctorId, setBookDoctorId] = useState("");
  const [bookDate, setBookDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bookTime, setBookTime] = useState("09:00");
  const [bookDuration, setBookDuration] = useState("15");
  const [bookReason, setBookReason] = useState("");
  const [booking, setBooking] = useState(false);

  // Slot-aware booking state
  const [bookSchedule, setBookSchedule] = useState<DoctorSchedule | null>(null);
  const [bookException, setBookException] = useState<DoctorException | null>(null);
  const [bookDayAppts, setBookDayAppts] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const fetchAppointments = useCallback(async () => {
    if (!profile?.clinic_id) return;
    const startDate = format(weekStart, "yyyy-MM-dd");
    const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const { data } = await (supabase as any)
      .from("appointments")
      .select("*, patients(name, healthcare_id, phone), doctors(name)")
      .eq("clinic_id", profile.clinic_id)
      .gte("appointment_date", startDate)
      .lte("appointment_date", endDate)
      .order("appointment_date")
      .order("appointment_time");
    if (data) {
      setAppointments(data.map((a: any) => ({
        ...a,
        patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
        doctor: Array.isArray(a.doctors) ? a.doctors[0] : a.doctors,
      })));
    }
    setLoading(false);
  }, [profile?.clinic_id, weekStart]);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    supabase.from("doctors").select("id, name").eq("clinic_id", profile.clinic_id)
      .then(({ data }) => {
        if (data) {
          setDoctors(data);
          setBookDoctorId((prev) => prev || data[0]?.id || "");
        }
      });
  }, [profile?.clinic_id]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // Prefill doctor/date/time from URL
  useEffect(() => {
    const d = searchParams.get("doctor_id");
    const dt = searchParams.get("date");
    const tm = searchParams.get("time");
    if (d) setBookDoctorId(d);
    if (dt) setBookDate(dt);
    if (tm) setBookTime(tm);
    if (d || dt || tm || isNewRoute) setBookOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch schedule/exception/day appointments when booking inputs change
  useEffect(() => {
    if (!bookDoctorId || !bookDate || !bookOpen) return;
    let cancelled = false;
    setLoadingSlots(true);
    (async () => {
      const dow = new Date(bookDate + "T00:00:00").getDay();
      const [sched, exc, ap] = await Promise.all([
        (supabase as any)
          .from("doctor_schedules")
          .select("*")
          .eq("doctor_id", bookDoctorId)
          .eq("day_of_week", dow)
          .maybeSingle(),
        (supabase as any)
          .from("doctor_exceptions")
          .select("*")
          .eq("doctor_id", bookDoctorId)
          .eq("exception_date", bookDate)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("id, appointment_time, status")
          .eq("doctor_id", bookDoctorId)
          .eq("appointment_date", bookDate),
      ]);
      if (cancelled) return;
      setBookSchedule((sched.data as DoctorSchedule) || null);
      setBookException((exc.data as DoctorException) || null);
      setBookDayAppts(ap.data || []);
      if (sched.data?.slot_duration_minutes) {
        setBookDuration(String(sched.data.slot_duration_minutes));
      }
      setLoadingSlots(false);
    })();
    return () => { cancelled = true; };
  }, [bookDoctorId, bookDate, bookOpen]);

  // Prefill patient from URL (?patient_id=...) and open booking dialog on /new
  useEffect(() => {
    if (!profile?.clinic_id || !urlPatientId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, name, healthcare_id, phone")
        .eq("id", urlPatientId)
        .eq("clinic_id", profile.clinic_id)
        .maybeSingle();
      if (cancelled || !data) return;
      setSelectedPatient(data as Patient);
      setSearchQuery(data.name);
      setPatientLocked(true);
      if (isNewRoute) setBookOpen(true);
    })();
    return () => { cancelled = true; };
  }, [profile?.clinic_id, urlPatientId, isNewRoute]);

  const searchPatients = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2 || !profile?.clinic_id) { setPatients([]); return; }
    const { data } = await supabase.from("patients")
      .select("id, name, healthcare_id, phone")
      .eq("clinic_id", profile.clinic_id)
      .or(`name.ilike.%${q}%,healthcare_id.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(10);
    if (data) setPatients(data);
  };

  const handleBook = async () => {
    if (!selectedPatient || !bookDoctorId || !bookDate || !bookTime || !profile?.clinic_id) return;
    setBooking(true);
    try {
      const { error } = await (supabase as any).from("appointments").insert({
        clinic_id: profile.clinic_id,
        patient_id: selectedPatient.id,
        doctor_id: bookDoctorId,
        appointment_date: bookDate,
        appointment_time: bookTime,
        duration_minutes: parseInt(bookDuration),
        reason: bookReason || null,
        created_by: profile.user_id || null,
      } as any);
      if (error) throw error;

      // Promote lead to current patient
      await supabase
        .from("patients")
        .update({ lead_status: "current" })
        .eq("id", selectedPatient.id);

      toast.success("Appointment booked successfully");
      setBookOpen(false);
      const bookedPatientId = selectedPatient.id;
      const wasLocked = patientLocked;
      resetBookForm();
      fetchAppointments();

      if (wasLocked) {
        if (fromSales) {
          navigate(`/sales/patient/${bookedPatientId}`);
        } else if (isNewRoute) {
          navigate("/consult/appointments");
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally { setBooking(false); }
  };

  const resetBookForm = () => {
    setSelectedPatient(null); setSearchQuery(""); setPatients([]);
    setPatientLocked(false);
    setBookDoctorId(""); setBookDate(format(new Date(), "yyyy-MM-dd"));
    setBookTime("09:00"); setBookDuration("15"); setBookReason("");
  };

  const updateStatus = async (id: string, status: string) => {
    await (supabase as any).from("appointments").update({ status } as any).eq("id", id);
    setDetailAppt(null);
    fetchAppointments();
    toast.success(`Appointment marked as ${status}`);
  };

  const convertToVisit = async (appt: Appointment) => {
    if (!profile?.clinic_id) return;
    try {
      // Get next token number
      const today = new Date().toISOString().split("T")[0];
      const { data: lastVisit } = await supabase.from("visits")
        .select("token_number").eq("clinic_id", profile.clinic_id)
        .eq("visit_date", today).order("token_number", { ascending: false }).limit(1).single();
      const nextToken = (lastVisit?.token_number || 0) + 1;

      const { error } = await supabase.from("visits").insert({
        clinic_id: profile.clinic_id,
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        token_number: nextToken,
        chief_complaint: appt.reason || null,
        status: "waiting",
        visit_date: today,
      });
      if (error) throw error;

      await (supabase as any).from("appointments").update({ status: "completed" } as any).eq("id", appt.id);
      setDetailAppt(null);
      fetchAppointments();
      toast.success(`${appt.patient?.name} added to today's queue as #${nextToken}`);
    } catch (err: any) { toast.error(err.message); }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const listAppointments = appointments.filter(a => a.appointment_date === listDate);

  const getAvailableSlots = () => {
    if (!bookDoctorId || !bookDate) return TIME_SLOTS;
    const booked = appointments.filter(a => a.doctor_id === bookDoctorId && a.appointment_date === bookDate && a.status !== "cancelled")
      .map(a => a.appointment_time.substring(0, 5));
    return TIME_SLOTS.filter(s => !booked.includes(s));
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground">Schedule and manage patient appointments</p>
        </div>
        <Button onClick={() => { resetBookForm(); setBookOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Book Appointment
        </Button>
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar"><Calendar className="mr-2 h-4 w-4" /> Calendar View</TabsTrigger>
          <TabsTrigger value="list"><List className="mr-2 h-4 w-4" /> List View</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const dayStr = format(day, "yyyy-MM-dd");
              const dayAppts = appointments.filter(a => a.appointment_date === dayStr);
              return (
                <div key={dayStr} className={`min-h-[120px] rounded-xl border p-2 ${isToday(day) ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="text-xs font-medium text-muted-foreground mb-1">{format(day, "EEE")}</div>
                  <div className={`text-lg font-bold mb-2 ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</div>
                  <div className="space-y-1">
                    {dayAppts.map(appt => (
                      <button
                        key={appt.id}
                        onClick={() => setDetailAppt(appt)}
                        className={`w-full text-left rounded-md px-1.5 py-1 text-[10px] truncate border ${STATUS_COLORS[appt.status] || ""}`}
                      >
                        <span className="font-semibold">{appt.appointment_time.substring(0, 5)}</span>
                        {" "}{appt.patient?.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <div className="flex items-center gap-3 mb-4">
            <Label className="text-sm">Date:</Label>
            <Input type="date" value={listDate} onChange={e => setListDate(e.target.value)} className="w-auto rounded-lg" />
          </div>

          {listAppointments.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No appointments on this date</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {listAppointments.map(appt => (
                <Card key={appt.id} className="shadow-card cursor-pointer hover:shadow-elevated transition-shadow" onClick={() => setDetailAppt(appt)}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">{appt.appointment_time.substring(0, 5)}</span>
                        <span className="font-medium text-foreground truncate">{appt.patient?.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDoctorName(appt.doctor?.name)}</span>
                        {appt.reason && <span>• {appt.reason}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_COLORS[appt.status] || ""}`}>
                      {appt.status.replace("_", " ")}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Book Appointment Dialog */}
      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>Book Appointment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              {patientLocked && selectedPatient ? (
                <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{selectedPatient.name}</span>
                  {selectedPatient.healthcare_id && (
                    <span className="text-xs text-primary font-mono">{selectedPatient.healthcare_id}</span>
                  )}
                  <button
                    type="button"
                    className="ml-auto text-xs text-primary underline hover:no-underline"
                    onClick={() => { setPatientLocked(false); setSelectedPatient(null); setSearchQuery(""); }}
                  >
                    change
                  </button>
                </div>
              ) : (
                <>
                  <Input placeholder="Name, ID, or phone..." value={searchQuery} onChange={e => searchPatients(e.target.value)} className="rounded-lg" />
                  {patients.length > 0 && !selectedPatient && (
                    <div className="border rounded-lg max-h-40 overflow-auto">
                      {patients.map(p => (
                        <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                          onClick={() => { setSelectedPatient(p); setPatients([]); setSearchQuery(p.name); }}>
                          <span className="font-medium">{p.name}</span>
                          {p.healthcare_id && <span className="ml-2 text-xs text-primary font-mono">{p.healthcare_id}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedPatient && (
                    <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2">
                      <User className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{selectedPatient.name}</span>
                      <button className="ml-auto text-xs text-destructive" onClick={() => { setSelectedPatient(null); setSearchQuery(""); }}>✕</button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select value={bookDoctorId} onValueChange={setBookDoctorId}>
                <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors.map(d => <SelectItem key={d.id} value={d.id}>{formatDoctorName(d.name)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={bookDate} min={format(new Date(), "yyyy-MM-dd")} onChange={e => setBookDate(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Select value={bookTime} onValueChange={setBookTime}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getAvailableSlots().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={bookDuration} onValueChange={setBookDuration}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason for Visit</Label>
              <Input value={bookReason} onChange={e => setBookReason(e.target.value)} placeholder="e.g. Follow-up, consultation" className="rounded-lg" />
            </div>

            <Button onClick={handleBook} disabled={booking || !selectedPatient || !bookDoctorId} className="w-full rounded-lg">
              {booking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
              Book Appointment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!detailAppt} onOpenChange={(o) => { if (!o) setDetailAppt(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Appointment Details</DialogTitle></DialogHeader>
          {detailAppt && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{detailAppt.patient?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{detailAppt.appointment_date} at {detailAppt.appointment_time.substring(0, 5)}</span>
                </div>
                <div className="text-sm text-muted-foreground">{formatDoctorName(detailAppt.doctor?.name)}</div>
                {detailAppt.reason && <div className="text-sm">Reason: {detailAppt.reason}</div>}
                <Badge variant="outline" className={`capitalize ${STATUS_COLORS[detailAppt.status] || ""}`}>
                  {detailAppt.status.replace("_", " ")}
                </Badge>
              </div>

              {detailAppt.status !== "cancelled" && detailAppt.status !== "completed" && (
                <div className="flex flex-wrap gap-2">
                  {detailAppt.status === "scheduled" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(detailAppt.id, "confirmed")}>
                      <CheckCircle className="mr-1 h-3 w-3" /> Confirm
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus(detailAppt.id, "cancelled")}>
                    <XCircle className="mr-1 h-3 w-3" /> Cancel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(detailAppt.id, "no_show")}>
                    <AlertCircle className="mr-1 h-3 w-3" /> No Show
                  </Button>
                  {detailAppt.appointment_date === format(new Date(), "yyyy-MM-dd") && (
                    <Button size="sm" onClick={() => convertToVisit(detailAppt)}>
                      <ArrowRight className="mr-1 h-3 w-3" /> Convert to Visit
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
