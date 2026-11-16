import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scrubPii } from "./scrub-pii";

describe("scrubPii", () => {
  it("вырезает email, телефон и ник", () => {
    const out = scrubPii("пишите ivan@mail.ru или +7 (999) 123-45-67, тг @ivan_master");
    assert.equal(out, "пишите [email] или [телефон], тг [ник]");
  });

  it("не трогает обычный текст и числа", () => {
    assert.equal(scrubPii("PRO за 990 ₽ дорого"), "PRO за 990 ₽ дорого");
  });

  it("обрезает длинный текст", () => {
    assert.equal(scrubPii("а".repeat(10), 4), "аааа…");
  });
});
