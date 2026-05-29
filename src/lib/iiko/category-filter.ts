/** Стабильный ключ категории iiko (id из API или fallback по имени). */
export function iikoCategoryKey(cat: { id?: string | null; name?: string | null }): string {
  const id = cat.id?.trim();
  if (id) return id;
  const name = cat.name?.trim() || "Прочее";
  return `name:${name.toLowerCase()}`;
}

export function parseIikoHiddenCategoryIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

/** Убрать из blacklist id категорий, которых больше нет в меню iiko. */
export function pruneIikoHiddenCategoryIds(
  hidden: string[],
  knownCategoryIds: string[]
): string[] {
  const known = new Set(knownCategoryIds);
  return hidden.filter((id) => known.has(id));
}

export function hashHiddenCategoryIds(hidden: string[]): string {
  if (hidden.length === 0) return "all";
  return [...hidden].sort().join("|");
}
