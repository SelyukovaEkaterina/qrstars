export const QRSTARS_PRIVACY_URL =
  "https://qrstars.ru/politika-konfidencialnosti.html";

export interface PdConsent {
  ready: boolean;
  policyUrl: string;
}

/** Ссылка для чекбокса согласия: политика заведения, иначе платформенная. */
export function guestPdPolicyUrl(pdConsent?: PdConsent | null): string {
  if (pdConsent?.ready && pdConsent.policyUrl) return pdConsent.policyUrl;
  return QRSTARS_PRIVACY_URL;
}

export const LEGAL_REQUISITES_HINT =
  "Необязательно. Заполните оба поля, если хотите, чтобы юридическое наименование и ИНН показывались в политике на странице гостя. Формы жалобы, заявки и заказа с телефоном и email работают и без реквизитов.";

export const LEGAL_REQUISITES_READY =
  "Политика заведения опубликована — гости увидят ваши реквизиты в ссылке на обработку персональных данных.";

export const LEGAL_REQUISITES_INCOMPLETE =
  "Заполните оба поля, чтобы реквизиты появились в политике на странице гостя.";
