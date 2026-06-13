import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";

export type StoreItemPick = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  sku: string | null;
  unit_price: number;
  gst_percentage: number | null;
  unit: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  onPick: (item: StoreItemPick) => void;
}

export default function StoreItemPicker({ open, onClose, clinicId, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StoreItemPick[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); return; }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (query.length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("store_items")
        .select("id,name,description,category,sku,unit_price,gst_percentage,unit")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(20);
      setResults((data ?? []) as StoreItemPick[]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, open, clinicId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-4 w-4" /> Add Store Item</DialogTitle></DialogHeader>
        <Input
          autoFocus
          placeholder="Search store items..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border">
          {query.length < 1 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Start typing to search items</p>
          ) : loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No items found. Add items in Settings → Store Items
            </p>
          ) : results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onPick(r); onClose(); }}
              className="w-full text-left px-3 py-2 border-b last:border-0 hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{r.name}</p>
                <p className="text-sm font-medium">
                  ₹{Number(r.unit_price).toLocaleString("en-IN")}
                  {r.gst_percentage ? <span className="text-xs text-muted-foreground ml-1">+{r.gst_percentage}% GST</span> : null}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {[r.category, r.sku].filter(Boolean).join(" · ") || "—"}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
