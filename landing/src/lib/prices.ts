/**
 * Цены тарифов для текстов лендинга — из `src/lib/plans.ts` (единственный источник).
 * Поменяли тариф там — лендинг подхватит при следующей сборке.
 */
import { PLAN_PRICING, PRO_YEARLY_SAVINGS_PERCENT, formatRub } from '../../../src/lib/plans';

export const PRO_HALFYEAR = formatRub(PLAN_PRICING.PRO.halfYearRub);
export const PRO_YEARLY = formatRub(PLAN_PRICING.PRO.yearlyRub);
export const PRO_SAVINGS = `${PRO_YEARLY_SAVINGS_PERCENT}%`;
export const NETWORK_YEARLY = formatRub(PLAN_PRICING.NETWORK.yearlyRub);
export const NETWORK_MONTHLY = formatRub(PLAN_PRICING.NETWORK.monthlyRub);
export const NETWORK_INCLUDED = PLAN_PRICING.NETWORK.includedEstablishments;
/** Числа без «₽» — для крупных цифр в карточках тарифов. */
export const PRO_HALFYEAR_NUM = PLAN_PRICING.PRO.halfYearRub.toLocaleString('ru-RU');
export const NETWORK_YEARLY_NUM = PLAN_PRICING.NETWORK.yearlyRub.toLocaleString('ru-RU');
