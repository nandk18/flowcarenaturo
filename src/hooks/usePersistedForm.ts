import { useCallback, useEffect, useRef, useState } from "react";
import { FORM_KEY_PREFIX } from "@/lib/persistedState";

function storageKey(formKey: string) {
  return `${FORM_KEY_PREFIX}${formKey}`;
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * Generic localStorage-backed form state.
 * - values: current values (restored from storage if present)
 * - updateField(field, value): patch one field and persist
 * - setValues(next): replace and persist
 * - clearSaved(): wipe storage and reset to defaults
 * - hasSaved: whether the loaded values differ from defaults (i.e. a draft exists)
 */
export function usePersistedForm<T extends Record<string, any>>(
  formKey: string,
  defaultValues: T,
  options: { enabled?: boolean } = {}
) {
  const enabled = options.enabled !== false;
  const key = storageKey(formKey);
  const defaultsRef = useRef(defaultValues);

  const [values, setValuesState] = useState<T>(() => {
    if (!enabled) return defaultValues;
    return safeRead<T>(key, defaultValues);
  });

  const [hasSaved, setHasSaved] = useState<boolean>(() => {
    if (!enabled) return false;
    try {
      const raw = localStorage.getItem(key);
      return !!raw && raw !== JSON.stringify(defaultValues);
    } catch {
      return false;
    }
  });

  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValuesState((prev) => {
        const next = { ...prev, [field]: value };
        if (enabled) safeWrite(key, next);
        return next;
      });
    },
    [key, enabled]
  );

  const setValues = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValuesState((prev) => {
        const resolved = typeof next === "function" ? (next as any)(prev) : next;
        if (enabled) safeWrite(key, resolved);
        return resolved;
      });
    },
    [key, enabled]
  );

  const clearSaved = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    setValuesState(defaultsRef.current);
    setHasSaved(false);
  }, [key]);

  const dismissBanner = useCallback(() => setHasSaved(false), []);

  // Keep latest defaults reference fresh (for re-mounts with new identity).
  useEffect(() => {
    defaultsRef.current = defaultValues;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { values, updateField, setValues, clearSaved, hasSaved, dismissBanner };
}

/** Simple imperative helpers for one-off form drafts. */
export const formStorage = {
  read<T>(formKey: string, fallback: T): T {
    return safeRead(storageKey(formKey), fallback);
  },
  write(formKey: string, value: unknown) {
    safeWrite(storageKey(formKey), value);
  },
  clear(formKey: string) {
    try {
      localStorage.removeItem(storageKey(formKey));
    } catch {
      // ignore
    }
  },
};
