import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_FIELDS = new Set([
  'first_name', 'last_name', 'dob', 'gender', 'blood_group', 'email',
  'address', 'food_habits', 'smoking', 'alcohol', 'sleep_hours', 'dinner_time',
  'medication_history', 'past_surgery_details', 'convenient_time',
  'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token, updates } = await req.json();
    if (!token || typeof token !== 'string' || !updates || typeof updates !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing token or updates' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Use the existing SECURITY DEFINER RPC which already validates the token
    // and applies allowed-field updates atomically.
    const { data, error } = await supabase.rpc('complete_patient_form', {
      p_token: token,
      p_updates: Object.fromEntries(
        Object.entries(updates).filter(([k, v]) => ALLOWED_FIELDS.has(k) && v !== '' && v != null),
      ),
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (data === false) {
      return new Response(JSON.stringify({ error: 'invalid_or_expired' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
