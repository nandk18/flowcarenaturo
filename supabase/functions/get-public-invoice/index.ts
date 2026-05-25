import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("id") ?? "";
    if (!UUID_RE.test(invoiceId)) {
      return new Response(JSON.stringify({ error: "Invalid id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id,invoice_number,invoice_date,status,line_items,subtotal,discount_amount,gst_amount,gst_percentage,total_amount,paid_amount,outstanding_amount,clinic_id,patient_id,doctor_id")
      .eq("id", invoiceId)
      .maybeSingle();

    if (error || !invoice) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: clinic }, { data: patient }, { data: doctor }] = await Promise.all([
      supabase.from("clinics").select("id,name,address,phone,logo_url,gst_number").eq("id", invoice.clinic_id).maybeSingle(),
      supabase.from("patients").select("name,healthcare_id,phone").eq("id", invoice.patient_id).maybeSingle(),
      invoice.doctor_id
        ? supabase.from("doctors").select("name").eq("id", invoice.doctor_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return new Response(JSON.stringify({ invoice, clinic, patient, doctor }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});