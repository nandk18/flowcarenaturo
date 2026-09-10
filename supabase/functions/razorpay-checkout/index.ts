import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const PRICING: Record<string, Record<string, number>> = {
  pro: { monthly: 299900, annual: 2999000 },
  custom: { monthly: 499900, annual: 4999000 },
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) throw new Error("Missing Authorization header")

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const body = await req.json()
    const { clinic_id, plan_tier, billing_cycle } = body
    if (!clinic_id || !plan_tier || !billing_cycle) throw new Error("clinic_id, plan_tier and billing_cycle are required")
    if (!PRICING[plan_tier]) throw new Error("Invalid plan_tier")
    if (!PRICING[plan_tier][billing_cycle]) throw new Error("Invalid billing_cycle")

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("clinic_id, role")
      .eq("user_id", user.id)
      .single()
    if (!profile || profile.role !== "admin" || profile.clinic_id !== clinic_id) {
      throw new Error("Unauthorized")
    }

    const amount = PRICING[plan_tier][billing_cycle]
    const keyId = Deno.env.get("RAZORPAY_KEY_ID")
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")
    if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured")

    const orderResp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(`${keyId}:${keySecret}`),
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `fc_${clinic_id.slice(0, 8)}_${Date.now()}`,
        notes: { clinic_id, plan_tier, billing_cycle },
      }),
    })

    if (!orderResp.ok) {
      const errText = await orderResp.text()
      throw new Error(`Razorpay order creation failed: ${orderResp.status} ${errText}`)
    }
    const order = await orderResp.json()

    await supabaseAdmin.from("subscription_payments").insert({
      clinic_id,
      user_id: user.id,
      razorpay_order_id: order.id,
      plan_tier,
      billing_cycle,
      amount: amount / 100,
      currency: "INR",
      status: "created",
    })

    return new Response(
      JSON.stringify({ order_id: order.id, key_id: keyId, amount, currency: "INR" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("razorpay-checkout error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
