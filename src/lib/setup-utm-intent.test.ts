import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderSetupIntents,
  parseSetupUtmContext,
  resolveAutoSelectedIntent,
} from "./setup-utm-intent";

describe("resolveAutoSelectedIntent", () => {
  it("auto-selects only from explicit intent query", () => {
    assert.equal(resolveAutoSelectedIntent("menu_search", null, "redirect"), "redirect");
    assert.equal(resolveAutoSelectedIntent(null, null, "menu"), "menu");
    assert.equal(resolveAutoSelectedIntent("reviews_search", null, "reviews"), "reviews");
    assert.equal(resolveAutoSelectedIntent(null, null, "unknown"), null);
  });
});

describe("parseSetupUtmContext", () => {
  it("keeps menu hint for campaigns containing menu", () => {
    const ctx = parseSetupUtmContext("my_menu_promo", null);
    assert.equal(ctx.hint, "menu");
    assert.equal(resolveAutoSelectedIntent("my_menu_promo", null), null);
  });

  it("orders menu first for menu_search hint", () => {
    const ordered = orderSetupIntents(
      ["reviews", "landing", "redirect", "menu"],
      parseSetupUtmContext("menu_search", null).hint
    );
    assert.deepEqual(ordered[0], "menu");
  });
});
