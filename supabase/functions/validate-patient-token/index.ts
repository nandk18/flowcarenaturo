import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tokenRow } = await supabase
      .from('patient_form_tokens')
      .select('patient_id, clinic_id, expires_at, used_at, is_active')
      .eq('token', token)
      .maybeSingle();

    if (
      !tokenRow ||
      !tokenRow.is_active ||
      tokenRow.used_at ||
      new Date(tokenRow.expires_at) <= new Date()
    ) {
      return new Response(JSON.stringify({ error: 'invalid_or_expired' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: patient }, { data: clinic }] = await Promise.all([
      supabase.from('patients').select('*').eq('id', tokenRow.patient_id).maybeSingle(),
      supabase.from('clinics').select('name, phone, address').eq('id', tokenRow.clinic_id).maybeSingle(),
    ]);

    if (!patient) {
      return new Response(JSON.stringify({ error: 'patient_not_found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ patient, clinic }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
