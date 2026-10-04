/** Реквизиты оператора персональных данных (сайт qrstars.ru) */
export const OPERATOR = {
  name: 'ИП Красников Иван Геннадьевич',
  fullName: 'Индивидуальный предприниматель Красников Иван Геннадьевич',
  inn: '540536312882',
  site: 'https://qrstars.ru',
  email: 'support@qrstars.ru',
} as const;

export const LEGAL_LINKS = {
  privacy: '/politika-konfidencialnosti.html',
  consent: '/soglasie-pd.html',
  cookie: '/politika-konfidencialnosti.html#cookie',
  offer: '/publichnaya-oferta.html',
  terms: '/polzovatelskoe-soglashenie.html',
  payment: '/usloviya-oplaty-i-vozvrata.html',
  unsubscribe: 'https://app.qrstars.ru/dashboard/subscription',
} as const;

/** Версия оферты для журнала согласий в приложении */
export const OFFER_VERSION = '2026-06-16';
export const OFFER_URL = 'https://qrstars.ru/publichnaya-oferta.html';

/** API предрегистрации (приложение QrStars) */
export const PREREG_API_URL = 'https://app.qrstars.ru/api/waitlist';
