const SETUP_WIZARD_PREFIX = "/dashboard/start";

/** Страница мастера «первый запуск» / повторная настройка QR — без авто-тура по меню. */
export function isSetupWizardPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === SETUP_WIZARD_PREFIX || pathname.startsWith(`${SETUP_WIZARD_PREFIX}/`);
}
