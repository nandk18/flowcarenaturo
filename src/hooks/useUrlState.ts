import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-backed state. Reads/writes a single query param.
 * When the value equals the default, the param is removed for a clean URL.
 */
export function useUrlState(
  param: string,
  defaultValue: string
): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(param) ?? defaultValue;

  const setValue = useCallback(
    (newValue: string) => {
      setSearchParams(
        (prev) => {
          if (!newValue || newValue === defaultValue) {
            prev.delete(param);
          } else {
            prev.set(param, newValue);
          }
          return prev;
        },
        { replace: true }
      );
    },
    [param, defaultValue, setSearchParams]
  );

  return [value, setValue];
}

/** Numeric variant. */
export function useUrlNumberState(
  param: string,
  defaultValue: number
): [number, (value: number) => void] {
  const [raw, setRaw] = useUrlState(param, String(defaultValue));
  const num = Number(raw);
  const value = Number.isFinite(num) ? num : defaultValue;
  return [value, (v: number) => setRaw(String(v))];
}
