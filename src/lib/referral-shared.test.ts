import { test } from "node:test";
import assert from "node:assert/strict";
import { giftRemainingMs, maskEmail } from "./referral-shared";

test("maskEmail оставляет первую букву и домен", () => {
  assert.equal(maskEmail("ivan@mail.ru"), "i***@mail.ru");
  assert.equal(maskEmail("a@b.co"), "a***@b.co");
  assert.equal(maskEmail("weird"), "***");
  assert.equal(maskEmail("@nolocal.ru"), "***");
});

test("giftRemainingMs считает только подарочные подписки", () => {
  const now = new Date("2026-11-15T00:00:00Z");
  const end = new Date("2026-11-25T00:00:00Z");
  assert.equal(giftRemainingMs({ giftReason: "referral", currentPeriodEnd: end }, now), 10 * 86_400_000);
  assert.equal(giftRemainingMs({ giftReason: null, currentPeriodEnd: end }, now), 0);
  assert.equal(
    giftRemainingMs({ giftReason: "referral", currentPeriodEnd: new Date("2026-11-01T00:00:00Z") }, now),
    0
  );
  assert.equal(giftRemainingMs(null, now), 0);
});
