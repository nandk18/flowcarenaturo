import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Best-effort lab order notification.
// If a Lovable email domain is configured later, this will use it.
// For now, it logs the intent and returns success so the UI flow is not blocked.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      lab_order_id,
      lab_email,
      patient_name,
      test_name,
      urgency,
      clinical_notes,
      doctor_name,
      clinic_name,
    } = body;

    if (!lab_order_id || !lab_email) {
      throw new Error("lab_order_id and lab_email are required");
    }

    // Email notifications disabled for now — lab sees orders in their dashboard.
    console.log("Lab order received (in-app only):", {
      lab_order_id, lab_email, test_name, urgency,
    });

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: false,
        note: "Order delivered to lab dashboard.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-lab-order error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
