import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderSetupIntents,
  parseSetupUtmContext,
  resolveAutoSelectedIntent,
} from "./setup-utm-intent";

describe("resolveAutoSelectedIntent", () => {
  it("auto-selects menu for menu_search campaign", () => {
    assert.equal(resolveAutoSelectedIntent("menu_search", null), "menu");
    assert.equal(resolveAutoSelectedIntent("MENU_SEARCH", null), "menu");
  });

  it("auto-selects menu when menu_search is in utm_content", () => {
    assert.equal(resolveAutoSelectedIntent(null, "menu_search"), "menu");
  });

  it("does not auto-select for broad menu hint campaigns", () => {
    assert.equal(resolveAutoSelectedIntent("my_menu_promo", null), null);
    assert.equal(resolveAutoSelectedIntent("reviews_search", null), null);
    assert.equal(resolveAutoSelectedIntent(null, null), null);
  });
});

describe("parseSetupUtmContext vs auto-select", () => {
  it("keeps menu hint for campaigns containing menu without auto-select", () => {
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
