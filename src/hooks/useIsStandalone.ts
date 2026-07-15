import { useEffect, useState } from "react";

/** True when the app is running as an installed PWA (standalone display). */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const mql = window.matchMedia?.("(display-mode: standalone)");
    const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
    return !!(mql?.matches || iosStandalone);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(display-mode: standalone)");
    const handler = () => setStandalone(mql.matches);
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  return standalone;
}
