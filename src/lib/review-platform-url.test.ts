import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  toAvitoReviewSubmitUrl,
  toPlatformReviewUrl,
  toTwoGisReviewSubmitUrl,
  toYandexReviewSubmitUrl,
} from "./review-platform-url";

describe("toYandexReviewSubmitUrl", () => {
  it("appends /reviews/?add-review=1 to an org card", () => {
    const result = toYandexReviewSubmitUrl("https://yandex.ru/maps/org/koleso/123/");
    assert.equal(
      result,
      "https://yandex.ru/maps/org/koleso/123/reviews/?add-review=1"
    );
  });

  it("keeps a reviews path and adds add-review", () => {
    const result = toYandexReviewSubmitUrl(
      "https://yandex.ru/maps/org/koleso/123/reviews/?ll=1,2"
    );
    assert.ok(result);
    const parsed = new URL(result);
    assert.equal(parsed.pathname, "/maps/org/koleso/123/reviews/");
    assert.equal(parsed.searchParams.get("add-review"), "1");
  });

  it("returns null for maps homepage", () => {
    assert.equal(toYandexReviewSubmitUrl("https://yandex.ru/maps/"), null);
  });
});

describe("toTwoGisReviewSubmitUrl", () => {
  it("appends tab/reviews/addreview to a firm card", () => {
    assert.equal(
      toTwoGisReviewSubmitUrl("https://2gis.ru/moscow/firm/4504127908439511"),
      "https://2gis.ru/moscow/firm/4504127908439511/tab/reviews/addreview"
    );
  });

  it("returns null for a homepage", () => {
    assert.equal(toTwoGisReviewSubmitUrl("https://2gis.ru/"), null);
  });
});

describe("toAvitoReviewSubmitUrl", () => {
  it("returns null when there is no reviews path", () => {
    assert.equal(toAvitoReviewSubmitUrl("https://www.avito.ru/brands/foo"), null);
  });
});

describe("toPlatformReviewUrl", () => {
  it("falls back to the original URL when normalization fails", () => {
    assert.equal(toPlatformReviewUrl("YANDEX", "https://yandex.ru/maps/"), "https://yandex.ru/maps/");
    assert.equal(toPlatformReviewUrl("TWO_GIS", "https://2gis.ru/"), "https://2gis.ru/");
  });

  it("returns null for empty input", () => {
    assert.equal(toPlatformReviewUrl("YANDEX", null), null);
    assert.equal(toPlatformReviewUrl("YANDEX", "  "), null);
  });
});
