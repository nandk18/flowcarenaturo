import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_FIELDS = new Set([
  'first_name', 'last_name', 'dob', 'gender', 'blood_group', 'email',
  'address', 'food_habits', 'smoking', 'alcohol', 'sleep_hours', 'dinner_time',
  'medication_history', 'past_surgery_details', 'convenient_time',
  'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
]);

const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCS = 3;
const ALLOWED_DOC_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_CATEGORIES = ['Medical Report', 'Prescription', 'Insurance', 'ID Proof', 'Lab Report', 'Other'];

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',')[1] : b64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token, updates, documents } = await req.json();
    if (!token || typeof token !== 'string' || !updates || typeof updates !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing token or updates' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve patient + clinic from token BEFORE consuming it (so we can upload docs)
    const { data: tokenRow } = await supabase
      .from('patient_form_tokens')
      .select('patient_id, clinic_id, expires_at, used_at, is_active')
      .eq('token', token)
      .maybeSingle();

    if (!tokenRow || tokenRow.used_at || !tokenRow.is_active || new Date(tokenRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'invalid_or_expired' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apply field updates via SECURITY DEFINER RPC (also marks token used)
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

    // Optional: upload patient-supplied documents
    let docsUploaded = 0;
    if (Array.isArray(documents) && documents.length > 0) {
      const docs = documents.slice(0, MAX_DOCS);
      for (const d of docs) {
        if (!d?.name || !d?.dataBase64 || !d?.type) continue;
        if (!ALLOWED_DOC_MIME.includes(d.type)) continue;
        const bytes = base64ToBytes(d.dataBase64);
        if (bytes.byteLength > MAX_DOC_SIZE) continue;
        const category = ALLOWED_CATEGORIES.includes(d.category) ? d.category : 'Other';
        const safeName = String(d.name).replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${tokenRow.clinic_id}/${tokenRow.patient_id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('patient-documents')
          .upload(path, bytes, { contentType: d.type });
        if (upErr) continue;
        const { error: dbErr } = await supabase.from('patient_documents').insert({
          clinic_id: tokenRow.clinic_id,
          patient_id: tokenRow.patient_id,
          file_name: d.name,
          file_url: path,
          file_type: d.type,
          file_size: bytes.byteLength,
          category,
          uploaded_by_patient: true,
        });
        if (!dbErr) docsUploaded++;
      }
    }

    return new Response(JSON.stringify({ success: true, documents_uploaded: docsUploaded }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
