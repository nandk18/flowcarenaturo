export const FORM_KEY_PREFIX = "flowcare_form_";
export const LAST_PAGE_KEY = "flowcare_last_page";
export const QUERY_CACHE_KEY = "flowcare_query_cache";

export const PUBLIC_ROUTE_PREFIXES = [
  "/auth",
  "/login",
  "/signup",
  "/accept-invite",
  "/reset-password",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/dpa",
  "/security",
  "/invoice/",
  "/rx/",
  "/patient-form/",
];

export function isPublicPath(path: string | null | undefined): boolean {
  if (!path) return true;
  if (path === "/") return true;
  return PUBLIC_ROUTE_PREFIXES.some((p) =>
    p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(p + "/") || path === p
  );
}

export function clearAllPersistedState() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("flowcare_")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function saveLastPage(pathWithSearch: string) {
  try {
    if (isPublicPath(pathWithSearch.split("?")[0])) return;
    localStorage.setItem(LAST_PAGE_KEY, pathWithSearch);
  } catch {
    // ignore
  }
}

export function readLastPage(): string | null {
  try {
    const v = localStorage.getItem(LAST_PAGE_KEY);
    if (!v) return null;
    if (isPublicPath(v.split("?")[0])) return null;
    return v;
  } catch {
    return null;
  }
}
