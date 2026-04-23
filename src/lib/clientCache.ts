// In-memory cache with TTL — no Redis needed, runs in browser.
// Shared across all components via module-level Map.

interface CacheEntry {
  data: any;
  expires: number;
}

const store = new Map<string, CacheEntry>();

export const clientCache = {
  get<T = any>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  },

  set(key: string, data: any, ttlSeconds: number): void {
    store.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
  },

  delete(key: string): void {
    store.delete(key);
  },

  deletePattern(pattern: string): void {
    for (const key of store.keys()) {
      if (key.includes(pattern)) store.delete(key);
    }
  },

  clear(): void {
    store.clear();
  },
};

export const CACHE_KEYS = {
  clinicSettings: (id: string) => `clinic:${id}:settings`,
  clinicDoctors: (id: string) => `clinic:${id}:doctors`,
  clinicTemplates: (id: string) => `clinic:${id}:templates`,
  patientHistory: (id: string) => `patient:${id}:history`,
  analyticsMonth: (id: string) => `analytics:${id}:month`,
  labsForClinic: (id: string) => `clinic:${id}:labs`,
};

export const CACHE_TTL = {
  clinicSettings: 3600,
  doctors: 1800,
  templates: 1800,
  patientHistory: 300,
  analytics: 900,
  labs: 600,
};