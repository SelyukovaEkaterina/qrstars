import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEMPLATE_ROUTES, templateSettingsPath } from "./template-routes";

describe("template routes", () => {
  it("keeps QR styles under account settings", () => {
    assert.equal(TEMPLATE_ROUTES.qr, "/dashboard/settings/templates");
    assert.equal(TEMPLATE_ROUTES.tableTents, "/dashboard/settings/templates");
  });

  it("preserves bindQr when moving old template urls", () => {
    assert.equal(
      templateSettingsPath({ bindQr: "qr1", tab: "old" }, ["tab"]),
      "/dashboard/settings/templates?bindQr=qr1",
    );
  });
});
