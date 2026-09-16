import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  industryQrStylePreset,
  industryReviewCopy,
  inferIndustryFromUtm,
  parseEstablishmentIndustry,
} from "./establishment-industry";

describe("establishment industry", () => {
  it("infers industry from landing campaign names", () => {
    assert.equal(inferIndustryFromUtm("qr_kod_dlya_avtoservisa"), "AUTO");
    assert.equal(inferIndustryFromUtm("beauty_search"), "BEAUTY");
    assert.equal(inferIndustryFromUtm("stomatologiya"), "CLINIC");
    assert.equal(inferIndustryFromUtm("menu_search"), "HORECA");
  });

  it("rejects unknown values", () => {
    assert.equal(parseEstablishmentIndustry("AUTO"), "AUTO");
    assert.equal(parseEstablishmentIndustry("RETAIL"), null);
  });

  it("maps industry to existing QR presets", () => {
    assert.equal(industryQrStylePreset("AUTO"), "auto");
    assert.equal(industryQrStylePreset("CLINIC"), "dentistry");
    assert.equal(industryQrStylePreset(null), "classic");
  });

  it("uses non-restaurant review copy for auto businesses", () => {
    assert.equal(industryReviewCopy("AUTO").ratingQuestion, "Как вам обслуживание?");
    assert.doesNotMatch(industryReviewCopy("AUTO").commentPlaceholder, /блюд|заказ/i);
  });
});
