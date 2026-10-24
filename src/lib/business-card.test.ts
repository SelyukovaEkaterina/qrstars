import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBusinessCardVCard,
  cardChipLinks,
  cardMessengerButtons,
  cardTextFieldsFromBody,
  normalizeCardServices,
  safeHttpUrl,
  telHref,
  telegramHref,
  toPublicBusinessCard,
  whatsappHref,
} from "./business-card";

describe("business card links", () => {
  it("builds WhatsApp link from a Russian phone", () => {
    assert.equal(whatsappHref("8 (999) 123-45-67"), "https://wa.me/79991234567");
    assert.equal(whatsappHref("+7 999 123 45 67"), "https://wa.me/79991234567");
    assert.equal(whatsappHref("wa.me/79991234567"), "https://wa.me/79991234567");
    assert.equal(whatsappHref("123"), null);
  });

  it("builds Telegram link from username, link or phone", () => {
    assert.equal(telegramHref("@master_ivan"), "https://t.me/master_ivan");
    assert.equal(telegramHref("master_ivan"), "https://t.me/master_ivan");
    assert.equal(telegramHref("https://t.me/master_ivan"), "https://t.me/master_ivan");
    assert.equal(telegramHref("+7 999 123-45-67"), "https://t.me/+79991234567");
    assert.equal(telegramHref("@ab"), null);
  });

  it("normalizes tel: links", () => {
    assert.equal(telHref("8 999 123-45-67"), "tel:+79991234567");
    assert.equal(telHref("+7 (999) 123-45-67"), "tel:+79991234567");
    assert.equal(telHref(""), null);
  });

  it("rejects non-http links", () => {
    assert.equal(safeHttpUrl("javascript:alert(1)"), null);
    assert.equal(safeHttpUrl("example.com"), "https://example.com/");
    assert.equal(safeHttpUrl("localhost"), null);
  });

  it("promotes messenger socials to buttons and keeps other socials as chips", () => {
    const card = {
      whatsapp: null,
      telegram: "@master_ivan",
      maxUrl: null,
      socialLinks: [
        { type: "whatsapp", url: "https://wa.me/79991234567" },
        { type: "telegram", url: "https://t.me/other" },
        { type: "vk", url: "vk.com/master" },
        { type: "youtube", url: "javascript:alert(1)" },
      ],
    };
    assert.deepEqual(cardMessengerButtons(card), [
      { kind: "whatsapp", href: "https://wa.me/79991234567" },
      { kind: "telegram", href: "https://t.me/master_ivan" },
    ]);
    assert.deepEqual(cardChipLinks(card), [{ type: "vk", url: "https://vk.com/master" }]);
  });
});

describe("business card data", () => {
  it("normalizes services", () => {
    assert.deepEqual(
      normalizeCardServices([
        { name: " Замена розетки ", price: "от 500 ₽" },
        { name: "", price: "100" },
        { name: "Вызов", price: 300 },
        "мусор",
      ]),
      [
        { name: "Замена розетки", price: "от 500 ₽" },
        { name: "Вызов", price: "" },
      ],
    );
    assert.equal(normalizeCardServices(Array.from({ length: 50 }, () => ({ name: "x" }))).length, 30);
  });

  it("reads only provided text fields from request body", () => {
    assert.deepEqual(cardTextFieldsFromBody({ title: " Электрик ", phone: "", unknown: "x" }), {
      title: "Электрик",
      phone: null,
    });
  });

  it("escapes vCard values", () => {
    const card = toPublicBusinessCard({
      id: "c1",
      fullName: "Иван; Петров",
      title: "Электрик",
      company: null,
      phone: "8 999 123-45-67",
      email: null,
      website: null,
      address: null,
      about: "Розетки, щитки\nвыезд",
      avatarUrl: null,
      socialLinks: [],
      accentColor: "#000",
      serviceArea: "Север",
    });
    const vcard = buildBusinessCardVCard(card, { cardUrl: "https://app.qrstars.ru/q/abc" });
    assert.match(vcard, /FN:Иван\\; Петров/);
    assert.match(vcard, /TEL;TYPE=CELL:\+79991234567/);
    assert.match(vcard, /NOTE:Электрик\\nРайон: Север\\nРозетки\\, щитки\\nвыезд/);
    assert.match(vcard, /URL;TYPE=QR:https:\/\/app\.qrstars\.ru\/q\/abc/);
  });
});
