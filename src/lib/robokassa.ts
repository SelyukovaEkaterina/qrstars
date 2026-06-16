import crypto from "crypto";
import type { BillingPeriod, PlanId } from "@/lib/plans";

const PAYMENT_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";
const RECURRING_URL = "https://auth.robokassa.ru/Merchant/Recurring";

export interface RobokassaConfig {
  merchantLogin: string;
  password1: string;
  password2: string;
  testMode: boolean;
}

export interface RobokassaPaymentRequest {
  action: string;
  fields: Record<string, string>;
}

export function getRobokassaConfig(): RobokassaConfig | null {
  const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN?.trim();
  if (!merchantLogin) return null;

  const testMode = process.env.ROBOKASSA_TEST_MODE === "true";
  const password1 = (
    (testMode ? process.env.ROBOKASSA_TEST_PASSWORD_1 : null) ||
    process.env.ROBOKASSA_PASSWORD_1 ||
    ""
  ).trim();
  const password2 = (
    (testMode ? process.env.ROBOKASSA_TEST_PASSWORD_2 : null) ||
    process.env.ROBOKASSA_PASSWORD_2 ||
    ""
  ).trim();

  return { merchantLogin, password1, password2, testMode };
}

export function isRobokassaConfigured(): boolean {
  return getRobokassaConfig() !== null;
}

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

export function formatOutSum(amount: number): string {
  return amount.toFixed(2);
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  sum: number;
  payment_method: string;
  payment_object: string;
  tax: string;
}

export interface ReceiptPayload {
  sno: string;
  items: ReceiptItem[];
}

function receiptItemName(plan: PlanId, billing: BillingPeriod): string {
  const planLabel = plan === "NETWORK" ? "Set" : "PRO";
  const periodLabel = billing === "yearly" ? "1 god" : "1 mes";
  return `Podpiska QrStars ${planLabel}, ${periodLabel}`.slice(0, 128);
}

export function buildReceipt(
  plan: PlanId,
  billing: BillingPeriod,
  amount: number
): ReceiptPayload {
  const sum = Math.round(amount * 100) / 100;
  return {
    sno: "usn_income",
    items: [
      {
        name: receiptItemName(plan, billing),
        quantity: 1,
        sum,
        payment_method: "full_payment",
        payment_object: "service",
        tax: "none",
      },
    ],
  };
}

function receiptJson(receipt: ReceiptPayload): string {
  return JSON.stringify(receipt);
}

/** Receipt в подписи — сырой JSON (как значение поля Receipt в POST). */
function receiptForSignature(receipt: ReceiptPayload): string {
  return receiptJson(receipt);
}

function shpSignaturePart(params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter((k) => k.toLowerCase().startsWith("shp_"))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  if (keys.length === 0) return "";
  return ":" + keys.map((k) => `${k}=${params[k]}`).join(":");
}

export function signInitialPayment(params: {
  merchantLogin: string;
  outSum: string;
  invId: number;
  receipt: ReceiptPayload;
  password1: string;
  shp?: Record<string, string>;
}): string {
  const receiptPart = receiptForSignature(params.receipt);
  let base = `${params.merchantLogin}:${params.outSum}:${params.invId}:${receiptPart}:${params.password1}`;
  if (params.shp && Object.keys(params.shp).length > 0) {
    base += shpSignaturePart(params.shp);
  }
  return md5(base);
}

export function signRecurringPayment(params: {
  merchantLogin: string;
  outSum: string;
  invId: number;
  receipt: ReceiptPayload;
  password1: string;
}): string {
  return signInitialPayment(params);
}

export function signResult(params: {
  outSum: string;
  invId: string | number;
  password2: string;
  shp?: Record<string, string>;
}): string {
  const invIdStr = String(params.invId);
  let base = `${params.outSum}:${invIdStr}:${params.password2}`;
  if (params.shp && Object.keys(params.shp).length > 0) {
    base += shpSignaturePart(params.shp);
  }
  return md5(base);
}

export function verifyResultSignature(
  query: Record<string, string | undefined>,
  password2: string
): boolean {
  const outSum = query.OutSum ?? query.outsum;
  const invId = query.InvId ?? query.invId ?? query.InvoiceID;
  const signature = query.SignatureValue ?? query.signaturevalue;
  if (!outSum || !invId || !signature) return false;

  const shp: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.toLowerCase().startsWith("shp_") && value != null) {
      shp[key] = value;
    }
  }

  const expected = signResult({
    outSum,
    invId,
    password2,
    shp: Object.keys(shp).length > 0 ? shp : undefined,
  });

  return expected.toLowerCase() === signature.toLowerCase();
}

export interface PaymentUrlParams {
  invId: number;
  amount: number;
  description: string;
  plan: PlanId;
  billing: BillingPeriod;
  userId: string;
}

export function buildPaymentRequest(params: PaymentUrlParams): RobokassaPaymentRequest {
  const config = getRobokassaConfig();
  if (!config) throw new Error("Robokassa not configured");

  const outSum = formatOutSum(params.amount);
  const receipt = buildReceipt(params.plan, params.billing, params.amount);
  const signature = signInitialPayment({
    merchantLogin: config.merchantLogin,
    outSum,
    invId: params.invId,
    receipt,
    password1: config.password1,
  });

  const fields: Record<string, string> = {
    MerchantLogin: config.merchantLogin,
    OutSum: outSum,
    InvId: String(params.invId),
    Description: params.description,
    Receipt: receiptJson(receipt),
    SignatureValue: signature,
    Encoding: "utf-8",
  };

  if (process.env.ROBOKASSA_RECURRING !== "false") {
    fields.Recurring = "true";
  }

  if (config.testMode) {
    fields.IsTest = "1";
  }

  fields.Culture = "ru";

  return { action: PAYMENT_URL, fields };
}

/** POST на Robokassa → URL новой платёжной страницы (/Merchant/Index/{uuid}). */
export async function resolvePaymentRedirectUrl(
  request: RobokassaPaymentRequest
): Promise<string | null> {
  const res = await fetch(request.action, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(request.fields).toString(),
    redirect: "manual",
  });

  const location = res.headers.get("location");
  if (!location) return null;

  if (location.startsWith("http")) return location;
  return new URL(location, "https://auth.robokassa.ru").href;
}

/** @deprecated use buildPaymentRequest + POST form */
export function buildPaymentUrl(params: PaymentUrlParams): string {
  const { action, fields } = buildPaymentRequest(params);
  return `${action}?${new URLSearchParams(fields).toString()}`;
}

export interface RecurringPaymentParams {
  invId: number;
  previousInvId: number;
  amount: number;
  description: string;
  plan: PlanId;
  billing: BillingPeriod;
  userId: string;
}

export async function createRecurringPayment(
  params: RecurringPaymentParams
): Promise<{ ok: boolean; body: string; invId: number }> {
  const config = getRobokassaConfig();
  if (!config) throw new Error("Robokassa not configured");

  const outSum = formatOutSum(params.amount);
  const receipt = buildReceipt(params.plan, params.billing, params.amount);
  const signature = signRecurringPayment({
    merchantLogin: config.merchantLogin,
    outSum,
    invId: params.invId,
    receipt,
    password1: config.password1,
  });

  const body = new URLSearchParams({
    MerchantLogin: config.merchantLogin,
    OutSum: outSum,
    InvoiceID: String(params.invId),
    PreviousInvoiceID: String(params.previousInvId),
    Description: params.description,
    Receipt: receiptJson(receipt),
    SignatureValue: signature,
    Encoding: "utf-8",
  });

  if (config.testMode) {
    body.set("IsTest", "1");
  }

  const res = await fetch(RECURRING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  const ok =
    text.toUpperCase().includes(`OK${params.invId}`) ||
    text.toUpperCase().includes(`OK+${params.invId}`) ||
    text.toUpperCase().includes(`OK:${params.invId}`);

  return { ok, body: text, invId: params.invId };
}

export function parseOutSum(outSum: string): number {
  return Math.round(parseFloat(outSum) * 100) / 100;
}

export function amountsMatch(expected: number, received: string): boolean {
  return Math.abs(expected - parseOutSum(received)) < 0.01;
}
