import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TWO_GIS_URL_INVALID_ERROR,
  TWO_GIS_URL_REQUIRED_ERROR,
  normalizeTwoGisUrl,
  twoGisUrlError,
  utmPointsToTwoGis,
} from "./two-gis-url";
import { defaultReviewRoutingFor, effectiveReviewRouting, DEFAULT_REVIEW_ROUTING } from "./review-routing";

describe("normalizeTwoGisUrl", () => {
  it("keeps city and firm id, drops coordinates, search path and query", () => {
    assert.equal(
      normalizeTwoGisUrl("https://2gis.ru/moscow/firm/70000001012345678/37.6,55.7?m=1"),
      "https://2gis.ru/moscow/firm/70000001012345678"
    );
    assert.equal(
      normalizeTwoGisUrl("2gis.ru/spb/search/кафе/firm/5348552838612345/30.3,59.9"),
      "https://2gis.ru/spb/firm/5348552838612345"
    );
    assert.equal(normalizeTwoGisUrl("https://2gis.kz/firm/123"), "https://2gis.kz/firm/123");
  });

  it("accepts go.2gis.com short links from «Поделиться»", () => {
    assert.equal(normalizeTwoGisUrl("https://go.2gis.com/abc12/"), "https://go.2gis.com/abc12");
  });

  it("rejects search, buildings, homepage and other hosts", () => {
    assert.equal(normalizeTwoGisUrl("https://2gis.ru/moscow/search/кафе"), null);
    assert.equal(normalizeTwoGisUrl("https://2gis.ru/moscow/geo/4504235282712345"), null);
    assert.equal(normalizeTwoGisUrl("https://2gis.ru/"), null);
    assert.equal(normalizeTwoGisUrl("https://go.2gis.com/"), null);
    assert.equal(normalizeTwoGisUrl("https://evil2gis.ru/moscow/firm/1"), null);
    assert.equal(normalizeTwoGisUrl("javascript:alert(1)"), null);
  });

  it("returns readable errors", () => {
    assert.equal(twoGisUrlError(""), TWO_GIS_URL_REQUIRED_ERROR);
    assert.equal(twoGisUrlError("https://2gis.ru/moscow"), TWO_GIS_URL_INVALID_ERROR);
    assert.equal(twoGisUrlError("https://2gis.ru/moscow/firm/1"), null);
  });

  it("detects 2GIS in UTM", () => {
    assert.equal(utmPointsToTwoGis("reviews_landing", "2gis"), true);
    assert.equal(utmPointsToTwoGis("reviews_landing", "blog-qr-kod-dlya-otzyvov-2gis"), true);
    assert.equal(utmPointsToTwoGis("reviews_landing", "hero", null), false);
  });
});

describe("defaultReviewRoutingFor", () => {
  it("routes 4–5★ to 2GIS only when Yandex is missing", () => {
    const twoGisOnly = defaultReviewRoutingFor({ yandexMapsUrl: null, twoGisUrl: "https://2gis.ru/firm/1" });
    assert.equal(twoGisOnly[5].action, "TWO_GIS");
    assert.deepEqual(twoGisOnly[4].platformList, [{ type: "TWO_GIS" }]);
    assert.equal(twoGisOnly[2].action, "COMPLAINT");

    const both = defaultReviewRoutingFor({ yandexMapsUrl: "https://yandex.ru/maps/org/x/1/", twoGisUrl: "https://2gis.ru/firm/1" });
    assert.equal(both, DEFAULT_REVIEW_ROUTING);
    assert.equal(defaultReviewRoutingFor({ yandexMapsUrl: null, twoGisUrl: null }), DEFAULT_REVIEW_ROUTING);
  });

  it("ignores saved scenarios on FREE but keeps them on PRO", () => {
    const saved = { "5": { action: "THANKS" } };
    const urls = { yandexMapsUrl: null, twoGisUrl: "https://2gis.ru/firm/1" };
    assert.equal(effectiveReviewRouting(false, saved, urls)[5].action, "TWO_GIS");
    assert.equal(effectiveReviewRouting(true, saved, urls)[5].action, "THANKS");
    assert.equal(effectiveReviewRouting(true, null, urls)[5].action, "TWO_GIS");
  });
});
