/**
 * Разовая перегенерация наклейки с QR для страницы QR-меню.
 * Запуск: node scripts/generate-menu-sticker.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = path.join(root, 'public/sticker-source.jpg');
const OUTPUT_PATH = path.join(root, 'public/sticker.jpg');
const SCAN_URL = 'https://app.qrstars.ru/scan/demo-menu';

const QR_BOX = { left: 290, top: 270, size: 444 };
const QR_PAD = 6;

const qr = await QRCode.toBuffer(SCAN_URL, {
  width: QR_BOX.size,
  margin: 0,
  errorCorrectionLevel: 'H',
  color: { dark: '#000000', light: '#FFFFFF' },
});

const whitePad = await sharp({
  create: {
    width: QR_BOX.size + QR_PAD * 2,
    height: QR_BOX.size + QR_PAD * 2,
    channels: 3,
    background: '#FFFFFF',
  },
})
  .jpeg()
  .toBuffer();

const qrOnWhite = await sharp(whitePad)
  .composite([{ input: qr, left: QR_PAD, top: QR_PAD }])
  .jpeg()
  .toBuffer();

await sharp(SOURCE_PATH)
  .composite([
    {
      input: qrOnWhite,
      left: QR_BOX.left - QR_PAD,
      top: QR_BOX.top - QR_PAD,
    },
  ])
  .jpeg({ quality: 92 })
  .toFile(OUTPUT_PATH);

console.log(`Готово: ${OUTPUT_PATH}`);
