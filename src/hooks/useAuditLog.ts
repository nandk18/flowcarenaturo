import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const AUDIT_ACTIONS = {
  LOGIN: "login",
  LOGOUT: "logout",
  PATIENT_VIEWED: "patient_viewed",
  PATIENT_CREATED: "patient_created",
  PATIENT_UPDATED: "patient_updated",
  PATIENT_DELETED: "patient_deleted",
  CONSULTATION_OPENED: "consultation_opened",
  NOTES_SAVED: "notes_saved",
  PRESCRIPTION_GENERATED: "prescription_generated",
  PRESCRIPTION_SHARED: "prescription_shared",
  LAB_ORDER_CREATED: "lab_order_created",
  LAB_ORDER_CANCELLED: "lab_order_cancelled",
  LAB_RESULT_VIEWED: "lab_result_viewed",
  LAB_RESULT_ACTIONED: "lab_result_actioned",
  STAFF_INVITED: "staff_invited",
  STAFF_REMOVED: "staff_removed",
  SETTINGS_UPDATED: "settings_updated",
} as const;

export function useAuditLog() {
  const { user, profile } = useAuth();

  const log = async (
    action: string,
    resourceType?: string,
    resourceId?: string | null,
    resourceName?: string | null,
    metadata?: Record<string, any>
  ) => {
    if (!user || !profile?.clinic_id) return;
    try {
      await supabase.from("audit_logs" as any).insert({
        clinic_id: profile.clinic_id,
        user_id: user.id,
        user_name: profile.full_name || user.email,
        user_role: profile.role,
        action,
        resource_type: resourceType ?? null,
        resource_id: resourceId ?? null,
        resource_name: resourceName ?? null,
        metadata: metadata || {},
      });
    } catch {
      // Silently fail — never block user action for audit log
    }
  };

  return { log };
}