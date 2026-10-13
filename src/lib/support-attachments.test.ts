import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supportFileUrlForTelegram } from "./support-attachments";

const BASE = "https://app.qrstars.ru";

describe("supportFileUrlForTelegram", () => {
  it("добавляет хост к относительному пути хранилища", () => {
    assert.equal(
      supportFileUrlForTelegram(
        "/storage/support/ticket/1791913365812-p92f2r.png",
        BASE
      ),
      "https://app.qrstars.ru/storage/support/ticket/1791913365812-p92f2r.png"
    );
  });

  it("оставляет абсолютный URL как есть", () => {
    const url = "https://s3.qrstars.ru/support/ticket/file.pdf";
    assert.equal(supportFileUrlForTelegram(url, BASE), url);
  });

  it("не дублирует слэш, если база уже заканчивается на него", () => {
    assert.equal(
      supportFileUrlForTelegram("/storage/a.png", "https://app.qrstars.ru/"),
      "https://app.qrstars.ru/storage/a.png"
    );
  });
});
