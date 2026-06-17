export const normalizeAlcohol = (val: any): string | null => {
  if (!val) return null;
  const v = String(val).toLowerCase().trim();
  if (["none", "never", "no"].includes(v)) return "none";
  if (["occasional", "sometimes"].includes(v)) return "occasional";
  if (["regular", "yes"].includes(v)) return "regular";
  return null;
};

export const normalizeSmoking = (val: any): string | null => {
  if (!val) return null;
  const v = String(val).toLowerCase().trim();
  if (["non_smoker", "never", "no", "none", "non-smoker"].includes(v)) return "non_smoker";
  if (["occasional", "sometimes"].includes(v)) return "occasional";
  if (["regular", "yes"].includes(v)) return "regular";
  return null;
};

export const normalizeFoodHabits = (val: any): string | null => {
  if (!val) return null;
  const v = String(val).toLowerCase().trim().replace(/[- ]/g, "_");
  if (v.includes("vegan")) return "vegan";
  if (v.includes("egg")) return "eggetarian";
  if (v.includes("non")) return "non_vegetarian";
  if (v.includes("veg")) return "vegetarian";
  return null;
};
