import { useEffect } from "react";

/**
 * Warns the user on browser unload (refresh / close / external navigation)
 * when there are unsaved changes. In-app navigation does NOT trigger this —
 * but draft state is auto-persisted to localStorage via usePersistedForm,
 * so the user can resume on return.
 */
export function useUnsavedChangesPrompt(when: boolean) {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);
}
