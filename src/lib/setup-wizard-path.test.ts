import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSetupRedirectExemptPath, isSetupWizardPath } from "./setup-wizard-path";

describe("isSetupWizardPath", () => {
  it("matches the wizard and its subpaths", () => {
    assert.equal(isSetupWizardPath("/dashboard/start"), true);
    assert.equal(isSetupWizardPath("/dashboard/start/step"), true);
  });

  it("does not match other dashboard pages", () => {
    assert.equal(isSetupWizardPath("/dashboard/projects"), false);
    assert.equal(isSetupWizardPath(null), false);
  });
});

describe("isSetupRedirectExemptPath", () => {
  it("lets the user reach billing, settings, support, partner and activation", () => {
    for (const path of [
      "/dashboard/subscription",
      "/dashboard/settings",
      "/dashboard/settings/templates",
      "/dashboard/support",
      "/dashboard/partner",
      "/dashboard/activate",
    ]) {
      assert.equal(isSetupRedirectExemptPath(path), true, path);
    }
  });

  it("still sends new users to the wizard from project pages", () => {
    assert.equal(isSetupRedirectExemptPath("/dashboard/projects"), false);
    assert.equal(isSetupRedirectExemptPath("/dashboard/qrcodes"), false);
  });
});
