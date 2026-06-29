import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const { transcript, patient_context, template_name, template_sections, mode } = await req.json();

    const isFreeform = mode === "freeform";

    const systemPrompt = isFreeform
      ? `You are an expert medical scribe for Indian outpatient clinics.
Clean up the doctor's dictation (which may be in English or any Indian regional
language: Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati,
Punjabi). Output the cleaned version in clear, well-punctuated clinical English.
Preserve the doctor's structure and bullets. Do NOT invent content. Do NOT add
headings like Subjective/Objective/Assessment/Plan unless the doctor dictated them.

Return ONLY a valid JSON object with no extra text, no markdown, no code blocks:
{ "formatted_text": "the cleaned formatted notes here" }`
      : `You are an expert medical scribe for Indian outpatient clinics.
Convert the doctor's dictation into structured clinical documentation.
The dictation may be in English or any Indian regional language (Hindi, Tamil,
Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi).
Always write the output in English regardless of input language.
${template_name && template_sections
  ? `Format the output according to the "${template_name}" template with these sections: ${template_sections.join(", ")}.`
  : "Use standard SOAP format."}

Return ONLY a valid JSON object with no extra text, no markdown, no code blocks:
{
  "subjective": "patient complaint and history in clinical English",
  "objective": "examination findings and vitals",
  "assessment": "diagnosis or differential diagnosis",
  "plan": "management plan",
  "medications": [
    {
      "name": "drug name",
      "dosage": "500mg",
      "morning": true,
      "afternoon": false,
      "evening": true,
      "night": true,
      "duration": "5 days",
      "notes": "after food"
    }
  ],
  "investigations": ["CBC", "Blood Sugar Fasting"],
  "icd_suggestions": ["J06.9 - Acute upper respiratory infection"],
  "follow_up_days": 5
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Patient context: ${JSON.stringify(patient_context || {})}

Doctor's dictation to convert:
"${transcript}"

Convert this into the structured SOAP JSON format.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);

      let errorMessage: string;
      let errorCode: string;

      if (response.status === 401) {
        errorMessage = "Anthropic API key is invalid. Please check your API key.";
        errorCode = "invalid_key";
      } else if (response.status === 429) {
        errorMessage = "Anthropic account has no credits. Please add billing at console.anthropic.com";
        errorCode = "no_credits";
      } else {
        let parsed: string;
        try {
          const json = JSON.parse(errorText);
          parsed = json.error?.message || errorText;
        } catch {
          parsed = errorText;
        }
        errorMessage = `SOAP formatting failed: ${parsed}`;
        errorCode = "api_error";
      }

      return new Response(
        JSON.stringify({ error: errorMessage, error_code: errorCode, status: response.status }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const claudeResponse = await response.json();
    const content = claudeResponse.content[0].text;

    const cleaned = content.replace(/```json|```/g, "").trim();
    const soapData = JSON.parse(cleaned);

    return new Response(JSON.stringify(soapData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("format-soap-notes error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", error_code: "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
