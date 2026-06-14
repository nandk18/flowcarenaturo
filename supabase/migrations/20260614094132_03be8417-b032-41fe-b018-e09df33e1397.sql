ALTER TABLE public.doctor_schedules DROP CONSTRAINT IF EXISTS doctor_schedules_doctor_id_fkey;
ALTER TABLE public.doctor_schedules ADD CONSTRAINT doctor_schedules_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;

ALTER TABLE public.doctor_exceptions DROP CONSTRAINT IF EXISTS doctor_exceptions_doctor_id_fkey;
ALTER TABLE public.doctor_exceptions ADD CONSTRAINT doctor_exceptions_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;