// Feature flags — flip these when ready to upgrade infrastructure.
// No code changes needed when scaling — just change env vars.

export const features = {
  asyncAI: import.meta.env.VITE_FEATURE_ASYNC_AI === "true",
  redisCache: import.meta.env.VITE_FEATURE_REDIS_CACHE === "true",
  r2Storage: import.meta.env.VITE_FEATURE_R2_STORAGE === "true",
  analytics: import.meta.env.VITE_FEATURE_ANALYTICS !== "false",
  debug: import.meta.env.VITE_DEBUG === "true",
};