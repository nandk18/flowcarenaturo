import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { saveLastPage } from "@/lib/persistedState";

/** Persists the current URL (pathname + search) on every route change. */
export function useLastPageTracker() {
  const location = useLocation();
  useEffect(() => {
    saveLastPage(location.pathname + location.search);
  }, [location.pathname, location.search]);
}
