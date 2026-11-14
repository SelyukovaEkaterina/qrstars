import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseUserEvent, shouldMarkOnboardingCompleted } from "./user-events";

describe("shouldMarkOnboardingCompleted", () => {
  it("returns true for setup.completed without rerun", () => {
    assert.equal(shouldMarkOnboardingCompleted("setup.completed", { intent: "reviews" }), true);
  });

  it("returns false for setup.completed with rerun", () => {
    assert.equal(shouldMarkOnboardingCompleted("setup.completed", { rerun: true }), false);
  });

  it("returns false for other events", () => {
    assert.equal(shouldMarkOnboardingCompleted("setup.form_submitted", {}), false);
  });
});

describe("parseUserEvent", () => {
  it("accepts wizard and dashboard client events", () => {
    assert.equal(parseUserEvent({ event: "setup.completed" }).ok, true);
    assert.equal(
      parseUserEvent({ event: "dash.section_viewed", props: { section: "subscription" } }).ok,
      true
    );
    assert.equal(parseUserEvent({ event: "dash.upgrade_clicked" }).ok, true);
    assert.equal(parseUserEvent({ event: "dash.paywall_viewed" }).ok, true);
    assert.equal(parseUserEvent({ event: "dash.checkout_clicked" }).ok, true);
  });

  it("rejects server-only and unknown events", () => {
    assert.equal(parseUserEvent({ event: "dash.plan_limit_hit" }).ok, false);
    assert.equal(parseUserEvent({ event: "dash.qr_updated" }).ok, false);
    assert.equal(parseUserEvent({ event: "setup.unknown_event" }).ok, false);
  });
});
