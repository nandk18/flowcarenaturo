import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { clientCache, CACHE_KEYS, CACHE_TTL } from "@/lib/clientCache";

type Template = {
  id: string;
  name: string;
  description: string | null;
  sections: string[];
};

type Props = {
  clinicId: string;
  doctorId: string;
  doctorDefaultTemplateId: string | null;
  enabledTemplateNames: string[];
  onTemplateChange: (template: Template | null) => void;
};

export default function TemplateSelector({ clinicId, doctorId, doctorDefaultTemplateId, enabledTemplateNames, onTemplateChange }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      const cacheKey = CACHE_KEYS.clinicTemplates(clinicId);
      let data = clientCache.get<any[]>(cacheKey);
      if (!data) {
        const res = await supabase
          .from("note_templates")
          .select("id, name, description, sections")
          .or(`is_system.eq.true,clinic_id.eq.${clinicId}`)
          .order("name");
        data = res.data || null;
        if (data) clientCache.set(cacheKey, data, CACHE_TTL.templates);
      }
      if (data) {
        const allTemplates = data.map((t: any) => ({
          ...t,
          sections: Array.isArray(t.sections) ? t.sections : [],
        }));
        const enabled = enabledTemplateNames.length > 0
          ? allTemplates.filter(t => enabledTemplateNames.includes(t.name))
          : allTemplates.filter(t => t.name === "SOAP Notes");
        
        setTemplates(enabled);

        // Only auto-select on first mount, not on re-renders from tab switches
        if (!initialized) {
          // Check localStorage first
          const savedId = localStorage.getItem(`template_${doctorId}`);
          const savedTemplate = savedId ? enabled.find(t => t.id === savedId) : null;

          const defaultTemplate = savedTemplate
            || (doctorDefaultTemplateId ? enabled.find(t => t.id === doctorDefaultTemplateId) : null);
          const initial = defaultTemplate || enabled[0] || null;
          if (initial) {
            setSelectedId(initial.id);
            onTemplateChange(initial);
          }
          setInitialized(true);
        }
      }
    };
    fetchTemplates();
  }, [clinicId, enabledTemplateNames.join(",")]);

  const handleChange = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(`template_${doctorId}`, id);
    const tmpl = templates.find(t => t.id === id) || null;
    onTemplateChange(tmpl);
  };

  return (
    <div className="flex items-center gap-3">
      <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Template:</Label>
      <Select value={selectedId} onValueChange={handleChange}>
        <SelectTrigger className="w-[220px] rounded-lg">
          <SelectValue placeholder="Select template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map(t => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
