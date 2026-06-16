import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type PatientHit = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  phone: string | null;
  lead_status: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  attempt1: "bg-yellow-100 text-yellow-800",
  attempt2: "bg-orange-100 text-orange-800",
  attempt3: "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-700",
  current: "bg-green-100 text-green-800",
};

function useDebounced<T>(value: T, ms = 300) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

export default function GlobalSearch() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(term, 300);
  const clinicId = profile?.clinic_id ?? null;

  const { data, isFetching } = useQuery({
    queryKey: ["global-search-patients", clinicId, debounced],
    enabled: !!clinicId && debounced.trim().length >= 2,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const t = debounced.trim().replace(/[%_]/g, "\\$&");
      const { data, error } = await supabase
        .from("patients")
        .select("id, first_name, last_name, name, phone, lead_status")
        .eq("clinic_id", clinicId!)
        .or(
          `first_name.ilike.%${t}%,last_name.ilike.%${t}%,name.ilike.%${t}%,phone.ilike.%${t}%,email.ilike.%${t}%`,
        )
        .limit(10);
      if (error) throw error;
      return (data ?? []) as PatientHit[];
    },
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    setTerm("");
    navigate(`/patients/${id}`);
  };

  const showDropdown = open && debounced.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative flex-1 max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search by patient name, phone or email..."
        className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-8 text-sm outline-none focus:border-primary"
      />
      {isFetching && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-md border bg-popover shadow-lg">
          {isFetching && !data && (
            <div className="p-3 text-sm text-muted-foreground">Searching…</div>
          )}
          {data && data.length === 0 && !isFetching && (
            <div className="p-3 text-sm text-muted-foreground">No patients found</div>
          )}
          {data?.map((p) => {
            const name =
              `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
              p.name ||
              "Unnamed";
            const initials = name.charAt(0).toUpperCase();
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => go(p.id)}
                className="flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.phone ?? "—"}
                  </span>
                </span>
                {p.lead_status && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      STATUS_COLORS[p.lead_status] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {p.lead_status}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
