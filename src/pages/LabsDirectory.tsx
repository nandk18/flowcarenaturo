import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle, Loader2, MapPin, Phone, Search } from "lucide-react";

const TEST_CATEGORIES = [
  "Blood Tests",
  "Urine Tests",
  "Imaging / X-ray",
  "MRI / CT Scan",
  "Ultrasound",
  "Pathology / Biopsy",
  "Microbiology / Culture",
  "Cardiology (ECG, Echo)",
  "Genetic Testing",
  "COVID / Infectious Disease",
  "Hormone / Endocrine",
  "Allergy Testing",
];

export default function LabsDirectory() {
  const { session, profile } = useAuth();
  const [labs, setLabs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterTest, setFilterTest] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingLabId, setAddingLabId] = useState<string | null>(null);
  const [addedLabIds, setAddedLabIds] = useState<string[]>([]);

  useEffect(() => {
    fetchLabs();
    if (profile?.clinic_id) fetchAddedLabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.clinic_id]);

  const fetchLabs = async () => {
    const { data } = await supabase
      .from("labs")
      .select("*")
      .eq("type", "external")
      .eq("suspended", false)
      .order("verified", { ascending: false })
      .order("name", { ascending: true });
    setLabs(data || []);
    setLoading(false);
  };

  const fetchAddedLabs = async () => {
    if (!profile?.clinic_id) return;
    const { data } = await supabase
      .from("clinic_labs")
      .select("lab_id")
      .eq("clinic_id", profile.clinic_id);
    setAddedLabIds(data?.map(l => l.lab_id) || []);
  };

  const handleAddToClinic = async (labId: string) => {
    if (!session || !profile?.clinic_id) {
      window.location.href = "/auth";
      return;
    }
    setAddingLabId(labId);
    try {
      const { error } = await supabase.from("clinic_labs").insert({
        clinic_id: profile.clinic_id,
        lab_id: labId,
      });
      if (error) throw error;
      setAddedLabIds(prev => [...prev, labId]);
      toast.success("Lab added to your clinic");
    } catch (err: any) {
      toast.error(err.message || "Failed to add lab");
    } finally {
      setAddingLabId(null);
    }
  };

  const filtered = labs.filter(lab => {
    const matchSearch =
      lab.name.toLowerCase().includes(search.toLowerCase()) ||
      lab.address?.toLowerCase().includes(search.toLowerCase());
    const matchTest = !filterTest || lab.tests_offered?.includes(filterTest);
    return matchSearch && matchTest;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-4xl mb-3">🧪</div>
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-2">
            StethoScribe Lab Directory
          </h1>
          <p className="text-primary-foreground/80 text-sm mb-6">
            Find and connect with verified diagnostic labs across India
          </p>
          <Link
            to="/register-lab"
            className="inline-block bg-background text-primary font-semibold text-sm px-6 py-2.5 rounded-full hover:bg-background/90 transition-colors"
          >
            Register Your Lab →
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-3 mb-6 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by lab name or city..."
              className="w-full border border-input rounded-xl pl-10 pr-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={filterTest}
            onChange={e => setFilterTest(e.target.value)}
            className="border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Test Types</option>
            {TEST_CATEGORIES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">🔍</div>
            <p>No labs found matching your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(lab => {
              const isAdded = addedLabIds.includes(lab.id);
              return (
                <div key={lab.id} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-foreground">{lab.name}</h3>
                        {lab.verified ? (
                          <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
                            Pending Verification
                          </span>
                        )}
                      </div>
                      {lab.address && (
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> {lab.address}
                        </p>
                      )}
                      {lab.operating_hours && (
                        <p className="text-xs text-muted-foreground/80 mt-0.5">
                          🕐 {lab.operating_hours}
                        </p>
                      )}
                    </div>
                  </div>

                  {lab.tests_offered?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {lab.tests_offered.slice(0, 4).map((t: string) => (
                        <span
                          key={t}
                          className="text-xs bg-primary/5 text-primary border border-primary/20 px-2 py-0.5 rounded-full"
                        >
                          {t}
                        </span>
                      ))}
                      {lab.tests_offered.length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{lab.tests_offered.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    {session && (profile?.role === "admin" || profile?.role === "doctor") ? (
                      <button
                        onClick={() => !isAdded && handleAddToClinic(lab.id)}
                        disabled={isAdded || addingLabId === lab.id}
                        className={`flex-1 text-xs rounded-lg py-2 font-medium flex items-center justify-center gap-1.5 transition-colors ${
                          isAdded
                            ? "bg-success/10 text-success border border-success/30 cursor-default"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {addingLabId === lab.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isAdded ? (
                          <><CheckCircle className="w-3 h-3" /> Added to Clinic</>
                        ) : (
                          <>+ Add to My Clinic</>
                        )}
                      </button>
                    ) : (
                      <Link
                        to="/register-lab"
                        className="flex-1 text-xs rounded-lg py-2 font-medium text-center border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                      >
                        Register Your Lab
                      </Link>
                    )}
                    {lab.phone && (
                      <a
                        href={`tel:${lab.phone}`}
                        className="text-xs border border-border rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        <Phone className="w-3 h-3" /> Call
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
