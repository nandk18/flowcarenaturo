import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Receipt } from "lucide-react";

export type ServicePick = {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  gst_percentage: number | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  onPick: (item: ServicePick) => void;
}

export default function ServicePicker({ open, onClose, clinicId, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ServicePick[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setQuery(""); return; }
    setLoading(true);
    supabase
      .from("invoice_services")
      .select("id,name,description,amount,gst_percentage")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("name")
      .then(({ data }) => {
        setResults((data ?? []) as ServicePick[]);
        setLoading(false);
      });
  }, [open, clinicId]);

  const filtered = query
    ? results.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    : results;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Add Service</DialogTitle></DialogHeader>
        <Input
          autoFocus
          placeholder="Search services..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No services found. Add services in Settings → Invoice Services
            </p>
          ) : filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onPick(r); onClose(); }}
              className="w-full text-left px-3 py-2 border-b last:border-0 hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{r.name}</p>
                <p className="text-sm font-medium">
                  ₹{Number(r.amount).toLocaleString("en-IN")}
                  {r.gst_percentage ? <span className="text-xs text-muted-foreground ml-1">+{r.gst_percentage}% GST</span> : null}
                </p>
              </div>
              {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
