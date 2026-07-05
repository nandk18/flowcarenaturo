import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supa(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_appointments",
  title: "List appointments",
  description: "List appointments in the signed-in user's clinic for a given date (YYYY-MM-DD). Defaults to today.",
  inputSchema: {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Date in YYYY-MM-DD. Defaults to today (UTC)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const d = date ?? new Date().toISOString().slice(0, 10);
    const { data, error } = await supa(ctx)
      .from("appointments")
      .select("id, patient_id, appointment_date, appointment_time, status, doctor_id, notes")
      .eq("appointment_date", d)
      .order("appointment_time", { ascending: true })
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { date: d, appointments: data ?? [] },
    };
  },
});
