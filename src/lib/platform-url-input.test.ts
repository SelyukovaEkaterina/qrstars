import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePlatformUrlField, PLATFORM_URL_INVALID_ERROR, toSafeHttpUrl } from "./platform-url-input";
import { toPlatformReviewUrl } from "./review-platform-url";
import { parseReviewRouting } from "./review-routing";

describe("toSafeHttpUrl", () => {
  it("keeps http(s) and adds https to bare domains", () => {
    assert.equal(toSafeHttpUrl("https://2gis.ru/moscow/firm/123"), "https://2gis.ru/moscow/firm/123");
    assert.equal(toSafeHttpUrl("  avito.ru/brands/x  "), "https://avito.ru/brands/x");
  });

  it("rejects other schemes and relative paths", () => {
    for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "vbscript:x", "/q/abc", "", 42]) {
      assert.equal(toSafeHttpUrl(bad), null, String(bad));
    }
  });
});

describe("parsePlatformUrlField", () => {
  it("distinguishes untouched, cleared, saved and invalid", () => {
    assert.equal(parsePlatformUrlField(undefined), undefined);
    assert.equal(parsePlatformUrlField(null), null);
    assert.equal(parsePlatformUrlField("  "), null);
    assert.equal(parsePlatformUrlField("2gis.ru/firm/1"), "https://2gis.ru/firm/1");
    assert.deepEqual(parsePlatformUrlField("javascript:alert(1)"), { error: PLATFORM_URL_INVALID_ERROR });
    assert.deepEqual(parsePlatformUrlField({}), { error: PLATFORM_URL_INVALID_ERROR });
  });
});

describe("toPlatformReviewUrl", () => {
  it("does not fall back to a javascript: URL from the DB", () => {
    assert.equal(toPlatformReviewUrl("AVITO", "javascript:alert(document.cookie)"), null);
    assert.equal(toPlatformReviewUrl("TWO_GIS", "javascript:alert(1)"), null);
    assert.equal(toPlatformReviewUrl("CUSTOM", "javascript:alert(1)"), null);
  });

  it("still builds review-form URLs and falls back to http(s) originals", () => {
    assert.equal(
      toPlatformReviewUrl("TWO_GIS", "https://2gis.ru/moscow/firm/70000001"),
      "https://2gis.ru/moscow/firm/70000001/tab/reviews/addreview",
    );
    assert.equal(toPlatformReviewUrl("AVITO", "https://www.avito.ru/brands/i1"), "https://www.avito.ru/brands/i1");
  });
});

describe("parseReviewRouting custom platforms", () => {
  it("drops custom platforms with non-http URLs", () => {
    const routing = parseReviewRouting({
      5: {
        action: "CUSTOM",
        platformList: [
          { type: "CUSTOM", id: "a", name: "Bad", url: "javascript:alert(1)" },
          { type: "CUSTOM", id: "b", name: "Good", url: "flamp.ru/firm/x" },
        ],
      },
    });
    const list = JSON.stringify(routing);
    assert.ok(!list.includes("javascript:"));
    assert.ok(list.includes("https://flamp.ru/firm/x"));
  });
});
