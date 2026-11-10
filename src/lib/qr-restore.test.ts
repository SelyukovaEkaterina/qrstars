import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRestoreCode } from "./qr-restore";

describe("parseRestoreCode", () => {
  it("принимает голый код", () => {
    assert.equal(parseRestoreCode("  ab3k9z "), "ab3k9z");
  });

  it("достаёт код из ссылки", () => {
    assert.equal(parseRestoreCode("https://app.qrstars.ru/q/ab3k9z"), "ab3k9z");
    assert.equal(parseRestoreCode("app.qrstars.ru/scan/ab3k9z/?utm=1"), "ab3k9z");
    assert.equal(parseRestoreCode("https://qrstars.ru/q/my-cafe#top"), "my-cafe");
  });

  it("отклоняет мусор и демо-коды", () => {
    assert.equal(parseRestoreCode(""), null);
    assert.equal(parseRestoreCode("a"), null);
    assert.equal(parseRestoreCode("код кафе"), null);
    assert.equal(parseRestoreCode("demo-review"), null);
    assert.equal(parseRestoreCode(42), null);
  });
});
