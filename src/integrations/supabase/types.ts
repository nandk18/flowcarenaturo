export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointment_services: {
        Row: {
          appointment_id: string | null
          clinic_id: string | null
          created_at: string | null
          id: string
          service_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          service_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "invoice_services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          cancellation_reason: string | null
          care_call_done: boolean | null
          care_call_due_date: string | null
          care_call_required: boolean | null
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          doctor_id: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          patient_id: string | null
          reason: string | null
          reschedule_reason: string | null
          rescheduled_from: string | null
          rescheduled_to: string | null
          status: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          cancellation_reason?: string | null
          care_call_done?: boolean | null
          care_call_due_date?: string | null
          care_call_required?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          reason?: string | null
          reschedule_reason?: string | null
          rescheduled_from?: string | null
          rescheduled_to?: string | null
          status?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          cancellation_reason?: string | null
          care_call_done?: boolean | null
          care_call_due_date?: string | null
          care_call_required?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          reason?: string | null
          reschedule_reason?: string | null
          rescheduled_from?: string | null
          rescheduled_to?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_to_fkey"
            columns: ["rescheduled_to"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          clinic_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_name: string | null
          resource_type: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      background_jobs: {
        Row: {
          attempts: number | null
          clinic_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string
          max_attempts: number | null
          payload: Json
          queue_name: string
          result: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          max_attempts?: number | null
          payload?: Json
          queue_name: string
          result?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          max_attempts?: number | null
          payload?: Json
          queue_name?: string
          result?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "background_jobs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          called_at: string | null
          called_by: string | null
          clinic_id: string | null
          id: string
          notes: string | null
          outcome: string
          patient_id: string | null
          source: string | null
        }
        Insert: {
          called_at?: string | null
          called_by?: string | null
          clinic_id?: string | null
          id?: string
          notes?: string | null
          outcome: string
          patient_id?: string | null
          source?: string | null
        }
        Update: {
          called_at?: string | null
          called_by?: string | null
          clinic_id?: string | null
          id?: string
          notes?: string | null
          outcome?: string
          patient_id?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_called_by_fkey"
            columns: ["called_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          order_index: number | null
          title: string
          type: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title: string
          type: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_logs: {
        Row: {
          check_date: string | null
          checked_at: string | null
          checked_by: string | null
          checklist_item_id: string | null
          clinic_id: string | null
          id: string
          is_checked: boolean | null
        }
        Insert: {
          check_date?: string | null
          checked_at?: string | null
          checked_by?: string | null
          checklist_item_id?: string | null
          clinic_id?: string | null
          id?: string
          is_checked?: boolean | null
        }
        Update: {
          check_date?: string | null
          checked_at?: string | null
          checked_by?: string | null
          checklist_item_id?: string | null
          clinic_id?: string | null
          id?: string
          is_checked?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_logs_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_checklists: {
        Row: {
          check_date: string | null
          checked_at: string | null
          checked_by: string | null
          clinic_id: string | null
          created_at: string | null
          id: string
          is_checked: boolean | null
          order_index: number | null
          title: string
          type: string
        }
        Insert: {
          check_date?: string | null
          checked_at?: string | null
          checked_by?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_checked?: boolean | null
          order_index?: number | null
          title: string
          type: string
        }
        Update: {
          check_date?: string | null
          checked_at?: string | null
          checked_by?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_checked?: boolean | null
          order_index?: number | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_checklists_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_financial_settings: {
        Row: {
          clinic_id: string | null
          id: string
          petty_cash_balance: number | null
          petty_cash_limit: number | null
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          id?: string
          petty_cash_balance?: number | null
          petty_cash_limit?: number | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          id?: string
          petty_cash_balance?: number | null
          petty_cash_limit?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_financial_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_labs: {
        Row: {
          added_at: string | null
          clinic_id: string
          id: string
          is_preferred: boolean | null
          lab_id: string
        }
        Insert: {
          added_at?: string | null
          clinic_id: string
          id?: string
          is_preferred?: boolean | null
          lab_id: string
        }
        Update: {
          added_at?: string | null
          clinic_id?: string
          id?: string
          is_preferred?: boolean | null
          lab_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_labs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_labs_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          audio_url: string | null
          created_at: string | null
          doctor_id: string
          freeform_notes: string | null
          id: string
          language_detected: string | null
          raw_transcript: string | null
          soap_notes: Json | null
          template_name: string | null
          template_type: string | null
          updated_at: string | null
          visit_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          doctor_id: string
          freeform_notes?: string | null
          id?: string
          language_detected?: string | null
          raw_transcript?: string | null
          soap_notes?: Json | null
          template_name?: string | null
          template_type?: string | null
          updated_at?: string | null
          visit_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          doctor_id?: string
          freeform_notes?: string | null
          id?: string
          language_detected?: string | null
          raw_transcript?: string | null
          soap_notes?: Json | null
          template_name?: string | null
          template_type?: string | null
          updated_at?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          gst_number: string | null
          gst_percentage: number | null
          id: string
          invoice_counter: number | null
          invoice_footer_note: string | null
          invoice_header_note: string | null
          invoice_prefix: string | null
          letterhead_url: string | null
          logo_url: string | null
          name: string
          onboarding_complete: boolean | null
          phone: string | null
          prescription_template: string | null
          regional_language: string | null
          show_logo_on_invoice: boolean
          treatment_enabled: boolean | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          gst_number?: string | null
          gst_percentage?: number | null
          id?: string
          invoice_counter?: number | null
          invoice_footer_note?: string | null
          invoice_header_note?: string | null
          invoice_prefix?: string | null
          letterhead_url?: string | null
          logo_url?: string | null
          name: string
          onboarding_complete?: boolean | null
          phone?: string | null
          prescription_template?: string | null
          regional_language?: string | null
          show_logo_on_invoice?: boolean
          treatment_enabled?: boolean | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          gst_number?: string | null
          gst_percentage?: number | null
          id?: string
          invoice_counter?: number | null
          invoice_footer_note?: string | null
          invoice_header_note?: string | null
          invoice_prefix?: string | null
          letterhead_url?: string | null
          logo_url?: string | null
          name?: string
          onboarding_complete?: boolean | null
          phone?: string | null
          prescription_template?: string | null
          regional_language?: string | null
          show_logo_on_invoice?: boolean
          treatment_enabled?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      contact_notes: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          note: string
          patient_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note: string
          patient_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string
          patient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_exceptions: {
        Row: {
          affects_appointments: boolean | null
          clinic_id: string | null
          created_at: string | null
          doctor_id: string | null
          end_time: string | null
          exception_date: string
          id: string
          is_full_day: boolean | null
          reason: string | null
          start_time: string | null
          type: string | null
        }
        Insert: {
          affects_appointments?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          doctor_id?: string | null
          end_time?: string | null
          exception_date: string
          id?: string
          is_full_day?: boolean | null
          reason?: string | null
          start_time?: string | null
          type?: string | null
        }
        Update: {
          affects_appointments?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          doctor_id?: string | null
          end_time?: string | null
          exception_date?: string
          id?: string
          is_full_day?: boolean | null
          reason?: string | null
          start_time?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_exceptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_exceptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_schedules: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          day_of_week: number | null
          doctor_id: string | null
          id: string
          is_active: boolean | null
          sessions: Json
          slot_duration_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          day_of_week?: number | null
          doctor_id?: string | null
          id?: string
          is_active?: boolean | null
          sessions?: Json
          slot_duration_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          day_of_week?: number | null
          doctor_id?: string | null
          id?: string
          is_active?: boolean | null
          sessions?: Json
          slot_duration_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_schedules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_schedules_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          availability: string | null
          clinic_id: string
          created_at: string | null
          default_template: string | null
          default_template_id: string | null
          enabled_templates: string[] | null
          id: string
          name: string
          qualification: string | null
          registration_number: string | null
          signature_url: string | null
          specialty: string | null
          user_id: string
        }
        Insert: {
          availability?: string | null
          clinic_id: string
          created_at?: string | null
          default_template?: string | null
          default_template_id?: string | null
          enabled_templates?: string[] | null
          id?: string
          name: string
          qualification?: string | null
          registration_number?: string | null
          signature_url?: string | null
          specialty?: string | null
          user_id: string
        }
        Update: {
          availability?: string | null
          clinic_id?: string
          created_at?: string | null
          default_template?: string | null
          default_template_id?: string | null
          enabled_templates?: string[] | null
          id?: string
          name?: string
          qualification?: string | null
          registration_number?: string | null
          signature_url?: string | null
          specialty?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      document_shares: {
        Row: {
          id: string
          prescription_id: string
          recipient: string | null
          shared_at: string | null
          shared_via: string
        }
        Insert: {
          id?: string
          prescription_id: string
          recipient?: string | null
          shared_at?: string | null
          shared_via: string
        }
        Update: {
          id?: string
          prescription_id?: string
          recipient?: string | null
          shared_at?: string | null
          shared_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_list: {
        Row: {
          amount: number | null
          category: string | null
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          expense_date: string | null
          id: string
          notes: string | null
          payment_type: string | null
          title: string
        }
        Insert: {
          amount?: number | null
          category?: string | null
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expense_date?: string | null
          id?: string
          notes?: string | null
          payment_type?: string | null
          title: string
        }
        Update: {
          amount?: number | null
          category?: string | null
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expense_date?: string | null
          id?: string
          notes?: string | null
          payment_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_list_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          clinic_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          duplicate_rows: number | null
          error_details: Json | null
          error_rows: number | null
          file_name: string | null
          id: string
          processed_rows: number | null
          started_at: string | null
          status: string | null
          success_rows: number | null
          total_rows: number | null
        }
        Insert: {
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duplicate_rows?: number | null
          error_details?: Json | null
          error_rows?: number | null
          file_name?: string | null
          id?: string
          processed_rows?: number | null
          started_at?: string | null
          status?: string | null
          success_rows?: number | null
          total_rows?: number | null
        }
        Update: {
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duplicate_rows?: number | null
          error_details?: Json | null
          error_rows?: number | null
          file_name?: string | null
          id?: string
          processed_rows?: number | null
          started_at?: string | null
          status?: string | null
          success_rows?: number | null
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_services: {
        Row: {
          amount: number
          clinic_id: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          gst_percentage: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          max_per_day: number | null
          name: string
          requires_therapist: boolean | null
          room_required: string | null
          service_type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          gst_percentage?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          max_per_day?: number | null
          name: string
          requires_therapist?: boolean | null
          room_required?: string | null
          service_type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          gst_percentage?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          max_per_day?: number | null
          name?: string
          requires_therapist?: boolean | null
          room_required?: string | null
          service_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          doctor_id: string | null
          gst_amount: number | null
          gst_percentage: number | null
          id: string
          invoice_date: string | null
          invoice_number: string
          line_items: Json
          notes: string | null
          outstanding_amount: number | null
          paid_amount: number | null
          patient_id: string
          pdf_generated_at: string | null
          pdf_url: string | null
          status: string | null
          subtotal: number | null
          total_amount: number
          updated_at: string | null
          visit_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          doctor_id?: string | null
          gst_amount?: number | null
          gst_percentage?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number: string
          line_items?: Json
          notes?: string | null
          outstanding_amount?: number | null
          paid_amount?: number | null
          patient_id: string
          pdf_generated_at?: string | null
          pdf_url?: string | null
          status?: string | null
          subtotal?: number | null
          total_amount?: number
          updated_at?: string | null
          visit_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          doctor_id?: string | null
          gst_amount?: number | null
          gst_percentage?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          line_items?: Json
          notes?: string | null
          outstanding_amount?: number | null
          paid_amount?: number | null
          patient_id?: string
          pdf_generated_at?: string | null
          pdf_url?: string | null
          status?: string | null
          subtotal?: number | null
          total_amount?: number
          updated_at?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          clinic_id: string
          clinical_notes: string | null
          created_at: string | null
          doctor_id: string | null
          id: string
          lab_id: string | null
          ordered_at: string | null
          patient_id: string
          status: string | null
          test_category: string | null
          test_name: string
          urgency: string | null
          visit_id: string | null
        }
        Insert: {
          clinic_id: string
          clinical_notes?: string | null
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          lab_id?: string | null
          ordered_at?: string | null
          patient_id: string
          status?: string | null
          test_category?: string | null
          test_name: string
          urgency?: string | null
          visit_id?: string | null
        }
        Update: {
          clinic_id?: string
          clinical_notes?: string | null
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          lab_id?: string | null
          ordered_at?: string | null
          patient_id?: string
          status?: string | null
          test_category?: string | null
          test_name?: string
          urgency?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          actioned_prescription_id: string | null
          ai_summary: Json | null
          clinic_id: string
          created_at: string | null
          doctor_id: string | null
          doctor_notes: string | null
          extracted_text: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          lab_id: string | null
          lab_order_id: string
          patient_id: string
          reviewed_at: string | null
          status: string | null
          uploaded_at: string | null
        }
        Insert: {
          actioned_prescription_id?: string | null
          ai_summary?: Json | null
          clinic_id: string
          created_at?: string | null
          doctor_id?: string | null
          doctor_notes?: string | null
          extracted_text?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          lab_id?: string | null
          lab_order_id: string
          patient_id: string
          reviewed_at?: string | null
          status?: string | null
          uploaded_at?: string | null
        }
        Update: {
          actioned_prescription_id?: string | null
          ai_summary?: Json | null
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string | null
          doctor_notes?: string | null
          extracted_text?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          lab_id?: string | null
          lab_order_id?: string
          patient_id?: string
          reviewed_at?: string | null
          status?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_actioned_prescription_id_fkey"
            columns: ["actioned_prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      labs: {
        Row: {
          address: string | null
          clinic_id: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          operating_hours: string | null
          phone: string | null
          registered_by_clinic_id: string | null
          suspended: boolean | null
          tests_offered: string[] | null
          tests_offered_other: string | null
          type: string
          verified: boolean
        }
        Insert: {
          address?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          operating_hours?: string | null
          phone?: string | null
          registered_by_clinic_id?: string | null
          suspended?: boolean | null
          tests_offered?: string[] | null
          tests_offered_other?: string | null
          type?: string
          verified?: boolean
        }
        Update: {
          address?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          operating_hours?: string | null
          phone?: string | null
          registered_by_clinic_id?: string | null
          suspended?: boolean | null
          tests_offered?: string[] | null
          tests_offered_other?: string | null
          type?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "labs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labs_registered_by_clinic_id_fkey"
            columns: ["registered_by_clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          message_body: string
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_body: string
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_body?: string
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      note_templates: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean
          is_system: boolean | null
          name: string
          sections: Json
          template_type: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_system?: boolean | null
          name: string
          sections?: Json
          template_type?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_system?: boolean | null
          name?: string
          sections?: Json
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          is_cleared: boolean | null
          is_read: boolean | null
          message: string
          patient_id: string | null
          type: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_cleared?: boolean | null
          is_read?: boolean | null
          message: string
          patient_id?: string | null
          type: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          is_cleared?: boolean | null
          is_read?: boolean | null
          message?: string
          patient_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          category: string | null
          clinic_id: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          patient_id: string | null
          uploaded_by: string | null
          uploaded_by_patient: boolean | null
          visit_id: string | null
        }
        Insert: {
          category?: string | null
          clinic_id?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          patient_id?: string | null
          uploaded_by?: string | null
          uploaded_by_patient?: boolean | null
          visit_id?: string | null
        }
        Update: {
          category?: string | null
          clinic_id?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          patient_id?: string | null
          uploaded_by?: string | null
          uploaded_by_patient?: boolean | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_form_tokens: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          patient_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          patient_id?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          patient_id?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_form_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_form_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_idle_log: {
        Row: {
          clinic_id: string | null
          id: string
          idle_ended_at: string | null
          idle_minutes: number | null
          idle_started_at: string | null
          notified: boolean | null
          notified_at: string | null
          patient_id: string | null
          treatment_plan_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          id?: string
          idle_ended_at?: string | null
          idle_minutes?: number | null
          idle_started_at?: string | null
          notified?: boolean | null
          notified_at?: string | null
          patient_id?: string | null
          treatment_plan_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          id?: string
          idle_ended_at?: string | null
          idle_minutes?: number | null
          idle_started_at?: string | null
          notified?: boolean | null
          notified_at?: string | null
          patient_id?: string | null
          treatment_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_idle_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_idle_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_idle_log_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          alcohol: string | null
          allergies: Json | null
          assigned_to: string | null
          blood_group: string | null
          call_due_date: string | null
          chronic_conditions: Json | null
          clinic_id: string
          convenient_time: string | null
          created_at: string | null
          dinner_time: string | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          first_name: string | null
          food_habits: string | null
          gender: string | null
          healthcare_id: string | null
          id: string
          last_name: string | null
          lead_source: string | null
          lead_status: string | null
          medication_history: string | null
          name: string
          past_surgery_details: string | null
          phone: string | null
          sla_breach_days: number | null
          sleep_hours: number | null
          smoking: string | null
        }
        Insert: {
          address?: string | null
          alcohol?: string | null
          allergies?: Json | null
          assigned_to?: string | null
          blood_group?: string | null
          call_due_date?: string | null
          chronic_conditions?: Json | null
          clinic_id: string
          convenient_time?: string | null
          created_at?: string | null
          dinner_time?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string | null
          food_habits?: string | null
          gender?: string | null
          healthcare_id?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lead_status?: string | null
          medication_history?: string | null
          name: string
          past_surgery_details?: string | null
          phone?: string | null
          sla_breach_days?: number | null
          sleep_hours?: number | null
          smoking?: string | null
        }
        Update: {
          address?: string | null
          alcohol?: string | null
          allergies?: Json | null
          assigned_to?: string | null
          blood_group?: string | null
          call_due_date?: string | null
          chronic_conditions?: Json | null
          clinic_id?: string
          convenient_time?: string | null
          created_at?: string | null
          dinner_time?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string | null
          food_habits?: string | null
          gender?: string | null
          healthcare_id?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lead_status?: string | null
          medication_history?: string | null
          name?: string
          past_surgery_details?: string | null
          phone?: string | null
          sla_breach_days?: number | null
          sleep_hours?: number | null
          smoking?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string | null
          id: string
          invoice_id: string
          notes: string | null
          patient_id: string
          payment_date: string | null
          payment_method: string
          recorded_by: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          patient_id: string
          payment_date?: string | null
          payment_method: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          patient_id?: string
          payment_date?: string | null
          payment_method?: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string | null
          doctor_id: string
          follow_up_date: string | null
          id: string
          investigations: Json | null
          medications: Json | null
          notes: string | null
          pdf_url: string | null
          updated_at: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string | null
          doctor_id: string
          follow_up_date?: string | null
          id?: string
          investigations?: Json | null
          medications?: Json | null
          notes?: string | null
          pdf_url?: string | null
          updated_at?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string | null
          doctor_id?: string
          follow_up_date?: string | null
          id?: string
          investigations?: Json | null
          medications?: Json | null
          notes?: string | null
          pdf_url?: string | null
          updated_at?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_therapist: boolean | null
          lab_id: string | null
          password_set: boolean
          pin_hash: string | null
          role: Database["public"]["Enums"]["app_role"]
          room: string | null
          specialization: string | null
          therapist_color: string | null
          therapist_email: string | null
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_therapist?: boolean | null
          lab_id?: string | null
          password_set?: boolean
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          room?: string | null
          specialization?: string | null
          therapist_color?: string | null
          therapist_email?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_therapist?: boolean | null
          lab_id?: string | null
          password_set?: boolean
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          room?: string | null
          specialization?: string | null
          therapist_color?: string | null
          therapist_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          clinic_id: string | null
          created_at: string | null
          endpoint: string
          id: string
          p256dh_key: string
          profile_id: string | null
          user_agent: string | null
        }
        Insert: {
          auth_key: string
          clinic_id?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh_key: string
          profile_id?: string | null
          user_agent?: string | null
        }
        Update: {
          auth_key?: string
          clinic_id?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh_key?: string
          profile_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          click_count: number | null
          clinic_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          link_type: string | null
          original_url: string
          short_code: string
        }
        Insert: {
          click_count?: number | null
          clinic_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          link_type?: string | null
          original_url: string
          short_code?: string
        }
        Update: {
          click_count?: number | null
          clinic_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          link_type?: string | null
          original_url?: string
          short_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_links_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      store_items: {
        Row: {
          category: string | null
          clinic_id: string | null
          created_at: string | null
          description: string | null
          gst_percentage: number | null
          id: string
          is_active: boolean | null
          name: string
          sku: string | null
          unit: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          gst_percentage?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          sku?: string | null
          unit?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          gst_percentage?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          sku?: string | null
          unit?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_sessions: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          profile_id: string | null
          token_hash: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          profile_id?: string | null
          token_hash: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          profile_id?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapy_sessions: {
        Row: {
          amount: number | null
          appointment_id: string | null
          clinic_id: string | null
          completed_at: string | null
          created_at: string | null
          elapsed_seconds: number | null
          id: string
          invoice_id: string | null
          patient_id: string | null
          room: string | null
          service_id: string | null
          service_name: string
          session_date: string | null
          session_notes: string | null
          session_number: number | null
          setup_photo_url: string | null
          started_at: string | null
          status: string | null
          therapist_id: string | null
          treatment_plan_id: string | null
          treatment_plan_item_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          appointment_id?: string | null
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          elapsed_seconds?: number | null
          id?: string
          invoice_id?: string | null
          patient_id?: string | null
          room?: string | null
          service_id?: string | null
          service_name: string
          session_date?: string | null
          session_notes?: string | null
          session_number?: number | null
          setup_photo_url?: string | null
          started_at?: string | null
          status?: string | null
          therapist_id?: string | null
          treatment_plan_id?: string | null
          treatment_plan_item_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          appointment_id?: string | null
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          elapsed_seconds?: number | null
          id?: string
          invoice_id?: string | null
          patient_id?: string | null
          room?: string | null
          service_id?: string | null
          service_name?: string
          session_date?: string | null
          session_notes?: string | null
          session_number?: number | null
          setup_photo_url?: string | null
          started_at?: string | null
          status?: string | null
          therapist_id?: string | null
          treatment_plan_id?: string | null
          treatment_plan_item_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapy_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "invoice_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_treatment_plan_item_id_fkey"
            columns: ["treatment_plan_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_list: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          done_at: string | null
          done_by: string | null
          due_date: string | null
          id: string
          is_done: boolean | null
          patient_id: string | null
          priority: string | null
          title: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean | null
          patient_id?: string | null
          priority?: string | null
          title: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean | null
          patient_id?: string | null
          priority?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_list_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_list_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_items: {
        Row: {
          amount_per_session: number | null
          clinic_id: string | null
          created_at: string | null
          id: string
          service_id: string | null
          service_name: string
          sessions_completed: number | null
          sessions_per_visit: number
          sessions_scheduled: number | null
          status: string | null
          total_sessions: number
          treatment_plan_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_per_session?: number | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          service_id?: string | null
          service_name: string
          sessions_completed?: number | null
          sessions_per_visit?: number
          sessions_scheduled?: number | null
          status?: string | null
          total_sessions?: number
          treatment_plan_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_per_session?: number | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          service_id?: string | null
          service_name?: string
          sessions_completed?: number | null
          sessions_per_visit?: number
          sessions_scheduled?: number | null
          status?: string | null
          total_sessions?: number
          treatment_plan_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "invoice_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          appointment_id: string | null
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          id: string
          notes: string | null
          patient_id: string | null
          plan_name: string | null
          start_date: string | null
          status: string | null
          total_plan_value: number | null
          updated_at: string | null
          visit_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          plan_name?: string | null
          start_date?: string | null
          status?: string | null
          total_plan_value?: number | null
          updated_at?: string | null
          visit_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          plan_name?: string | null
          start_date?: string | null
          status?: string | null
          total_plan_value?: number | null
          updated_at?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          captured_at_reception: boolean | null
          chief_complaint: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          doctor_id: string | null
          height_cm: number | null
          id: string
          lifestyle: string | null
          patient_id: string
          status: string | null
          token_number: number
          visit_date: string | null
          vitals: Json | null
          weight_kg: number | null
        }
        Insert: {
          captured_at_reception?: boolean | null
          chief_complaint?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          height_cm?: number | null
          id?: string
          lifestyle?: string | null
          patient_id: string
          status?: string | null
          token_number: number
          visit_date?: string | null
          vitals?: Json | null
          weight_kg?: number | null
        }
        Update: {
          captured_at_reception?: boolean | null
          chief_complaint?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          height_cm?: number | null
          id?: string
          lifestyle?: string | null
          patient_id?: string
          status?: string | null
          token_number?: number
          visit_date?: string | null
          vitals?: Json | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_petty_cash: {
        Args: { p_clinic_id: string; p_delta: number }
        Returns: number
      }
      admin_create_therapist: {
        Args: {
          p_color?: string
          p_email?: string
          p_full_name: string
          p_pin?: string
          p_room?: string
        }
        Returns: string
      }
      admin_set_therapist_pin: {
        Args: { p_pin: string; p_therapist_profile_id: string }
        Returns: boolean
      }
      complete_clinic_onboarding: {
        Args: {
          p_clinic_address?: string
          p_clinic_name: string
          p_clinic_phone?: string
        }
        Returns: string
      }
      complete_patient_form: {
        Args: { p_token: string; p_updates: Json }
        Returns: boolean
      }
      complete_therapy_session: {
        Args: { p_notes?: string; p_session_id: string }
        Returns: Json
      }
      ensure_current_user_profile: {
        Args: never
        Returns: {
          clinic_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_therapist: boolean | null
          lab_id: string | null
          password_set: boolean
          pin_hash: string | null
          role: Database["public"]["Enums"]["app_role"]
          room: string | null
          specialization: string | null
          therapist_color: string | null
          therapist_email: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_all_capacities: {
        Args: { p_clinic_id: string; p_date: string }
        Returns: {
          available: number
          booked_count: number
          is_full: boolean
          max_per_day: number
          pct_full: number
          service_id: string
          service_name: string
        }[]
      }
      get_clinic_id_safe: { Args: never; Returns: string }
      get_idle_patients: {
        Args: { p_clinic_id: string }
        Returns: {
          idle_minutes: number
          patient_id: string
          patient_name: string
          treatment_plan_id: string
        }[]
      }
      get_service_capacity: {
        Args: { p_clinic_id: string; p_date: string; p_service_id: string }
        Returns: {
          available: number
          booked_count: number
          is_full: boolean
          max_per_day: number
          service_id: string
          service_name: string
        }[]
      }
      get_user_clinic_id: { Args: { _user_id: string }; Returns: string }
      get_user_clinic_id_fast: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      schedule_plan_sessions: {
        Args: { p_date: string; p_plan_id: string }
        Returns: number
      }
      seed_default_checklist_items: {
        Args: { p_clinic_id: string }
        Returns: undefined
      }
      seed_default_expense_categories: {
        Args: { p_clinic_id: string }
        Returns: undefined
      }
      seed_default_message_templates: {
        Args: { p_clinic_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_sla_breach_days: { Args: never; Returns: undefined }
      validate_patient_form_token: {
        Args: { p_token: string }
        Returns: string
      }
      verify_therapist_pin: {
        Args: { p_pin: string; p_therapist_profile_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "doctor" | "receptionist" | "lab" | "super_admin"
      lead_source_type:
        | "instagram"
        | "phone"
        | "whatsapp"
        | "yuvalife"
        | "friend"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "doctor", "receptionist", "lab", "super_admin"],
      lead_source_type: [
        "instagram",
        "phone",
        "whatsapp",
        "yuvalife",
        "friend",
      ],
    },
  },
} as const
