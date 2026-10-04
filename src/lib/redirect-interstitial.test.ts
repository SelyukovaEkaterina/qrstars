import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  redirectInterstitialPromoUrl,
  redirectTargetLabel,
  shouldShowRedirectInterstitial,
} from "./redirect-interstitial";

describe("shouldShowRedirectInterstitial", () => {
  it("shows the screen only for new QR codes of FREE owners", () => {
    assert.equal(
      shouldShowRedirectInterstitial({ hasPaidPlan: false, grandfathered: false, hasOwner: true }),
      true
    );
  });

  it("skips paid plans, grandfathered codes and codes without owner", () => {
    assert.equal(
      shouldShowRedirectInterstitial({ hasPaidPlan: true, grandfathered: false, hasOwner: true }),
      false
    );
    assert.equal(
      shouldShowRedirectInterstitial({ hasPaidPlan: false, grandfathered: true, hasOwner: true }),
      false
    );
    assert.equal(
      shouldShowRedirectInterstitial({ hasPaidPlan: false, grandfathered: false, hasOwner: false }),
      false
    );
  });
});

describe("redirectInterstitialPromoUrl", () => {
  it("tags the landing link with interstitial UTM", () => {
    const url = new URL(redirectInterstitialPromoUrl("abc123"));
    assert.equal(url.origin, "https://qrstars.ru");
    assert.equal(url.searchParams.get("utm_source"), "qr_interstitial");
    assert.equal(url.searchParams.get("utm_campaign"), "free_redirect");
    assert.equal(url.searchParams.get("utm_content"), "abc123");
  });
});

describe("redirectTargetLabel", () => {
  it("returns a bare host for web links", () => {
    assert.equal(redirectTargetLabel("https://www.rutube.ru/video/1"), "rutube.ru");
    assert.equal(redirectTargetLabel("https://2gis.ru/moscow/firm/1"), "2gis.ru");
  });

  it("returns null for non-web or relative targets", () => {
    assert.equal(redirectTargetLabel("tel:+79990000000"), null);
    assert.equal(redirectTargetLabel("/activate/abc"), null);
  });
});
