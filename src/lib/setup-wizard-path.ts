const SETUP_WIZARD_PREFIX = "/dashboard/start";

/**
 * Страницы кабинета, доступные до создания первого проекта: оплата, настройки
 * аккаунта, поддержка, партнёрка и активация таблички. Без них мастер
 * превращается в тупик — например, из upsell-экрана микросайта нельзя дойти
 * до тарифов.
 */
const SETUP_REDIRECT_EXEMPT_PREFIXES = [
  "/dashboard/subscription",
  "/dashboard/settings",
  "/dashboard/support",
  "/dashboard/partner",
  "/dashboard/activate",
];

/** Пользователь сам ушёл из мастера в кабинет — не возвращаем его до конца сессии. */
export const SETUP_GUIDE_DISMISS_KEY = "qrstars.setupGuideDismissed";

/** Страница мастера «первый запуск» / повторная настройка QR — без авто-тура по меню. */
export function isSetupWizardPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === SETUP_WIZARD_PREFIX || pathname.startsWith(`${SETUP_WIZARD_PREFIX}/`);
}

/** Страница, с которой не нужно уводить в мастер, даже если проектов ещё нет. */
export function isSetupRedirectExemptPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (isSetupWizardPath(pathname)) return true;
  return SETUP_REDIRECT_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
