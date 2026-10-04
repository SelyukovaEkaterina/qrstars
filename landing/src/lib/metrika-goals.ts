/** Yandex.Metrika reachGoal identifiers — must match goals in counter 109307713 */
export const METRIKA_GOALS = {
  navLogin: 'nav_login',
  navRegister: 'nav_register',
  heroStart: 'hero_start',
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
  qrDynamicCta: 'qr_dynamic_cta',
  tableOrderAttempt: 'table_order_attempt',
} as const;

/** Page pathname → goal fired once on load */
export const METRIKA_PAGE_GOALS: Record<string, string> = {
  '/free-qr-generator.html': METRIKA_GOALS.qrPageVisit,
  '/qr-kod-dlya-video.html': METRIKA_GOALS.qrPageVisit,
};
