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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          doctor_id: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          patient_id: string | null
          reason: string | null
          status: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          reason?: string | null
          status?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          reason?: string | null
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
          id: string
          language_detected: string | null
          raw_transcript: string | null
          soap_notes: Json | null
          updated_at: string | null
          visit_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          doctor_id: string
          id?: string
          language_detected?: string | null
          raw_transcript?: string | null
          soap_notes?: Json | null
          updated_at?: string | null
          visit_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          doctor_id?: string
          id?: string
          language_detected?: string | null
          raw_transcript?: string | null
          soap_notes?: Json | null
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
          id: string
          letterhead_url: string | null
          logo_url: string | null
          name: string
          onboarding_complete: boolean | null
          phone: string | null
          prescription_template: string | null
          regional_language: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          letterhead_url?: string | null
          logo_url?: string | null
          name: string
          onboarding_complete?: boolean | null
          phone?: string | null
          prescription_template?: string | null
          regional_language?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          letterhead_url?: string | null
          logo_url?: string | null
          name?: string
          onboarding_complete?: boolean | null
          phone?: string | null
          prescription_template?: string | null
          regional_language?: string | null
        }
        Relationships: []
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
      note_templates: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          sections: Json
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          sections?: Json
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          sections?: Json
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
      patient_documents: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          patient_id: string | null
          uploaded_by: string
          visit_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          patient_id?: string | null
          uploaded_by: string
          visit_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          patient_id?: string | null
          uploaded_by?: string
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
            foreignKeyName: "patient_documents_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          allergies: Json | null
          blood_group: string | null
          chronic_conditions: Json | null
          clinic_id: string
          created_at: string | null
          dob: string | null
          email: string | null
          first_name: string | null
          gender: string | null
          healthcare_id: string | null
          id: string
          last_name: string | null
          name: string
          phone: string | null
        }
        Insert: {
          allergies?: Json | null
          blood_group?: string | null
          chronic_conditions?: Json | null
          clinic_id: string
          created_at?: string | null
          dob?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          healthcare_id?: string | null
          id?: string
          last_name?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          allergies?: Json | null
          blood_group?: string | null
          chronic_conditions?: Json | null
          clinic_id?: string
          created_at?: string | null
          dob?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          healthcare_id?: string | null
          id?: string
          last_name?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          lab_id: string | null
          password_set: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          lab_id?: string | null
          password_set?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          lab_id?: string | null
          password_set?: boolean
          role?: Database["public"]["Enums"]["app_role"]
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
          chief_complaint: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          doctor_id: string | null
          id: string
          patient_id: string
          status: string | null
          token_number: number
          visit_date: string | null
          vitals: Json | null
        }
        Insert: {
          chief_complaint?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          patient_id: string
          status?: string | null
          token_number: number
          visit_date?: string | null
          vitals?: Json | null
        }
        Update: {
          chief_complaint?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          patient_id?: string
          status?: string | null
          token_number?: number
          visit_date?: string | null
          vitals?: Json | null
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
      complete_clinic_onboarding: {
        Args: {
          p_clinic_address?: string
          p_clinic_name: string
          p_clinic_phone?: string
        }
        Returns: string
      }
      get_user_clinic_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "doctor" | "receptionist" | "lab" | "super_admin"
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
    },
  },
} as const
