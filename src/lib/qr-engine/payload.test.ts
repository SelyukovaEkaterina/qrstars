import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPayload, escapeVcard, normalizeUrl, type QrType } from "./payload";
import { contrastRatio, MIN_QR_CONTRAST, randomReadablePalette } from "./palette";

const build = (type: QrType, fields: Record<string, string>) => buildPayload(type, (id) => fields[id] ?? "");

describe("qr-engine payload", () => {
  it("adds https:// to bare domains and rejects garbage", () => {
    const res = normalizeUrl("qrstars.ru/blog");
    assert.equal(res.kind, "ok");
    assert.equal(res.kind === "ok" && res.payload, "https://qrstars.ru/blog");
    assert.ok(res.kind === "ok" && res.hint);
    assert.equal(normalizeUrl("просто текст").kind, "error");
    assert.equal(normalizeUrl("").kind, "empty");
    assert.deepEqual(normalizeUrl("https://example.com"), { kind: "ok", payload: "https://example.com", hint: undefined });
  });

  it("builds a GOST R 56042 payment string with kopecks", () => {
    const res = build("pay", {
      "input-pay-name": "ИП Иванов",
      "input-pay-acc": "40802810000000000000",
      "input-pay-bank": "ПАО Сбербанк",
      "input-pay-bic": "044525225",
      "input-pay-corr": "30101810400000000225",
      "input-pay-sum": "1500,50",
    });
    assert.equal(res.kind, "ok");
    assert.equal(
      res.kind === "ok" && res.payload,
      "ST00012|Name=ИП Иванов|PersonalAcc=40802810000000000000|BankName=ПАО Сбербанк|BIC=044525225|CorrespAcc=30101810400000000225|Sum=150050",
    );
    const bad = build("pay", { "input-pay-name": "ИП", "input-pay-acc": "123" });
    assert.equal(bad.kind, "error");
  });

  it("normalizes telegram, whatsapp and maps links", () => {
    const tg = build("telegram", { "input-tg": "@qrstars_bot" });
    assert.equal(tg.kind === "ok" && tg.payload, "https://t.me/qrstars_bot");
    assert.equal(build("telegram", { "input-tg": "ab" }).kind, "error");
    const wa = build("whatsapp", { "input-wa-phone": "8 (999) 123-45-67", "input-wa-text": "Привет" });
    assert.equal(wa.kind === "ok" && wa.payload, "https://wa.me/79991234567?text=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82");
    assert.equal(build("maps", { "input-maps": "https://google.com/maps" }).kind, "error");
    assert.equal(build("maps", { "input-maps": "https://yandex.ru/maps/org/kofe/123/" }).kind, "ok");
  });

  it("escapes vCard values", () => {
    assert.equal(escapeVcard("ООО «Рога; и, копыта»"), "ООО «Рога\\; и\\, копыта»");
    const res = build("vcard", { "input-vcard-fname": "Иван", "input-vcard-org": "А;Б" });
    assert.ok(res.kind === "ok" && res.payload.includes("ORG:А\\;Б"));
  });
});

describe("qr-engine palette", () => {
  it("random palettes keep dots readable on the background", () => {
    for (let i = 0; i < 200; i++) {
      const p = randomReadablePalette();
      for (const c of [p.fg, p.grad1, p.grad2, p.eyeColor]) {
        assert.ok(contrastRatio(c, p.bg) >= MIN_QR_CONTRAST, `${c} on ${p.bg}`);
      }
    }
  });
});
