import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultReviewRoutingFor, starsMissingPlatformLinks } from "./review-routing";

const none = { yandexMapsUrl: null, twoGisUrl: null, avitoUrl: null };

describe("starsMissingPlatformLinks", () => {
  it("без ссылок 4–5★ упираются в тупик", () => {
    assert.deepEqual(starsMissingPlatformLinks(defaultReviewRoutingFor(none), none), [4, 5]);
  });

  it("с Яндексом всё в порядке", () => {
    const urls = { ...none, yandexMapsUrl: "https://yandex.ru/maps/org/cafe/123/" };
    assert.deepEqual(starsMissingPlatformLinks(defaultReviewRoutingFor(urls), urls), []);
  });

  it("с одним 2GIS стандартный сценарий ведёт в 2GIS", () => {
    const urls = { ...none, twoGisUrl: "https://2gis.ru/moscow/firm/70000001000000" };
    assert.deepEqual(starsMissingPlatformLinks(defaultReviewRoutingFor(urls), urls), []);
  });
});
