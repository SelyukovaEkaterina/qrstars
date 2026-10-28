import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOfflineConversionsCsv, paymentsToOfflineRows } from "./metrika-offline";

describe("buildOfflineConversionsCsv", () => {
  it("keeps the 4-column format when no row has a price", () => {
    const csv = buildOfflineConversionsCsv([
      { target: "establishment_created", dateTime: 1761600000, clientId: "123", userId: "u1" },
    ]);
    assert.equal(csv, "ClientId,UserId,Target,DateTime\n123,u1,establishment_created,1761600000\n");
  });

  it("adds Price and Currency when rows carry revenue", () => {
    const csv = buildOfflineConversionsCsv([
      { target: "payment_success", dateTime: 1761600000, userId: "u1", price: 990, currency: "RUB" },
      { target: "payment_success", dateTime: 1761600001, clientId: "456", userId: "u2", price: 690.5 },
    ]);
    assert.equal(
      csv,
      "ClientId,UserId,Target,DateTime,Price,Currency\n" +
        ",u1,payment_success,1761600000,990.00,RUB\n" +
        "456,u2,payment_success,1761600001,690.50,RUB\n"
    );
  });
});

describe("paymentsToOfflineRows", () => {
  it("maps paid orders to payment_success with revenue in RUB", () => {
    const rows = paymentsToOfflineRows([
      {
        orderId: "o1",
        userId: "u1",
        metrikaClientId: "  ",
        paidAt: new Date("2026-10-27T10:00:00.500Z"),
        amount: 2900,
      },
    ]);
    assert.deepEqual(rows, [
      {
        target: "payment_success",
        dateTime: Math.floor(Date.parse("2026-10-27T10:00:00Z") / 1000),
        clientId: null,
        userId: "u1",
        price: 2900,
        currency: "RUB",
      },
    ]);
  });
});
