import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  YANDEX_MAPS_CARD_ERROR,
  YANDEX_MAPS_SHORT_UNCONFIRMED_ERROR,
  extractYandexOrgTitle,
  isGenericYandexMapsTitle,
  isValidYandexMapsUrl,
  isYandexMapsShortUrl,
  normalizeYandexMapsUrl,
  orgNameFromYandexPath,
  resolveYandexMapsPreview,
  YANDEX_MAPS_GENERIC_ORG_ERROR,
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

  it("does not treat short /maps/-/ as a confirmed org card", () => {
    assert.equal(normalizeYandexMapsUrl("https://yandex.ru/maps/-/CDwZ6KMr"), null);
    assert.ok(isYandexMapsShortUrl("https://yandex.ru/maps/-/CDwZ6KMr"));
    assert.equal(
      yandexMapsUrlError("https://yandex.ru/maps/-/CDwZ6KMr"),
      YANDEX_MAPS_SHORT_UNCONFIRMED_ERROR
    );
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

describe("title helpers", () => {
  it("reads og:title and strips Yandex suffix", () => {
    const html = `<meta property="og:title" content="Кофейня «Бобр» — Яндекс Карты">`;
    assert.equal(extractYandexOrgTitle(html), "Кофейня «Бобр»");
  });

  it("reads slug from org path", () => {
    assert.equal(orgNameFromYandexPath("/maps/org/кофейня_бобр/123"), "кофейня бобр");
  });
});

describe("resolveYandexMapsPreview", () => {
  it("follows a short link to an org card", async () => {
    const fetchMock = async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/maps/-/")) {
        return new Response("", {
          status: 302,
          headers: { location: "https://yandex.ru/maps/org/cafe_roma/42" },
        });
      }
      return new Response(`<title>Cafe Roma — Яндекс Карты</title>`, { status: 200 });
    };
    const result = await resolveYandexMapsPreview("https://yandex.ru/maps/-/ABC", fetchMock as typeof fetch);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.name, "Cafe Roma");
      assert.match(result.canonicalUrl, /\/maps\/org\/cafe_roma\/42/);
    }
  });

  it("rejects search URLs without fetching", async () => {
    const result = await resolveYandexMapsPreview("https://yandex.ru/maps/search/кафе", async () => {
      throw new Error("should not fetch");
    });
    assert.equal(result.ok, false);
  });

  it("rejects a generic homepage title on an org path", async () => {
    const result = await resolveYandexMapsPreview(
      "https://yandex.ru/maps/org/koleso/1043674692/",
      async () =>
        new Response(
          `<title>Яндекс Карты — транспорт, навигация, поиск мест</title>`,
          { status: 200 }
        )
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, YANDEX_MAPS_GENERIC_ORG_ERROR);
    }
  });

  it("does not fall back to the URL slug when the title is generic", async () => {
    assert.equal(
      isGenericYandexMapsTitle("Яндекс Карты — транспорт, навигация, поиск мест"),
      true
    );
    const result = await resolveYandexMapsPreview(
      "https://yandex.ru/maps/org/koleso/1043674692/",
      async () =>
        new Response(`<title>Яндекс Карты — транспорт, навигация, поиск мест</title>`, {
          status: 200,
        })
    );
    assert.equal(result.ok, false);
  });

  it("rejects non-OK HTTP status for an org URL", async () => {
    const result = await resolveYandexMapsPreview(
      "https://yandex.ru/maps/org/koleso/1/",
      async () => new Response("not found", { status: 404 })
    );
    assert.equal(result.ok, false);
  });
});
