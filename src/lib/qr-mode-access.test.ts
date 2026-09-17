import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LANDING_UPGRADE_ERROR,
  canAssignLandingMode,
  canViewLandingPage,
  isMicrositeFrozen,
} from "./qr-mode-access";

describe("canAssignLandingMode", () => {
  it("allows non-LANDING modes on FREE", () => {
    for (const mode of ["REVIEW", "MENU", "REDIRECT", "BUSINESS_CARD", "WIFI"]) {
      const result = canAssignLandingMode({
        nextMode: mode,
        hasPaidFeatures: false,
      });
      assert.equal(result.ok, true);
    }
  });

  it("blocks creating LANDING on FREE", () => {
    const result = canAssignLandingMode({
      nextMode: "LANDING",
      previousMode: null,
      hasPaidFeatures: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, LANDING_UPGRADE_ERROR);
      assert.equal(result.upgradeRequired, "PRO");
    }
  });

  it("blocks switching REVIEW → LANDING on FREE", () => {
    const result = canAssignLandingMode({
      nextMode: "LANDING",
      previousMode: "REVIEW",
      grandfathered: false,
      hasPaidFeatures: false,
    });
    assert.equal(result.ok, false);
  });

  it("allows creating LANDING on paid plans", () => {
    const result = canAssignLandingMode({
      nextMode: "LANDING",
      previousMode: null,
      hasPaidFeatures: true,
    });
    assert.equal(result.ok, true);
  });

  it("allows keeping an existing LANDING while editing on FREE", () => {
    const result = canAssignLandingMode({
      nextMode: "LANDING",
      previousMode: "LANDING",
      grandfathered: false,
      hasPaidFeatures: false,
    });
    assert.equal(result.ok, true);
  });

  it("allows switching back to LANDING on a grandfathered QR", () => {
    const result = canAssignLandingMode({
      nextMode: "LANDING",
      previousMode: "REVIEW",
      grandfathered: true,
      hasPaidFeatures: false,
    });
    assert.equal(result.ok, true);
  });
});

describe("canViewLandingPage", () => {
  it("shows LANDING for paid plans", () => {
    assert.equal(
      canViewLandingPage({ hasPaidFeatures: true, grandfathered: false }),
      true
    );
  });

  it("shows grandfathered LANDING on FREE", () => {
    assert.equal(
      canViewLandingPage({ hasPaidFeatures: false, grandfathered: true }),
      true
    );
  });

  it("hides a new LANDING after the paid plan expires", () => {
    assert.equal(
      canViewLandingPage({ hasPaidFeatures: false, grandfathered: false }),
      false
    );
  });

  it("keeps LANDING published after the PRO trial ends", () => {
    assert.equal(
      canViewLandingPage({
        hasPaidFeatures: false,
        grandfathered: false,
        hadPaidAccess: true,
      }),
      true
    );
  });

  it("keeps LANDING published for former paying owners", () => {
    assert.equal(
      canViewLandingPage({
        hasPaidFeatures: false,
        grandfathered: false,
        hadPaidAccess: true,
      }),
      true
    );
  });
});

describe("isMicrositeFrozen", () => {
  it("freezes microsite settings on FREE after paid access ends", () => {
    assert.equal(
      isMicrositeFrozen({ hasPaidFeatures: false, hadPaidAccess: true }),
      true
    );
  });

  it("does not freeze while PRO is active", () => {
    assert.equal(
      isMicrositeFrozen({ hasPaidFeatures: true, hadPaidAccess: true }),
      false
    );
  });

  it("does not freeze grandfathered microsites", () => {
    assert.equal(
      isMicrositeFrozen({
        hasPaidFeatures: false,
        grandfathered: true,
        hadPaidAccess: true,
      }),
      false
    );
  });

  it("does not freeze FREE users who never had paid access", () => {
    assert.equal(
      isMicrositeFrozen({ hasPaidFeatures: false, hadPaidAccess: false }),
      false
    );
  });
});
