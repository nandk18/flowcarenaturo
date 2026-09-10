import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")
    if (!secret) throw new Error("Webhook secret not configured")

    const signature = req.headers.get("x-razorpay-signature")
    if (!signature) throw new Error("Missing webhook signature")

    const body = await req.text()
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    if (computed !== signature) throw new Error("Invalid webhook signature")

    const payload = JSON.parse(body)
    const event = payload.event
    const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity || payload.payload?.subscription?.entity

    if (!entity) {
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    if (event === "payment.captured" && entity.status === "captured") {
      const notes = entity.notes || {}
      const clinicId = notes.clinic_id
      const orderId = entity.order_id

      if (!clinicId && orderId) {
        const { data: payment } = await supabaseAdmin
          .from("subscription_payments")
          .select("clinic_id, plan_tier, billing_cycle")
          .eq("razorpay_order_id", orderId)
          .maybeSingle()
        if (payment) {
          const months = payment.billing_cycle === "annual" ? 12 : 1
          await supabaseAdmin.from("clinics").update({
            subscription_status: "active",
            plan_tier: payment.plan_tier,
            billing_cycle: payment.billing_cycle,
            subscription_starts_at: new Date().toISOString(),
            subscription_ends_at: addMonths(new Date(), months).toISOString(),
            max_patients_allowed: payment.plan_tier === "custom" ? 2000 : 500,
          }).eq("id", payment.clinic_id)

          await supabaseAdmin.from("subscription_payments").update({
            razorpay_payment_id: entity.id,
            status: "verified",
            verified_at: new Date().toISOString(),
          }).eq("razorpay_order_id", orderId)
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error) {
    console.error("razorpay-webhook error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
