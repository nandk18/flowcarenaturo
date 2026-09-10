import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function verifySignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
  const data = new TextEncoder().encode(`${orderId}|${paymentId}`)
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, data)
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return computed === signature
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const body = await req.json()
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing payment verification fields")
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")
    if (!keySecret) throw new Error("Razorpay secret not configured")

    const valid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret)
    if (!valid) throw new Error("Invalid payment signature")

    const { data: payment } = await supabaseAdmin
      .from("subscription_payments")
      .select("clinic_id, plan_tier, billing_cycle")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle()

    if (!payment) throw new Error("Order not found")

    const months = payment.billing_cycle === "annual" ? 12 : 1
    const subscriptionEndsAt = addMonths(new Date(), months)
    const maxPatients = payment.plan_tier === "custom" ? 2000 : 500

    await supabaseAdmin.from("subscription_payments").update({
      razorpay_payment_id,
      razorpay_signature,
      status: "verified",
      verified_at: new Date().toISOString(),
    }).eq("razorpay_order_id", razorpay_order_id)

    await supabaseAdmin.from("clinics").update({
      subscription_status: "active",
      plan_tier: payment.plan_tier,
      billing_cycle: payment.billing_cycle,
      subscription_starts_at: new Date().toISOString(),
      subscription_ends_at: subscriptionEndsAt.toISOString(),
      max_patients_allowed: maxPatients,
      razorpay_customer_id: null,
      razorpay_subscription_id: null,
    }).eq("id", payment.clinic_id)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("razorpay-verify error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
