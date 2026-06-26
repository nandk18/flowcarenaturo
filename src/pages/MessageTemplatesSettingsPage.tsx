import { useEffect, useState, useCallback } from "react";
import SettingsShell from "@/components/layout/SettingsShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import {
  TEMPLATE_META,
  TEMPLATE_TYPES,
  MessageTemplateType,
  defaultBody,
} from "@/lib/messageTemplates";

type Row = {
  id?: string;
  type: MessageTemplateType;
  name: string;
  message_body: string;
  is_active: boolean;
  dirty?: boolean;
  saving?: boolean;
};

export default function MessageTemplatesSettingsPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);

    // Seed defaults if none exist for this clinic
    const { data: existing } = await supabase
      .from("message_templates")
      .select("id, type, name, message_body, is_active")
      .eq("clinic_id", clinicId);

    if (!existing || existing.length === 0) {
      await supabase.rpc("seed_default_message_templates", { p_clinic_id: clinicId });
    }

    const { data } = await supabase
      .from("message_templates")
      .select("id, type, name, message_body, is_active")
      .eq("clinic_id", clinicId);

    const byType = new Map<string, any>();
    (data ?? []).forEach((r: any) => byType.set(r.type, r));

    const built: Row[] = TEMPLATE_TYPES.map((t) => {
      const r = byType.get(t);
      return r
        ? { id: r.id, type: t, name: r.name, message_body: r.message_body, is_active: r.is_active !== false }
        : { type: t, name: TEMPLATE_META[t].label, message_body: defaultBody(t), is_active: true };
    });
    setRows(built);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const update = (type: MessageTemplateType, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.type === type ? { ...r, ...patch, dirty: true } : r)));
  };

  const save = async (row: Row) => {
    if (!clinicId) return;
    setRows((rs) => rs.map((r) => (r.type === row.type ? { ...r, saving: true } : r)));
    const payload = {
      clinic_id: clinicId,
      type: row.type,
      name: row.name,
      message_body: row.message_body,
      is_active: row.is_active,
    };
    const { error } = row.id
      ? await supabase.from("message_templates").update(payload).eq("id", row.id)
      : await supabase.from("message_templates").insert(payload);
    if (error) {
      toast.error(error.message);
      setRows((rs) => rs.map((r) => (r.type === row.type ? { ...r, saving: false } : r)));
      return;
    }
    toast.success(`Saved "${row.name}"`);
    await load();
  };

  const resetToDefault = (type: MessageTemplateType) => {
    update(type, { message_body: defaultBody(type) });
  };

  if (loading) {
    return (
      <SettingsShell title="Message Templates">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="Message Templates">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Message Templates</h1>
          <p className="text-sm text-muted-foreground">
            Customize the WhatsApp messages sent for reminders, confirmations, and invoices.
            Use the variables shown for each template.
          </p>
        </div>

        {rows.map((row) => {
          const meta = TEMPLATE_META[row.type];
          return (
            <Card key={row.type} className="rounded-2xl shadow-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-sm">{row.name}</h2>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${row.type}`} className="text-xs text-muted-foreground">
                      Active
                    </Label>
                    <Switch
                      id={`active-${row.type}`}
                      checked={row.is_active}
                      onCheckedChange={(v) => update(row.type, { is_active: v })}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {meta.variables.map((v) => (
                    <Badge
                      key={v}
                      variant="outline"
                      className="cursor-pointer font-mono text-[10px]"
                      onClick={() => update(row.type, { message_body: row.message_body + " " + v })}
                    >
                      {v}
                    </Badge>
                  ))}
                </div>

                <Textarea
                  rows={5}
                  value={row.message_body}
                  onChange={(e) => update(row.type, { message_body: e.target.value })}
                  className="font-mono text-xs"
                />

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resetToDefault(row.type)}
                    className="text-xs"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> Reset to default
                  </Button>
                  <Button
                    size="sm"
                    disabled={!row.dirty || row.saving}
                    onClick={() => save(row)}
                  >
                    {row.saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </SettingsShell>
  );
}
