/**
 * Ключи переноса дизайна из генератора на лендинге — отдельно от `generator-style.ts`,
 * чтобы клиентские компоненты кабинета не тянули zod и рендер QR.
 */
export const GENERATOR_STYLE_PARAM = "qr_style";
export const GENERATOR_STYLE_STORAGE_KEY = "qrstars:generator-style";
export const GENERATOR_STYLE_SOURCE = "free-generator";
