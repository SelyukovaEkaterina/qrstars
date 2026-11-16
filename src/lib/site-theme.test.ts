import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SITE_TEMPLATE_IDS } from "./site-templates";
import { buildSiteTokens, contrast } from "./site-theme";

const BRANDS = ["#4f46e5", "#0369a1", "#ea580c", "#059669", "#e11d48", "#7c3aed", "#db2777", "#facc15", "#111111", "#f5f5f5"];

describe("site theme", () => {
  for (const template of SITE_TEMPLATE_IDS) {
    for (const appearance of ["light", "dark"] as const) {
      it(`${template}/${appearance}: текст и акцент читаются`, () => {
        for (const brand of BRANDS) {
          const t = buildSiteTokens(template, brand, appearance);
          assert.ok(contrast(t.text, t.bg) >= 7, `text ${brand}`);
          assert.ok(contrast(t.muted, t.bg) >= 4.5, `muted ${brand}`);
          assert.ok(contrast(t.accentText, t.bg) >= 4.5, `accentText ${brand}`);
          assert.ok(contrast(t.onAccent, t.accent) >= 3, `onAccent ${brand}`);
        }
      });
    }
  }

  it("«Контраст» всегда тёмный", () => {
    assert.equal(buildSiteTokens("bold", "#4f46e5", "light").dark, true);
  });

  it("битый цвет не ломает палитру", () => {
    const t = buildSiteTokens("classic", "red", "light");
    assert.equal(t.accent, "#4f46e5");
  });
});
