import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Template = {
  id: string;
  name: string;
  description: string | null;
  sections: string[];
  template_type?: string;
  is_default?: boolean;
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
      const { data } = await (supabase as any)
        .from("note_templates")
        .select("id, name, description, sections, template_type, is_default, clinic_id, is_system")
        .or(`is_system.eq.true,clinic_id.eq.${clinicId}`)
        .order("name");
      if (data) {
        // Dedupe: prefer clinic-specific over system if same name
        const byName = new Map<string, any>();
        for (const t of data) {
          const existing = byName.get(t.name);
          if (!existing || (t.clinic_id !== null && existing.clinic_id === null)) {
            byName.set(t.name, t);
          }
        }
        const allTemplates = Array.from(byName.values()).map((t: any) => ({
          ...t,
          sections: Array.isArray(t.sections) ? t.sections : [],
          template_type: t.template_type || "soap",
        })) as Template[];

        // Always include the clinic's default + free-form, regardless of doctor enabledTemplateNames
        const enabled = enabledTemplateNames.length > 0
          ? allTemplates.filter((t) => enabledTemplateNames.includes(t.name) || t.is_default || t.template_type === "freeform")
          : allTemplates;

        setTemplates(enabled);

        if (!initialized) {
          const savedId = localStorage.getItem(`template_${doctorId}`);
          const savedTemplate = savedId ? enabled.find(t => t.id === savedId) : null;
          const clinicDefault = enabled.find((t) => t.is_default);
          const defaultTemplate = savedTemplate
            || clinicDefault
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <SelectTrigger className="w-[240px] rounded-lg">
          <SelectValue placeholder="Select template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map(t => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}{t.template_type === "freeform" ? " (Freeform)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
