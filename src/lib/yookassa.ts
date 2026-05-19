const YOOKASSA_API = "https://api.yookassa.ru/v3";

function getAuthHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

export async function createPayment(
  amount: number,
  description: string,
  userId: string,
  metadata: Record<string, string> = {}
) {
  const idempotenceKey = crypto.randomUUID();

  const res = await fetch(`${YOOKASSA_API}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify({
      amount: { value: amount.toFixed(2), currency: "RUB" },
      confirmation: {
        type: "redirect",
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/subscription`,
      },
      capture: true,
      description,
      metadata: { userId, ...metadata },
      recurring: true,
      save_payment_method: true,
    }),
  });

  return res.json();
}

export async function createRecurringPayment(
  amount: number,
  description: string,
  paymentMethodId: string,
  userId: string
) {
  const idempotenceKey = crypto.randomUUID();

  const res = await fetch(`${YOOKASSA_API}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify({
      amount: { value: amount.toFixed(2), currency: "RUB" },
      capture: true,
      description,
      payment_method_id: paymentMethodId,
      metadata: { userId, type: "recurring" },
    }),
  });

  return res.json();
}

export async function cancelPayment(paymentId: string) {
  const res = await fetch(`${YOOKASSA_API}/payments/${paymentId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
  });
  return res.json();
}
