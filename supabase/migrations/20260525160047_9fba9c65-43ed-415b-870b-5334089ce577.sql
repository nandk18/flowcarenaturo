
-- 1. Remove public read on invoices; public viewer will use an edge function
DROP POLICY IF EXISTS public_invoice_view ON public.invoices;

-- 2. Remove public read on prescriptions storage bucket (it's private)
DROP POLICY IF EXISTS prescriptions_public_read ON storage.objects;

-- 3. Fix clinic-assets storage policies: require path to start with caller's clinic_id
DROP POLICY IF EXISTS clinic_assets_write ON storage.objects;
DROP POLICY IF EXISTS clinic_assets_update ON storage.objects;
DROP POLICY IF EXISTS clinic_assets_delete ON storage.objects;

CREATE POLICY clinic_assets_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinic-assets'
    AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
  );

CREATE POLICY clinic_assets_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'clinic-assets'
    AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'clinic-assets'
    AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
  );

CREATE POLICY clinic_assets_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'clinic-assets'
    AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
  );

-- 4. Restrict lab insert/update to admins
DROP POLICY IF EXISTS labs_insert ON public.labs;
CREATE POLICY labs_insert ON public.labs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS labs_update ON public.labs;
CREATE POLICY labs_update ON public.labs
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      registered_by_clinic_id = public.get_user_clinic_id(auth.uid())
      OR clinic_id = public.get_user_clinic_id(auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (
      registered_by_clinic_id = public.get_user_clinic_id(auth.uid())
      OR clinic_id = public.get_user_clinic_id(auth.uid())
    )
  );

-- 5. Prevent privilege escalation via profiles_insert_own (block elevated roles).
-- The handle_new_user trigger is SECURITY DEFINER and bypasses RLS, so invites still work.
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role IN ('doctor'::public.app_role, 'receptionist'::public.app_role)
  );
