import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type Props = { patientId: string };

type VitalsPoint = {
  date: string;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  weight: number | null;
  spo2: number | null;
  temp: number | null;
};

const METRICS = ["BP", "Pulse", "Weight", "SpO2", "Temp"] as const;

export default function VitalsTrends({ patientId }: Props) {
  const [data, setData] = useState<VitalsPoint[]>([]);
  const [selected, setSelected] = useState<string>("BP");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: visits } = await supabase
        .from("visits")
        .select("visit_date, vitals")
        .eq("patient_id", patientId)
        .not("vitals", "is", null)
        .order("visit_date", { ascending: true });

      const points = (visits || [])
        .filter((v: any) => v.vitals && typeof v.vitals === "object" && Object.keys(v.vitals).length > 0)
        .map((v: any) => ({
          date: new Date(v.visit_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          systolic: v.vitals?.bp_sys ? Number(v.vitals.bp_sys) : null,
          diastolic: v.vitals?.bp_dia ? Number(v.vitals.bp_dia) : null,
          pulse: v.vitals?.pulse ? Number(v.vitals.pulse) : null,
          weight: v.vitals?.weight ? Number(v.vitals.weight) : null,
          spo2: v.vitals?.spo2 ? Number(v.vitals.spo2) : null,
          temp: v.vitals?.temp || v.vitals?.temperature ? Number(v.vitals.temp || v.vitals.temperature) : null,
        }));

      setData(points);
      setLoading(false);
    };
    fetch();
  }, [patientId]);

  if (loading || data.length < 2) return null;

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];

  const metrics = [
    { label: "BP", current: latest.systolic ? `${latest.systolic}/${latest.diastolic}` : null, prev: previous.systolic ? `${previous.systolic}/${previous.diastolic}` : null, unit: "mmHg", high: (latest.systolic || 0) > 140 },
    { label: "Pulse", current: latest.pulse, prev: previous.pulse, unit: "bpm", high: (latest.pulse || 0) > 100 },
    { label: "Weight", current: latest.weight, prev: previous.weight, unit: "kg", high: false },
    { label: "SpO2", current: latest.spo2, prev: previous.spo2, unit: "%", high: (latest.spo2 || 100) < 95 },
  ].filter(m => m.current);

  const dataKeyMap: Record<string, string> = {
    Pulse: "pulse", Weight: "weight", SpO2: "spo2", Temp: "temp",
  };

  return (
    <Card className="rounded-xl p-4 mb-4 shadow-card">
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        Vitals Trends
      </h3>

      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {METRICS.map(m => (
          <button
            key={m}
            onClick={() => setSelected(m)}
            className={`flex-shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              selected === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        {selected === "BP" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="systolic" stroke="hsl(var(--destructive))" strokeWidth={2} name="Systolic" dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="diastolic" stroke="hsl(var(--info))" strokeWidth={2} name="Diastolic" dot={{ r: 3 }} connectNulls />
          </LineChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip />
            <Line type="monotone" dataKey={dataKeyMap[selected]} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        )}
      </ResponsiveContainer>

      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {metrics.map(m => (
            <div key={m.label} className={`rounded-lg p-2.5 ${m.high ? "bg-destructive/10 border border-destructive/20" : "bg-muted"}`}>
              <div className="text-xs text-muted-foreground mb-0.5">{m.label}</div>
              <div className={`text-sm font-bold ${m.high ? "text-destructive" : "text-foreground"}`}>
                {m.current} {m.unit}
              </div>
              {m.prev && (
                <div className="text-xs text-muted-foreground">prev: {m.prev}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
