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
  name: "search_patients",
  title: "Search patients",
  description: "Search patients in the signed-in user's clinic by name, phone, or email. Returns up to 20 matches.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Free-text query matched against name, phone, or email."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const like = `%${query.replace(/[%_]/g, "")}%`;
    const { data, error } = await supa(ctx)
      .from("patients")
      .select("id, full_name, phone, email, created_at")
      .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .limit(20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { patients: data ?? [] },
    };
  },
});
