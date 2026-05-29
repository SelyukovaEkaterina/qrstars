import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { collectClientInfo } from "@/lib/client-info";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendTelegramContactNotification } from "@/lib/telegram";
import { sendMaxMessage } from "@/lib/max";
import {
  configFromQrMenu,
  createIikoDeliveryOrder,
  fetchIikoMenuData,
  IikoApiError,
  validateIikoOrderItems,
} from "@/lib/iiko";
import type { IikoOrderFulfillment } from "@/lib/iiko/types";

interface OrderItem {
  name: string;
  price: string | null;
  qty: number;
  iikoProductId?: string;
  iikoSizeId?: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parsePrice(price: string | null): number | null {
  if (!price) return null;
  const cleaned = price.replace(/[^\d.,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function buildOrderText(params: {
  establishmentName: string;
  qrLabel: string;
  guestName: string;
  tableNumber: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  guestAddress: string | null;
  comment: string | null;
  items: OrderItem[];
  totalText: string | null;
  ip: string;
  region: string;
  browser: string;
  device: string;
}): string {
  const { establishmentName, qrLabel, guestName, tableNumber, guestPhone, guestEmail, guestAddress, comment, items, totalText, ip, region, browser, device } = params;

  const itemLines = items.map((it, i) => {
    const priceStr = it.price ? ` — ${it.price}` : "";
    return `${i + 1}. ${escapeHtml(it.name)} ×${it.qty}${priceStr}`;
  });

  const lines = [
    `<b>🛒 Новый заказ из меню</b>`,
    ``,
    `<b>Заведение:</b> ${escapeHtml(establishmentName)}`,
    `<b>QR:</b> ${escapeHtml(qrLabel)}`,
    tableNumber ? `<b>Стол:</b> ${escapeHtml(tableNumber)}` : null,
    `<b>Гость:</b> ${escapeHtml(guestName)}`,
    guestPhone ? `<b>Телефон:</b> ${escapeHtml(guestPhone)}` : null,
    guestEmail ? `<b>Email:</b> ${escapeHtml(guestEmail)}` : null,
    guestAddress ? `<b>Адрес:</b> ${escapeHtml(guestAddress)}` : null,
    ``,
    `<b>Заказ:</b>`,
    ...itemLines,
    totalText ? `\n<b>Итого: ${escapeHtml(totalText)}</b>` : null,
    comment ? `\n<b>Комментарий:</b> <i>${escapeHtml(comment)}</i>` : null,
    ``,
    `<b>IP:</b> ${escapeHtml(ip)}`,
    `<b>Регион:</b> ${escapeHtml(region)}`,
    `<b>Браузер:</b> ${escapeHtml(browser)}`,
    `<b>Устройство:</b> ${escapeHtml(device)}`,
  ].filter((l) => l !== null);

  return lines.join("\n");
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`menu-order:${ip}`, 5, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много заказов. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = await request.json();
  const {
    establishmentId,
    qrCodeId,
    qrLabel: qrLabelFromClient,
    items,
    guestName,
    tableNumber,
    guestPhone,
    guestEmail,
    guestAddress,
    comment,
    pdConsentGiven,
    fulfillment,
  } = body as {
    establishmentId?: string;
    qrCodeId?: string;
    qrLabel?: string;
    items?: OrderItem[];
    guestName?: string;
    tableNumber?: string;
    guestPhone?: string;
    guestEmail?: string;
    guestAddress?: string;
    comment?: string;
    pdConsentGiven?: boolean;
    fulfillment?: IikoOrderFulfillment;
  };

  if (!establishmentId?.trim()) {
    return NextResponse.json({ error: "Не указан идентификатор заведения" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Корзина пуста" }, { status: 400 });
  }
  if (!guestName?.trim()) {
    return NextResponse.json({ error: "Укажите ваше имя" }, { status: 400 });
  }
  if (items.some((it) => !it.name || typeof it.qty !== "number" || it.qty < 1)) {
    return NextResponse.json({ error: "Некорректный состав заказа" }, { status: 400 });
  }

  const est = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: {
      id: true,
      name: true,
      menuId: true,
      notificationEmailEnabled: true,
      notificationEmail: true,
      notificationTelegramEnabled: true,
      notificationTelegramChatId: true,
      notificationMaxEnabled: true,
      notificationMaxUserId: true,
      user: { select: { email: true } },
    },
  });

  if (!est) {
    return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });
  }

  // Проверяем что у заведения включён режим корзины
  let menuRecord = null;
  if (est.menuId) {
    menuRecord = await prisma.qRMenu.findUnique({
      where: { id: est.menuId },
    });
    if (!menuRecord?.cartEnabled) {
      return NextResponse.json({ error: "Режим заказов не включён" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Режим заказов не включён" }, { status: 403 });
  }

  const isIiko = menuRecord.source === "IIKO";
  if (isIiko) {
    if (!guestPhone?.trim()) {
      return NextResponse.json({ error: "Укажите телефон для заказа в iiko" }, { status: 400 });
    }
    const ff = fulfillment === "delivery" ? "delivery" : "pickup";
    if (ff === "delivery" && !guestAddress?.trim()) {
      return NextResponse.json({ error: "Укажите адрес доставки" }, { status: 400 });
    }
    if (items.some((it) => !it.iikoProductId)) {
      return NextResponse.json({ error: "Некорректный состав заказа (iiko)" }, { status: 400 });
    }
  }

  let iikoOrderId: string | null = null;
  let iikoCorrelationId: string | null = null;
  let orderItems = items;
  let total = 0;
  let hasTotal = false;

  if (isIiko) {
    const config = configFromQrMenu(menuRecord);
    if (!config) {
      return NextResponse.json({ error: "iiko не настроен" }, { status: 400 });
    }
    try {
      const { menu: iikoMenu } = await fetchIikoMenuData(config, {
        id: menuRecord.id,
        title: menuRecord.title,
        description: menuRecord.description,
        cartEnabled: menuRecord.cartEnabled,
        askPhone: menuRecord.askPhone,
        askEmail: menuRecord.askEmail,
        askAddress: menuRecord.askAddress,
        hiddenCategoryIds: config.hiddenCategoryIds,
      });
      const productIndex = iikoMenu._iikoProductIndex;
      if (!productIndex) {
        return NextResponse.json({ error: "Не удалось проверить меню iiko" }, { status: 502 });
      }
      const validated = validateIikoOrderItems(
        items.map((it) => ({
          iikoProductId: it.iikoProductId!,
          iikoSizeId: it.iikoSizeId,
          name: it.name,
          price: it.price,
          qty: it.qty,
        })),
        productIndex
      );
      orderItems = validated.items.map((it) => ({
        name: it.name,
        price: it.price,
        qty: it.qty,
        iikoProductId: it.iikoProductId,
        iikoSizeId: it.iikoSizeId,
      }));
      total = validated.total;
      hasTotal = validated.hasTotal;

      const iikoResult = await createIikoDeliveryOrder({
        config,
        fulfillment: fulfillment === "delivery" ? "delivery" : "pickup",
        lines: validated.items,
        total,
        hasTotal,
        guestName: guestName.trim(),
        guestPhone: guestPhone!.trim(),
        guestAddress: guestAddress?.trim() || null,
        comment: comment?.trim() || null,
      });
      iikoOrderId = iikoResult.orderId;
      iikoCorrelationId = iikoResult.correlationId;
    } catch (e) {
      const message = e instanceof IikoApiError ? e.message : e instanceof Error ? e.message : "Ошибка iiko";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } else {
    for (const it of items) {
      const p = parsePrice(it.price);
      if (p !== null) {
        total += p * it.qty;
        hasTotal = true;
      }
    }
  }

  const totalText = hasTotal ? `${total.toLocaleString("ru-RU")} ₽` : null;

  // Резолвим QR-метку: берём из БД по qrCodeId (приоритет), иначе из тела запроса
  let qrLabel = qrLabelFromClient?.trim() || est.name;
  if (qrCodeId) {
    const qr = await prisma.qRCode.findUnique({
      where: { id: qrCodeId },
      select: { label: true, code: true },
    });
    if (qr) {
      qrLabel = qr.label?.trim() || qr.code;
    }
  }

  const client = await collectClientInfo(request);
  const text = buildOrderText({
    establishmentName: est.name,
    qrLabel,
    guestName: guestName.trim(),
    tableNumber: tableNumber?.trim() || null,
    guestPhone: guestPhone?.trim() || null,
    guestEmail: guestEmail?.trim() || null,
    guestAddress: guestAddress?.trim() || null,
    comment: comment?.trim() || null,
    items: orderItems,
    totalText,
    ...client,
  });

  const emailTo = est.notificationEmailEnabled && est.notificationEmail
    ? est.notificationEmail
    : est.user.email;

  const n = (v?: string | null) => v?.trim() || null;

  const emailBody = [
    `<h2>🛒 Новый заказ из меню — ${escapeHtml(est.name)}</h2>`,
    `<p><b>QR:</b> ${escapeHtml(qrLabel)}</p>`,
    n(tableNumber) ? `<p><b>Стол:</b> ${escapeHtml(n(tableNumber)!)}</p>` : "",
    `<p><b>Гость:</b> ${escapeHtml(guestName.trim())}</p>`,
    n(guestPhone) ? `<p><b>Телефон:</b> ${escapeHtml(n(guestPhone)!)}</p>` : "",
    n(guestEmail) ? `<p><b>Email:</b> ${escapeHtml(n(guestEmail)!)}</p>` : "",
    n(guestAddress) ? `<p><b>Адрес:</b> ${escapeHtml(n(guestAddress)!)}</p>` : "",
    `<ul>`,
    ...orderItems.map((it) => {
      const priceStr = it.price ? ` — ${it.price}` : "";
      return `<li>${escapeHtml(it.name)} ×${it.qty}${priceStr}</li>`;
    }),
    `</ul>`,
    totalText ? `<p><b>Итого: ${escapeHtml(totalText)}</b></p>` : "",
    n(comment) ? `<p><b>Комментарий:</b> ${escapeHtml(n(comment)!)}</p>` : "",
    `<hr><small>IP: ${client.ip} | ${client.region} | ${client.browser}</small>`,
  ].filter(Boolean).join("\n");

  const { sendMail } = await import("@/lib/mailer");
  await sendMail(emailTo, `Новый заказ — ${est.name} [${qrLabel}]`, emailBody);

  if (est.notificationTelegramEnabled && est.notificationTelegramChatId) {
    await sendTelegramContactNotification(est.notificationTelegramChatId, text);
  }

  if (est.notificationMaxEnabled && est.notificationMaxUserId) {
    await sendMaxMessage(est.notificationMaxUserId, text, "html");
  }

  const savedOrder = await prisma.menuOrder.create({
    data: {
      establishmentId: est.id,
      qrCodeId: qrCodeId || null,
      items: orderItems as object[],
      total: hasTotal ? total : null,
      totalText,
      guestName: guestName.trim(),
      tableNumber: tableNumber?.trim() || null,
      guestPhone: guestPhone?.trim() || null,
      guestEmail: guestEmail?.trim() || null,
      guestAddress: guestAddress?.trim() || null,
      comment: comment?.trim() || null,
      iikoOrderId,
      iikoCorrelationId,
      guestIp: client.ip,
      guestRegion: client.region,
      guestBrowser: client.browser,
      guestDevice: client.device,
      ...(pdConsentGiven && (guestPhone?.trim() || guestEmail?.trim())
        ? { pdConsentAt: new Date(), pdConsentIp: client.ip }
        : {}),
    },
  });

  return NextResponse.json({ success: true, orderId: savedOrder.id });
}
