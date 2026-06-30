import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Loader2, Star } from "lucide-react";

type Template = {
  id: string;
  name: string;
  description: string | null;
  template_type: string;
  is_system: boolean | null;
  is_default: boolean | null;
  clinic_id: string | null;
};

export default function TemplatesPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    // System templates (clinic_id null) + this clinic's templates
    const { data } = await (supabase as any)
      .from("note_templates")
      .select("id, name, description, template_type, is_system, is_default, clinic_id")
      .or(`clinic_id.eq.${clinicId},clinic_id.is.null`)
      .order("is_system", { ascending: false })
      .order("name");
    setTemplates((data ?? []) as Template[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clinicId]);

  const setDefault = async (t: Template) => {
    if (!clinicId) return;
    setBusyId(t.id);
    try {
      // Clear any current default for this clinic
      await (supabase as any)
        .from("note_templates")
        .update({ is_default: false })
        .eq("clinic_id", clinicId)
        .eq("is_default", true);

      // If template is a system template (clinic_id null), clone into this clinic with is_default
      if (t.clinic_id === null) {
        // Check if a clone already exists
        const { data: existing } = await (supabase as any)
          .from("note_templates")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("name", t.name)
          .maybeSingle();
        if (existing?.id) {
          await (supabase as any).from("note_templates").update({ is_default: true }).eq("id", existing.id);
        } else {
          await (supabase as any).from("note_templates").insert({
            clinic_id: clinicId,
            name: t.name,
            description: t.description,
            template_type: t.template_type,
            sections: [],
            is_system: false,
            is_default: true,
          });
        }
      } else {
        await (supabase as any).from("note_templates").update({ is_default: true }).eq("id", t.id);
      }
      toast.success(`"${t.name}" is now the default template`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to set default");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Dedupe: if a clinic-specific template shares a name with a system one, prefer the clinic version
  const byName = new Map<string, Template>();
  for (const t of templates) {
    const existing = byName.get(t.name);
    if (!existing || (t.clinic_id !== null && existing.clinic_id === null)) {
      byName.set(t.name, t);
    }
  }
  const display = Array.from(byName.values());
  const defaultName = display.find((t) => t.is_default)?.name;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Manage clinical note templates. The default one auto-loads when a consultation is opened.
        </p>
        {defaultName && (
          <p className="mt-1 text-xs text-primary">
            Current default: <strong>{defaultName}</strong>
          </p>
        )}
      </div>

      <div className="max-w-2xl space-y-2">
        {display.map((t) => {
          const isFreeform = t.template_type === "freeform";
          return (
            <Card key={t.id} className="rounded-xl border-0 shadow-sm">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                      <Badge
                        variant="outline"
                        className={
                          isFreeform
                            ? "border-purple-300 bg-purple-50 text-purple-700 text-[10px]"
                            : "border-blue-300 bg-blue-50 text-blue-700 text-[10px]"
                        }
                      >
                        {isFreeform ? "Freeform" : "SOAP"}
                      </Badge>
                      {t.is_default && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                          <Star className="mr-0.5 h-3 w-3" /> Default
                        </Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                    )}
                  </div>
                </div>
                {t.is_default ? (
                  <Button size="sm" variant="outline" disabled>
                    Default
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDefault(t)}
                    disabled={busyId === t.id}
                  >
                    {busyId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set as Default"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {display.length === 0 && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No templates available.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
