import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractReplyText, mailTopicMessageText, parseInboundEmail, parseMailTopicMessage, supportBodyFromEmail } from "./inbound-email";

describe("inbound email", () => {
  it("Gmail по-русски: цитата отрезается", () => {
    const text = [
      "Спасибо, а как поменять шаблон?",
      "",
      "сб, 15 нояб. 2026 г. в 19:12, QrStars.ru <noreply@qrstars.ru>:",
      "> Ваш микросайт теперь открывается как сайт",
    ].join("\n");
    assert.equal(extractReplyText(text), "Спасибо, а как поменять шаблон?");
  });

  it("Mail.ru / Яндекс: «написал(а):» и подпись с телефона", () => {
    const text = [
      "Круто, беру PRO",
      "",
      "Отправлено из мобильной Почты Mail",
      "",
      "Суббота, 15 ноября 2026, 19:12 +03:00 от QrStars.ru <noreply@qrstars.ru>:",
      "Ваш микросайт…",
    ].join("\n");
    assert.equal(extractReplyText(text), "Круто, беру PRO");
  });

  it("английский Gmail с переносом заголовка", () => {
    const text = ["Ok", "", "On Sat, Nov 15, 2026 at 7:12 PM QrStars.ru <noreply@qrstars.ru>", "wrote:", "> hi"].join("\n");
    assert.equal(extractReplyText(text), "Ok");
  });

  it("Outlook: блок «От:»", () => {
    const text = ["Да", "", "От: QrStars.ru <noreply@qrstars.ru>", "Отправлено: 15 ноября 2026"].join("\n");
    assert.equal(extractReplyText(text), "Да");
  });

  it("если всё — цитата, оставляем исходный текст", () => {
    assert.equal(extractReplyText("> только цитата"), "> только цитата");
  });

  it("тема без Re:", () => {
    const body = supportBodyFromEmail({ subject: "Re: RE: Ваш сайт готов", text: "вопрос" });
    assert.equal(body, "Письмо: «Ваш сайт готов»\n\nвопрос");
  });

  it("parseInboundEmail: адрес обязателен, вложения ограничены", () => {
    assert.equal(parseInboundEmail({ from: "не адрес" }), null);
    const e = parseInboundEmail({
      from: " User@Example.com ",
      text: "x",
      attachments: Array.from({ length: 9 }, () => ({ name: "a.png", mime: "image/png", dataBase64: "AA==" })),
    });
    assert.equal(e?.from, "user@example.com");
    assert.equal(e?.attachments.length, 5);
    assert.equal(e?.automated, false);
  });
});

describe("тема «Почта»", () => {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const strip = (html: string) =>
    html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

  it("сообщение и разбор реплая сходятся", () => {
    const html = mailTopicMessageText(
      { from: "anna@mail.ru", fromName: "Анна", to: "info@qrstars.ru", subject: "Вопрос\nпро тариф", attachments: 1 },
      "Здравствуйте!\n\nОт: кто-то другой <x@y.ru>",
      esc
    );
    const parsed = parseMailTopicMessage(strip(html));
    assert.equal(parsed?.from, "anna@mail.ru");
    assert.equal(parsed?.subject, "Вопрос про тариф");
    assert.ok(parsed?.body.startsWith("Здравствуйте!"));
  });

  it("чужое сообщение — null", () => {
    assert.equal(parseMailTopicMessage("просто текст"), null);
  });
});
