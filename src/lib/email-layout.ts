import { getBaseUrl, createSignedUserToken } from "@/lib/signed-user-token";

const BRAND = "#4f46e5";

export interface EmailLayoutOptions {
  userId: string;
  preheader?: string;
  title: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  showUnsubscribe?: boolean;
}

export function renderEmailLayout(options: EmailLayoutOptions): string {
  const base = getBaseUrl();
  const unsubscribeUrl = `${base}/api/unsubscribe?token=${createSignedUserToken(options.userId, "unsubscribe", 90 * 24 * 60 * 60 * 1000)}`;
  const preheader = options.preheader ?? "";
  const ctaBlock = options.cta
    ? `<p style="margin:28px 0 0;">
        <a href="${options.cta.href}"
           style="display:inline-block;padding:14px 28px;background:${BRAND};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px;">
          ${options.cta.label}
        </a>
      </p>`
    : "";

  const footerLinks = [
    `<a href="${base}/dashboard/support" style="color:#6366f1;text-decoration:none;">Поддержка</a>`,
  ];
  if (options.showUnsubscribe !== false) {
    footerLinks.push(
      `<a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:none;">Отписаться от подсказок</a>`
    );
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <span style="display:none;max-height:0;overflow:hidden;color:transparent;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:${BRAND};padding:24px 32px;">
          <p style="margin:0;font-family:sans-serif;font-size:22px;font-weight:700;color:#ffffff;">QrStars.ru</p>
          <p style="margin:6px 0 0;font-family:sans-serif;font-size:13px;color:rgba(255,255,255,0.85);">Умные QR для локального бизнеса</p>
        </td></tr>
        <tr><td style="padding:32px;font-family:sans-serif;color:#1f2937;line-height:1.6;">
          <h1 style="margin:0 0 16px;font-size:24px;color:#111827;">${options.title}</h1>
          ${options.bodyHtml}
          ${ctaBlock}
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #e5e7eb;font-family:sans-serif;font-size:12px;color:#9ca3af;line-height:1.8;">
          ${footerLinks.join(" &nbsp;·&nbsp; ")}
          <p style="margin:12px 0 0;">© QrStars.ru — сервис QR-отзывов и микро-лендингов для HoReCa и локального бизнеса</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function featureBlock(title: string, text: string): string {
  return `<div style="margin:16px 0;padding:16px 18px;background:#f9fafb;border-radius:12px;border-left:4px solid ${BRAND};">
    <p style="margin:0 0 6px;font-weight:600;color:#111827;">${title}</p>
    <p style="margin:0;font-size:15px;color:#4b5563;">${text}</p>
  </div>`;
}

export function bulletList(items: string[]): string {
  const lis = items.map((i) => `<li style="margin-bottom:8px;">${i}</li>`).join("");
  return `<ul style="margin:16px 0;padding-left:20px;color:#374151;font-size:15px;">${lis}</ul>`;
}
