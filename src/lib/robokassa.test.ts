import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { buildPaymentRequest, buildReceipt, signInitialPayment } from "./robokassa";

const receipt = buildReceipt("PRO", "yearly", 990);
const receiptJson = JSON.stringify(receipt);

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

describe("signInitialPayment", () => {
  it("keeps the recurring formula when return URLs are absent", () => {
    const signature = signInitialPayment({
      merchantLogin: "demo",
      outSum: "990.00",
      invId: 20,
      receipt,
      password1: "password_1",
    });
    assert.equal(signature, md5(`demo:990.00:20:${receiptJson}:password_1`));
  });

  it("inserts SuccessUrl2 and FailUrl2 before the password", () => {
    const successUrl = "https://app.qrstars.ru/api/payments/robokassa/success";
    const failUrl = "https://app.qrstars.ru/api/payments/robokassa/fail";
    const signature = signInitialPayment({
      merchantLogin: "demo",
      outSum: "990.00",
      invId: 20,
      receipt,
      password1: "password_1",
      successUrl2: successUrl,
      successUrl2Method: "GET",
      failUrl2: failUrl,
      failUrl2Method: "GET",
    });
    assert.equal(
      signature,
      md5(`demo:990.00:20:${receiptJson}:${successUrl}:GET:${failUrl}:GET:password_1`)
    );
  });
});

describe("buildPaymentRequest", () => {
  const previous = {
    ROBOKASSA_MERCHANT_LOGIN: process.env.ROBOKASSA_MERCHANT_LOGIN,
    ROBOKASSA_PASSWORD_1: process.env.ROBOKASSA_PASSWORD_1,
    ROBOKASSA_TEST_MODE: process.env.ROBOKASSA_TEST_MODE,
    ROBOKASSA_RECURRING: process.env.ROBOKASSA_RECURRING,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("sends the buyer back to the app by GET", () => {
    process.env.ROBOKASSA_MERCHANT_LOGIN = "demo";
    process.env.ROBOKASSA_PASSWORD_1 = "password_1";
    process.env.ROBOKASSA_TEST_MODE = "false";
    process.env.ROBOKASSA_RECURRING = "false";
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.qrstars.ru";
    delete process.env.NEXTAUTH_URL;

    const { fields } = buildPaymentRequest({
      invId: 20,
      amount: 990,
      description: "QrStars PRO",
      plan: "PRO",
      billing: "yearly",
      userId: "user",
    });

    assert.equal(fields.SuccessUrl2, "https://app.qrstars.ru/api/payments/robokassa/success");
    assert.equal(fields.SuccessUrl2Method, "GET");
    assert.equal(fields.FailUrl2, "https://app.qrstars.ru/api/payments/robokassa/fail");
    assert.equal(fields.FailUrl2Method, "GET");
    assert.equal(
      fields.SignatureValue,
      md5(
        `demo:990.00:20:${fields.Receipt}:${fields.SuccessUrl2}:GET:${fields.FailUrl2}:GET:password_1`
      )
    );
  });
});
