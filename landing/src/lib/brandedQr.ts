import QRCode from 'qrcode';

const BRAND_COLOR = '#4F46E5';

export async function generateBrandedQrDataUrl(
  url: string,
  size = 280,
  darkColor = BRAND_COLOR,
): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: {
      dark: darkColor,
      light: '#FFFFFF',
    },
  });
}
