ALTER TABLE public.todo_list 
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_todo_list_patient_id ON public.todo_list(patient_id);
CREATE INDEX IF NOT EXISTS idx_todo_list_clinic_patient ON public.todo_list(clinic_id, patient_id);