import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  YANDEX_MAPS_CARD_ERROR,
  isValidYandexMapsUrl,
  normalizeYandexMapsUrl,
  yandexMapsUrlError,
} from "./yandex-maps-url";

describe("normalizeYandexMapsUrl", () => {
  it("adds https to yandex.ru/maps/org path", () => {
    const result = normalizeYandexMapsUrl("yandex.ru/maps/org/foo/123");
    assert.ok(result);
    assert.equal(result, "https://yandex.ru/maps/org/foo/123");
  });

  it("accepts full URL with query params", () => {
    const input = "https://yandex.ru/maps/org/foo/123/?ll=37.6,55.7&z=16&utm_source=test";
    assert.equal(normalizeYandexMapsUrl(input), input);
  });

  it("accepts yandex.com and maps.yandex.ru hosts", () => {
    assert.ok(
      isValidYandexMapsUrl("https://yandex.com/maps/org/cafe/999/")
    );
    assert.ok(
      isValidYandexMapsUrl("https://maps.yandex.ru/maps/org/cafe/999/")
    );
  });

  it("accepts mobile /org/ path", () => {
    assert.ok(isValidYandexMapsUrl("https://yandex.ru/org/cafe/123"));
  });

  it("accepts legacy /maps/-/ short link", () => {
    assert.ok(isValidYandexMapsUrl("https://yandex.ru/maps/-/ABC"));
  });

  it("rejects maps homepage", () => {
    assert.equal(normalizeYandexMapsUrl("https://yandex.ru/maps/"), null);
    assert.equal(normalizeYandexMapsUrl("https://yandex.ru/maps"), null);
  });

  it("rejects arbitrary domains", () => {
    assert.equal(normalizeYandexMapsUrl("https://google.com/maps/place/foo"), null);
  });

  it("rejects search results URL", () => {
    assert.equal(
      normalizeYandexMapsUrl("https://yandex.ru/maps/search/кафе"),
      null
    );
  });
});

describe("yandexMapsUrlError", () => {
  it("returns null for valid org URL", () => {
    assert.equal(
      yandexMapsUrlError("yandex.ru/maps/org/foo/123"),
      null
    );
  });

  it("returns null for empty input", () => {
    assert.equal(yandexMapsUrlError(""), null);
    assert.equal(yandexMapsUrlError("   "), null);
  });

  it("returns card error for homepage and search", () => {
    assert.equal(yandexMapsUrlError("https://yandex.ru/maps/"), YANDEX_MAPS_CARD_ERROR);
    assert.equal(
      yandexMapsUrlError("https://yandex.ru/maps/search/кафе"),
      YANDEX_MAPS_CARD_ERROR
    );
  });

  it("returns invalid error for wrong domain", () => {
    assert.equal(
      yandexMapsUrlError("https://google.com/foo"),
      "Некорректная ссылка на Яндекс.Карты"
    );
  });
});
