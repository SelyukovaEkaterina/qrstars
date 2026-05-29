import { getAccessToken, iikoPost } from "@/lib/iiko/client";
import type {
  IikoMenuConfig,
  IikoMenuProductIndex,
  IikoOrderFulfillment,
  IikoOrderLineInput,
} from "@/lib/iiko/types";

export type IikoCreateOrderResult = {
  orderId: string | null;
  correlationId: string | null;
};

type CommandStatusResponse = {
  state?: string;
  errorInfo?: { code?: string; message?: string };
};

type DeliveryCreateResponse = {
  orderInfo?: { id?: string; creationStatus?: string };
  correlationId?: string;
};

function parsePrice(price: string | null): number | null {
  if (!price) return null;
  const cleaned = price.replace(/[^\d.,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

export function validateIikoOrderItems(
  lines: IikoOrderLineInput[],
  productIndex: IikoMenuProductIndex
): { items: IikoOrderLineInput[]; total: number; hasTotal: boolean } {
  if (lines.length === 0) {
    throw new Error("Корзина пуста");
  }

  let total = 0;
  let hasTotal = false;
  const validated: IikoOrderLineInput[] = [];

  for (const line of lines) {
    const pid = line.iikoProductId?.trim();
    if (!pid || line.qty < 1) {
      throw new Error("Некорректный состав заказа");
    }
    const key = line.iikoSizeId ? `${pid}:${line.iikoSizeId}` : pid;
    const ref = productIndex.get(key) ?? productIndex.get(pid);
    if (!ref) {
      throw new Error(`Позиция «${line.name}» недоступна в меню iiko`);
    }
    const clientPrice = parsePrice(line.price);
    if (ref.price !== null && clientPrice !== null && Math.abs(ref.price - clientPrice) > 0.01) {
      throw new Error(`Цена «${line.name}» изменилась. Обновите страницу.`);
    }
    const unitPrice = ref.price ?? clientPrice;
    if (unitPrice !== null) {
      total += unitPrice * line.qty;
      hasTotal = true;
    }
    validated.push({
      ...line,
      iikoProductId: ref.iikoProductId,
      iikoSizeId: ref.iikoSizeId,
      name: ref.name,
      price: unitPrice !== null ? `${unitPrice}` : line.price,
    });
  }

  return { items: validated, total, hasTotal };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return phone.trim();
}

export async function createIikoDeliveryOrder(params: {
  config: IikoMenuConfig;
  fulfillment: IikoOrderFulfillment;
  lines: IikoOrderLineInput[];
  total: number;
  hasTotal: boolean;
  guestName: string;
  guestPhone: string;
  guestAddress?: string | null;
  comment?: string | null;
}): Promise<IikoCreateOrderResult> {
  const {
    config,
    fulfillment,
    lines,
    total,
    hasTotal,
    guestName,
    guestPhone,
    guestAddress,
    comment,
  } = params;

  if (!config.terminalGroupId) {
    throw new Error("Не настроена терминальная группа iiko");
  }
  if (!config.paymentTypeId) {
    throw new Error("Не настроен тип оплаты iiko (SITE)");
  }

  const orderTypeId =
    fulfillment === "pickup"
      ? config.orderTypePickupId
      : config.orderTypeDeliveryId;

  if (!orderTypeId) {
    throw new Error(
      fulfillment === "pickup"
        ? "Не настроен тип заказа «самовывоз» в iiko"
        : "Не настроен тип заказа «доставка» в iiko"
    );
  }

  const token = await getAccessToken(config.apiLogin);

  const orderServiceType =
    fulfillment === "pickup" ? "DeliveryByClient" : "DeliveryByCourier";

  const iikoItems = lines.map((line) => ({
    productId: line.iikoProductId,
    type: "Product" as const,
    amount: line.qty,
    ...(parsePrice(line.price) !== null
      ? { price: parsePrice(line.price)! }
      : {}),
  }));

  const paymentSum = hasTotal ? total : 0;

  const orderBody: Record<string, unknown> = {
    phone: normalizePhone(guestPhone),
    orderServiceType,
    orderTypeId,
    customer: {
      name: guestName.trim(),
      type: "regular",
    },
    items: iikoItems,
    payments: [
      {
        paymentTypeKind: "Card",
        sum: paymentSum,
        paymentTypeId: config.paymentTypeId,
        isProcessedExternally: true,
      },
    ],
    comment: comment?.trim() || undefined,
  };

  if (fulfillment === "delivery") {
    const addressText = guestAddress?.trim() || "Адрес не указан";
    orderBody.deliveryPoint = {
      address: {
        street: { name: addressText, city: "" },
        house: "1",
      },
      comment: addressText,
    };
  }

  const data = await iikoPost<DeliveryCreateResponse>(
    "/api/1/deliveries/create",
    {
      organizationId: config.organizationId,
      terminalGroupId: config.terminalGroupId,
      order: orderBody,
    },
    token
  );

  let orderId = data.orderInfo?.id ?? null;
  const correlationId = data.correlationId ?? null;

  if (correlationId && data.orderInfo?.creationStatus === "InProgress") {
    for (let i = 0; i < 2; i++) {
      await new Promise((r) => setTimeout(r, 800));
      const status = await iikoPost<CommandStatusResponse>(
        "/api/1/commands/status",
        { correlationId },
        token
      );
      if (status.state === "Error") {
        throw new Error(status.errorInfo?.message ?? "iiko не принял заказ");
      }
      if (status.state === "Success") break;
    }
  }

  return { orderId, correlationId };
}
