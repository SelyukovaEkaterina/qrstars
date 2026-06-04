/** Фильтр «Без заведения» в сводке и аналитике (client-safe, без Prisma). */

export const ORPHAN_ESTABLISHMENT_FILTER = "__none__";

export const ORPHAN_ESTABLISHMENT_LABEL = "Без заведения";

export function isOrphanEstablishmentFilter(
  id: string | null | undefined
): boolean {
  return id === ORPHAN_ESTABLISHMENT_FILTER;
}
