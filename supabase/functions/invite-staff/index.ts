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

    const body = await req.json()

    // ============ LAB SELF-REGISTRATION (no auth required) ============
    if (body.mode === "self_register_lab") {
      const { name, email, phone, address, tests_offered, tests_offered_other, operating_hours } = body

      if (!name || !email) {
        return new Response(
          JSON.stringify({ error: "Lab name and email are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Check if email already registered
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const alreadyExists = existingUsers?.users?.some(u => u.email === email)
      if (alreadyExists) {
        return new Response(
          JSON.stringify({ error: "This email is already registered" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Create lab record
      const { data: lab, error: labError } = await supabaseAdmin
        .from("labs")
        .insert({
          name,
          email,
          phone: phone || null,
          address: address || null,
          tests_offered: tests_offered || [],
          tests_offered_other: tests_offered_other || null,
          operating_hours: operating_hours || null,
          type: "external",
          verified: false,
        })
        .select()
        .single()

      if (labError) throw labError

      const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://stethoscribe.lovable.app"
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/accept-invite`,
        data: {
          invited_role: "lab",
          invited_lab_id: lab.id,
          invited_clinic_id: null,
          full_name: name,
          invited_by: "StethoScribe Platform",
        },
      })

      if (inviteError) {
        // Rollback lab creation if invite failed
        await supabaseAdmin.from("labs").delete().eq("id", lab.id)
        throw inviteError
      }

      return new Response(
        JSON.stringify({ success: true, lab_id: lab.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ============ STAFF INVITE (auth required) ============
    const authHeader = req.headers.get("Authorization")!
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("clinic_id, full_name, role")
      .eq("user_id", user.id)
      .single()

    if (!profile?.clinic_id) throw new Error("No clinic found for this user")
    if (profile.role !== "admin") throw new Error("Only admins can invite staff")

    const { email, role, lab_id } = body
    if (!email || !role) throw new Error("Email and role are required")
    if (!["doctor", "receptionist", "lab"].includes(role)) throw new Error("Invalid role")
    if (role === "lab" && !lab_id) throw new Error("lab_id is required when inviting a lab user")

    const { data: clinic } = await supabaseAdmin
      .from("clinics").select("name").eq("id", profile.clinic_id).single()

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      const profileUpdate: any = {
        user_id: existingUser.id,
        clinic_id: profile.clinic_id,
        role: role,
        full_name: existingUser.user_metadata?.full_name || email.split("@")[0],
      }
      if (role === "lab") profileUpdate.lab_id = lab_id

      await supabaseAdmin.from("profiles").upsert(profileUpdate, { onConflict: "user_id" })

      await supabaseAdmin.from("user_roles").upsert({
        user_id: existingUser.id, role
      }, { onConflict: "user_id,role" })

      if (role === "doctor") {
        const { data: existingDoctor } = await supabaseAdmin
          .from("doctors").select("id").eq("user_id", existingUser.id).maybeSingle()
        if (!existingDoctor) {
          await supabaseAdmin.from("doctors").insert({
            clinic_id: profile.clinic_id,
            user_id: existingUser.id,
            name: existingUser.user_metadata?.full_name || email.split("@")[0],
            specialty: "General Medicine"
          })
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Existing user added as " + role }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const inviteMeta: any = {
      invited_role: role,
      invited_clinic_id: profile.clinic_id,
      invited_clinic_name: clinic?.name || "Clinic",
      invited_by: profile.full_name || "Admin",
    }
    if (role === "lab") inviteMeta.invited_lab_id = lab_id

    const origin = req.headers.get("origin") || "https://stethoscribe.lovable.app"
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${origin}/accept-invite`,
        data: inviteMeta,
      }
    )

    if (inviteError) throw inviteError

    const newProfile: any = {
      user_id: inviteData.user.id,
      clinic_id: profile.clinic_id,
      role: role,
      full_name: email.split("@")[0],
    }
    if (role === "lab") newProfile.lab_id = lab_id

    await supabaseAdmin.from("profiles").upsert(newProfile, { onConflict: "user_id" })

    await supabaseAdmin.from("user_roles").upsert({
      user_id: inviteData.user.id, role
    }, { onConflict: "user_id,role" })

    return new Response(
      JSON.stringify({ success: true, message: "Invitation sent to " + email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("invite-staff error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
