import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countStarterMenuItems, STARTER_MENU_ITEMS, starterMenuCreateInput } from "./setup-starter-menu";
import { parseUserEvent } from "./user-events";

describe("starter menu", () => {
  it("counts untouched demo items by name", () => {
    assert.equal(countStarterMenuItems(STARTER_MENU_ITEMS), STARTER_MENU_ITEMS.length);
    assert.equal(countStarterMenuItems([{ name: " Суп дня " }, { name: "Борщ" }]), 1);
    assert.equal(countStarterMenuItems([]), 0);
  });

  it("does not show owner hints to guests", () => {
    const input = starterMenuCreateInput("est", "Кафе");
    assert.equal(input.description, null);
    for (const item of STARTER_MENU_ITEMS) {
      assert.doesNotMatch(item.description, /кабинет|редактор|Микросайт/i);
    }
  });
});

describe("setup events allowlist", () => {
  it("accepts wizard diagnostics events", () => {
    for (const event of ["setup.wizard_dismissed", "setup.form_failed", "setup.alternative_clicked"]) {
      assert.equal(parseUserEvent({ event, props: {} }).ok, true, event);
    }
    assert.equal(parseUserEvent({ event: "dash.menu_saved" }).ok, false);
  });
});
