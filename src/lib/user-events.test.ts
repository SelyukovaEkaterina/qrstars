import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldMarkOnboardingCompleted } from "./user-events";

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
