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
  /** Клик по арт-стилю в один клик (`preset` — id стиля). */
  qrArtPreset: 'qr_art_preset',
  /** Фильтр арт-стилей по аудитории (`category`). */
  qrArtCategory: 'qr_art_category',
  /** Главная: клик по картинке в галерее красивых QR (`preset` — id стиля). */
  qrGalleryClick: 'qr_gallery_click',
  qrFullscreen: 'qr_fullscreen',
  qrMockup: 'qr_mockup',
  /** Клик на регистрацию с переносом дизайна из генератора (`?qr_style=`). */
  qrStyleTransfer: 'qr_style_transfer',
  qrDynamicCta: 'qr_dynamic_cta',
  /** Генератор: открыли пример анимированного QR (`animation` — id). */
  qrAnimationOpen: 'qr_animation_open',
  /** Клик «Сделать анимированный QR» → регистрация с plan=pro. */
  qrAnimationProCta: 'qr_animation_pro_cta',
  /** SEO-блок «Анимированный QR» → «Примерить на своём оформлении» (генератор с `?anim=1`). */
  qrAnimationTry: 'qr_animation_try',
  /** Страница «QR для 3D-печати»: визит. */
  qrStlVisit: 'qr_stl_visit',
  /** «Динамический QR · PRO» → регистрация с plan=pro (`source`: after_download | steps). */
  qrStlProCta: 'qr_stl_pro_cta',
  /** Бесплатно скачали STL со своей ссылкой (`format`: stl | zip). */
  qrStlFreeDownload: 'qr_stl_free_download',
  /** Генератор: «Посмотреть 3D-модель моего кода». */
  qrStlGeneratorLink: 'qr_stl_generator_link',
  tableOrderAttempt: 'table_order_attempt',
  /** Конструктор визиток: визит страницы. */
  cardMakerVisit: 'card_maker_visit',
  /** Конструктор визиток: выбор шаблона (`template`). */
  cardTemplate: 'card_template',
  /** Конструктор визиток: скачивание (`format`: pdf | a4 | png, `template`, `qr`, `qrType`). */
  cardDownload: 'card_download',
  /** Конструктор визиток: переход к онлайн-визитке в кабинете (`source`). */
  cardOnlineCta: 'card_online_cta',
} as const;

/** Page pathname → goal fired once on load */
export const METRIKA_PAGE_GOALS: Record<string, string> = {
  '/free-qr-generator.html': METRIKA_GOALS.qrPageVisit,
  '/qr-kod-dlya-video.html': METRIKA_GOALS.qrPageVisit,
};
