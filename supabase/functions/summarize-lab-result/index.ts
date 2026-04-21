import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { lab_result_id, file_path, file_type, test_name, patient_context } = await req.json();

    if (!lab_result_id || !file_path) {
      throw new Error("lab_result_id and file_path are required");
    }

    // Download the file from storage as bytes
    const { data: fileData, error: dlError } = await supabaseAdmin.storage
      .from("lab-results")
      .download(file_path);

    if (dlError || !fileData) {
      throw new Error("Failed to download file: " + (dlError?.message || "unknown"));
    }

    // Convert blob to base64
    const arrayBuf = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as any);
    }
    const base64 = btoa(binary);

    // Determine media type for Claude
    const mediaType = file_type || "application/pdf";
    const isImage = mediaType.startsWith("image/");
    const isPdf = mediaType === "application/pdf";

    if (!isImage && !isPdf) {
      throw new Error("Unsupported file type. Please upload PDF or image.");
    }

    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const userContent: any[] = [
      {
        type: isPdf ? "document" : "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64,
        },
      },
      {
        type: "text",
        text: `Test ordered: ${test_name || "Unknown"}
Patient context: ${patient_context || "Not provided"}

Analyze this lab result document and return ONLY valid JSON (no markdown, no code fences) in this exact shape:
{
  "overall_status": "normal" | "borderline" | "abnormal" | "critical",
  "one_line_summary": "Brief one-sentence summary for the doctor",
  "key_findings": ["finding 1", "finding 2"],
  "abnormal_values": [
    {"parameter": "name", "value": "result", "normal_range": "range", "significance": "high" | "medium" | "low"}
  ],
  "normal_values": ["parameter1 normal", "parameter2 normal"],
  "clinical_interpretation": "2-3 sentence interpretation",
  "suggested_actions": ["action 1", "action 2"],
  "urgent": true | false,
  "extracted_text": "Full text content extracted from the document"
}`,
      },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      if (response.status === 429) throw new Error("AI service is busy. Please retry shortly.");
      if (response.status === 401) throw new Error("AI authentication failed.");
      throw new Error("AI service error: " + response.status);
    }

    const aiData = await response.json();
    let summary: any = {};
    let extractedText = "";
    try {
      const text = aiData.content?.[0]?.text?.trim() || "{}";
      const cleaned = text.replace(/```json|```/g, "").trim();
      summary = JSON.parse(cleaned);
      extractedText = summary.extracted_text || "";
      delete summary.extracted_text;
    } catch (e) {
      console.error("Parse error:", e);
      summary = {
        one_line_summary: "Could not parse AI summary. Please review the document directly.",
        overall_status: "unknown",
      };
    }

    // Save summary + extracted text
    await supabaseAdmin
      .from("lab_results")
      .update({ ai_summary: summary, extracted_text: extractedText })
      .eq("id", lab_result_id);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("summarize-lab-result error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
