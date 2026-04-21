import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const authHeader = req.headers.get("Authorization")!
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("clinic_id, role")
      .eq("user_id", user.id)
      .single()

    if (!callerProfile?.clinic_id) throw new Error("No clinic found")
    if (callerProfile.role !== "admin") throw new Error("Only admins can remove staff")

    const { target_user_id } = await req.json()
    if (!target_user_id) throw new Error("target_user_id is required")

    if (target_user_id === user.id) throw new Error("You cannot remove yourself")

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("clinic_id, full_name, role")
      .eq("user_id", target_user_id)
      .single()

    if (!targetProfile) throw new Error("User not found")
    if (targetProfile.clinic_id !== callerProfile.clinic_id) {
      throw new Error("User does not belong to your clinic")
    }

    // Use service role to bypass RLS and unlink the user from clinic
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        clinic_id: null,
        role: "admin" // reset to prevent null role issues
      })
      .eq("user_id", target_user_id)

    if (profileError) throw profileError

    // Remove from user_roles
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", target_user_id)

    return new Response(
      JSON.stringify({ success: true, message: "Staff member removed successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("remove-staff error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
