/** Что зашивается в статический QR: построение строки и проверка полей формы генератора. */

export type QrType =
  | 'url'
  | 'wifi'
  | 'text'
  | 'email'
  | 'phone'
  | 'vcard'
  | 'sms'
  | 'telegram'
  | 'whatsapp'
  | 'pay'
  | 'maps';

export const QR_TYPES: readonly QrType[] = [
  'url', 'wifi', 'text', 'email', 'phone', 'vcard', 'sms', 'telegram', 'whatsapp', 'pay', 'maps',
];

export type PayloadResult =
  /** Поля пустые — показываем заглушку без ошибки. */
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; payload: string; hint?: string };

/** Значение поля формы по id (`input-url`, `input-pay-bic`…). */
export type FieldReader = (id: string) => string;

const ok = (payload: string, hint?: string): PayloadResult => ({ kind: 'ok', payload, hint });
const err = (message: string): PayloadResult => ({ kind: 'error', message });
const EMPTY: PayloadResult = { kind: 'empty' };

export function escapeWifiField(val: string): string {
  return val.replace(/([\\;,:"'])/g, '\\$1');
}

/** Экранирование текстовых значений vCard 3.0 (RFC 2426): `\`, `,`, `;`, перевод строки. */
export function escapeVcard(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r?\n/g, '\\n');
}

const DOMAIN_LIKE = /^[\p{L}\d][\p{L}\d-]*(\.[\p{L}\d-]+)*\.[\p{L}]{2,}([/:?#].*)?$/u;

/**
 * Ссылка без `https://` (`qrstars.ru`) часть камер показывает как текст, а не как ссылку.
 * Дописываем протокол сами и сообщаем об этом.
 */
export function normalizeUrl(raw: string): PayloadResult {
  const v = raw.trim();
  if (!v) return EMPTY;
  if (/\s/.test(v)) return err('В ссылке есть пробелы — проверьте адрес.');
  let candidate = v;
  let hint: string | undefined;
  if (!/^[a-z][a-z\d+.-]*:/i.test(v)) {
    if (!DOMAIN_LIKE.test(v)) return err('Это не похоже на адрес сайта. Пример: https://example.com');
    candidate = `https://${v.replace(/^\/+/, '')}`;
    hint = 'Добавили https:// — без него часть телефонов откроет код как обычный текст.';
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return err('Проверьте адрес ссылки. Пример: https://example.com');
  }
  if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.hostname.includes('.')) {
    return err('В адресе не хватает домена. Пример: https://example.com');
  }
  return ok(candidate, hint);
}

/** Российский номер: 8XXXXXXXXXX → 7XXXXXXXXXX, только цифры. */
export function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('9')) digits = `7${digits}`;
  return digits;
}

function phonePayload(raw: string, scheme: 'tel'): PayloadResult {
  const v = raw.trim();
  if (!v) return EMPTY;
  const plus = v.startsWith('+');
  const digits = v.replace(/\D/g, '');
  if (digits.length < 5 || digits.length > 15) return err('Проверьте номер телефона.');
  return ok(`${scheme}:${plus ? '+' : ''}${digits}`);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Убираем символы, ломающие формат ГОСТ Р 56042 (`|` — разделитель полей). */
function payField(val: string): string {
  return val.replace(/[|\r\n]/g, ' ').trim();
}

function buildPayment(get: FieldReader): PayloadResult {
  const name = payField(get('input-pay-name'));
  const acc = get('input-pay-acc').replace(/\s/g, '');
  const bank = payField(get('input-pay-bank'));
  const bic = get('input-pay-bic').replace(/\s/g, '');
  const corr = get('input-pay-corr').replace(/\s/g, '');
  const inn = get('input-pay-inn').replace(/\s/g, '');
  const purpose = payField(get('input-pay-purpose'));
  const sumRaw = get('input-pay-sum').replace(/\s/g, '').replace(',', '.');
  if (![name, acc, bank, bic, corr, inn, purpose, sumRaw].some(Boolean)) return EMPTY;
  if (!name) return err('Укажите получателя — ИП или организацию.');
  if (!/^\d{20}$/.test(acc)) return err('Расчётный счёт — 20 цифр.');
  if (!bank) return err('Укажите название банка.');
  if (!/^\d{9}$/.test(bic)) return err('БИК — 9 цифр.');
  if (!/^\d{20}$/.test(corr)) return err('Корреспондентский счёт — 20 цифр.');
  if (inn && !/^(\d{10}|\d{12})$/.test(inn)) return err('ИНН — 10 или 12 цифр.');
  let sumKop: number | null = null;
  if (sumRaw) {
    const rub = Number(sumRaw);
    if (!Number.isFinite(rub) || rub <= 0) return err('Сумма — число больше нуля, например 1500 или 990.50.');
    sumKop = Math.round(rub * 100);
  }
  // ST00012: версия 0001, кодировка 2 = UTF-8 (ГОСТ Р 56042-2014).
  const fields = [
    'ST00012',
    `Name=${name}`,
    `PersonalAcc=${acc}`,
    `BankName=${bank}`,
    `BIC=${bic}`,
    `CorrespAcc=${corr}`,
  ];
  if (inn) fields.push(`PayeeINN=${inn}`);
  if (purpose) fields.push(`Purpose=${purpose}`);
  if (sumKop !== null) fields.push(`Sum=${sumKop}`);
  return ok(fields.join('|'));
}

function buildTelegram(raw: string): PayloadResult {
  const v = raw.trim();
  if (!v) return EMPTY;
  const link = v.match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(.+)$/i);
  if (link) {
    const path = link[1].replace(/\/+$/, '');
    if (!/^(\+|joinchat\/)?[\w-]{3,64}(\/\d+)?$/.test(path)) return err('Проверьте ссылку на Telegram.');
    return ok(`https://t.me/${path}`);
  }
  const username = v.replace(/^@/, '');
  if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(username)) {
    return err('Укажите @username (латиница, от 4 символов) или ссылку t.me/…');
  }
  return ok(`https://t.me/${username}`);
}

function buildWhatsapp(phoneRaw: string, text: string): PayloadResult {
  if (!phoneRaw.trim()) return EMPTY;
  const digits = normalizePhoneDigits(phoneRaw);
  if (digits.length < 10 || digits.length > 15) return err('Номер WhatsApp в международном формате: +7 999 123-45-67.');
  const msg = text.trim();
  return ok(`https://wa.me/${digits}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`);
}

export type MapsPlatform = 'yandex' | '2gis';

export function detectMapsPlatform(url: URL): MapsPlatform | null {
  const host = url.hostname.replace(/^www\./, '');
  if (/^yandex\.(ru|com|by|kz|uz|com\.tr)$/.test(host) && url.pathname.startsWith('/maps')) return 'yandex';
  if (host === 'ya.ru' && url.pathname.startsWith('/maps')) return 'yandex';
  if (/^(2gis\.(ru|com|kz|kg|uz|ae)|go\.2gis\.com)$/.test(host)) return '2gis';
  return null;
}

function buildMaps(raw: string): PayloadResult {
  const res = normalizeUrl(raw);
  if (res.kind !== 'ok') return res;
  let url: URL;
  try {
    url = new URL(res.payload);
  } catch {
    return err('Проверьте ссылку на карточку.');
  }
  if (!detectMapsPlatform(url)) return err('Вставьте ссылку на карточку заведения в Яндекс Картах или 2ГИС.');
  return ok(res.payload, res.hint);
}

export function buildPayload(type: QrType, get: FieldReader): PayloadResult {
  switch (type) {
    case 'url':
      return normalizeUrl(get('input-url'));
    case 'wifi': {
      const ssid = get('input-wifi-ssid').trim();
      const pass = get('input-wifi-pass').trim();
      const enc = get('input-wifi-enc');
      if (!ssid) return EMPTY;
      return ok(`WIFI:T:${enc};S:${escapeWifiField(ssid)};P:${escapeWifiField(pass)};;`);
    }
    case 'text': {
      const v = get('input-text').trim();
      return v ? ok(v) : EMPTY;
    }
    case 'email': {
      const addr = get('input-email-addr').trim();
      if (!addr) return EMPTY;
      if (!EMAIL_RE.test(addr)) return err('Проверьте email-адрес.');
      const subj = get('input-email-subj').trim();
      const body = get('input-email-body').trim();
      const params: string[] = [];
      if (subj) params.push(`subject=${encodeURIComponent(subj)}`);
      if (body) params.push(`body=${encodeURIComponent(body)}`);
      return ok(`mailto:${addr}${params.length ? `?${params.join('&')}` : ''}`);
    }
    case 'phone':
      return phonePayload(get('input-phone'), 'tel');
    case 'vcard': {
      const fname = get('input-vcard-fname').trim();
      const lname = get('input-vcard-lname').trim();
      if (!fname && !lname) return EMPTY;
      const phone = get('input-vcard-phone').trim();
      const email = get('input-vcard-email').trim();
      const org = get('input-vcard-org').trim();
      const url = get('input-vcard-url').trim();
      if (email && !EMAIL_RE.test(email)) return err('Проверьте email в контакте.');
      const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      lines.push(`N:${escapeVcard(lname)};${escapeVcard(fname)};;;`);
      lines.push(`FN:${escapeVcard([fname, lname].filter(Boolean).join(' '))}`);
      if (org) lines.push(`ORG:${escapeVcard(org)}`);
      if (phone) lines.push(`TEL;TYPE=CELL:${phone.replace(/[^\d+]/g, '')}`);
      if (email) lines.push(`EMAIL:${email}`);
      if (url) {
        const u = normalizeUrl(url);
        if (u.kind === 'error') return err(`Сайт в контакте: ${u.message}`);
        if (u.kind === 'ok') lines.push(`URL:${u.payload}`);
      }
      lines.push('END:VCARD');
      return ok(lines.join('\n'));
    }
    case 'sms': {
      const phone = get('input-sms-phone').trim();
      if (!phone) return EMPTY;
      const body = get('input-sms-body').trim();
      const digits = phone.replace(/[^\d+]/g, '');
      if (digits.replace('+', '').length < 5) return err('Проверьте номер получателя.');
      return ok(body ? `SMSTO:${digits}:${body}` : `sms:${digits}`);
    }
    case 'telegram':
      return buildTelegram(get('input-tg'));
    case 'whatsapp':
      return buildWhatsapp(get('input-wa-phone'), get('input-wa-text'));
    case 'pay':
      return buildPayment(get);
    case 'maps':
      return buildMaps(get('input-maps'));
  }
}
