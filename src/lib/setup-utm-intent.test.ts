import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderSetupIntents,
  parseSetupUtmContext,
  resolveAutoSelectedIntent,
} from "./setup-utm-intent";

describe("resolveAutoSelectedIntent", () => {
  it("does not auto-select a scenario for UTM traffic", () => {
    assert.equal(resolveAutoSelectedIntent("menu_search", null), null);
    assert.equal(resolveAutoSelectedIntent(null, "menu_search"), null);
    assert.equal(resolveAutoSelectedIntent("my_menu_promo", null), null);
    assert.equal(resolveAutoSelectedIntent("reviews_search", null), null);
    assert.equal(resolveAutoSelectedIntent(null, null), null);
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
