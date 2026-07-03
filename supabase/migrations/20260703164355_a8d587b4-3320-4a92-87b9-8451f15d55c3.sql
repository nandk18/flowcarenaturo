
CREATE OR REPLACE FUNCTION public.list_clinic_therapists(p_clinic_id uuid)
RETURNS TABLE(id uuid, full_name text, therapist_color text, room text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.therapist_color, p.room
    FROM public.profiles p
   WHERE p.clinic_id = p_clinic_id
     AND p.is_therapist = true
     AND p.pin_hash IS NOT NULL
   ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.list_clinic_therapists(uuid) TO anon, authenticated;
