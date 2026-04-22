-- Add super_admin to the role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Add new lab columns
ALTER TABLE public.labs
  ADD COLUMN IF NOT EXISTS tests_offered text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS tests_offered_other text,
  ADD COLUMN IF NOT EXISTS operating_hours text,
  ADD COLUMN IF NOT EXISTS suspended boolean DEFAULT false;