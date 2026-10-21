/** Yandex.Metrika reachGoal identifiers — must match goals in counter 109307713 */
export const METRIKA_GOALS = {
  navLogin: 'nav_login',
  navRegister: 'nav_register',
  heroStart: 'hero_start',
  stickyStart: 'sticky_start',
  howtoRegister: 'howto_register',
  pricingFree: 'pricing_free',
  pricingPro: 'pricing_pro',
  pricingNetwork: 'pricing_network',
  bottomCta: 'bottom_cta',
  demoOpen: 'demo_open',
  demoVertical: 'demo_vertical',
  qrPageVisit: 'qr_page_visit',
  qrGenerate: 'qr_generate',
  qrGeneratorLink: 'qr_generator_link',
  qrDownloadPng: 'qr_download_png',
  qrDownloadJpg: 'qr_download_jpg',
  qrDownloadSvg: 'qr_download_svg',
  /** Генератор: смена типа данных (ссылка, Telegram, оплата…). */
  qrTypeChange: 'qr_type_change',
  qrLogoUpload: 'qr_logo_upload',
  qrPhotoUpload: 'qr_photo_upload',
  /** Проверка jsQR предупредила, что код может плохо сканироваться. */
  qrScanWarning: 'qr_scan_warning',
  qrRandom: 'qr_random',
  qrFullscreen: 'qr_fullscreen',
  qrMockup: 'qr_mockup',
  /** Клик на регистрацию с переносом дизайна из генератора (`?qr_style=`). */
  qrStyleTransfer: 'qr_style_transfer',
  qrDynamicCta: 'qr_dynamic_cta',
  tableOrderAttempt: 'table_order_attempt',
} as const;

/** Page pathname → goal fired once on load */
export const METRIKA_PAGE_GOALS: Record<string, string> = {
  '/free-qr-generator.html': METRIKA_GOALS.qrPageVisit,
  '/qr-kod-dlya-video.html': METRIKA_GOALS.qrPageVisit,
};
