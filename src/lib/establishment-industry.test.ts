import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  industryQrStylePreset,
  industryReviewCopy,
  professionQrStylePreset,
  inferIndustryFromUtm,
  parseEstablishmentIndustry,
} from "./establishment-industry";

describe("establishment industry", () => {
  it("infers industry from landing campaign names", () => {
    assert.equal(inferIndustryFromUtm("qr_kod_dlya_avtoservisa"), "AUTO");
    assert.equal(inferIndustryFromUtm("beauty_search"), "BEAUTY");
    assert.equal(inferIndustryFromUtm("stomatologiya"), "CLINIC");
    assert.equal(inferIndustryFromUtm("menu_search"), "HORECA");
    assert.equal(inferIndustryFromUtm("car_service"), "AUTO");
    assert.equal(inferIndustryFromUtm("carwash"), "AUTO");
  });

  it("does not treat business-card campaigns as auto", () => {
    assert.equal(inferIndustryFromUtm("master_card"), "SERVICES");
    assert.equal(inferIndustryFromUtm("main_landing", "card_maker"), null);
    assert.equal(inferIndustryFromUtm("vizitka", "card_maker_cta"), null);
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

  it("picks master art style by profession", () => {
    assert.equal(professionQrStylePreset("Электрик"), "master-electric");
    assert.equal(professionQrStylePreset("сантехник, аварийный выезд"), "master-plumber");
    assert.equal(professionQrStylePreset("Муж на час"), "master-handyman");
    assert.equal(professionQrStylePreset("Ремонт бытовой техники"), "master-repair");
    assert.equal(professionQrStylePreset("Плиточник"), "master-build");
    assert.equal(professionQrStylePreset("Репетитор"), null);
    assert.equal(professionQrStylePreset("Мастер маникюра"), null);
    assert.equal(professionQrStylePreset(""), null);
  });
});
