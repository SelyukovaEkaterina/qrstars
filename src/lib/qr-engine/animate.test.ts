import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ensureContrast, flowPalette, isQrAnimationId, QR_ANIMATIONS } from "./animate";
import { contrastRatio, MIN_QR_CONTRAST } from "./palette";

const design = (over: Partial<Parameters<typeof flowPalette>[0]> = {}) => ({
  fg: "#000000",
  bg: "#ffffff",
  bgTransparent: false,
  gradient: false,
  grad1: "#000000",
  grad2: "#000000",
  ...over,
});

describe("qr-engine animate", () => {
  it("has unique animation ids", () => {
    const ids = QR_ANIMATIONS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(isQrAnimationId("shine"));
    assert.ok(!isQrAnimationId("explode"));
  });

  it("keeps flow colors readable on light and dark backgrounds", () => {
    const cases = [
      design(),
      design({ fg: "#e11d48" }),
      design({ fg: "#fde047" }),
      design({ gradient: true, grad1: "#7c3aed", grad2: "#06b6d4" }),
      design({ fg: "#f8fafc", bg: "#0f172a" }),
      design({ fg: "#22c55e", bgTransparent: true }),
    ];
    for (const d of cases) {
      const bg = d.bgTransparent ? "#ffffff" : d.bg;
      const colors = flowPalette(d);
      assert.equal(colors.length, 4);
      for (const c of colors) assert.ok(contrastRatio(c, bg) >= MIN_QR_CONTRAST, `${c} on ${bg}`);
    }
  });

  it("ensureContrast darkens on light bg and lightens on dark bg", () => {
    const onLight = ensureContrast("#facc15", "#ffffff");
    assert.ok(contrastRatio(onLight, "#ffffff") >= MIN_QR_CONTRAST);
    const onDark = ensureContrast("#1e3a8a", "#000000");
    assert.ok(contrastRatio(onDark, "#000000") >= MIN_QR_CONTRAST);
    assert.equal(ensureContrast("#000000", "#ffffff"), "#000000");
  });
});

describe("qr-engine social handle", () => {
  it("adds @ to a single-word handle and keeps channel names", async () => {
    const { formatSocialHandle } = await import("./animate");
    assert.equal(formatSocialHandle("qrstars"), "@qrstars");
    assert.equal(formatSocialHandle("@qrstars"), "@qrstars");
    assert.equal(formatSocialHandle("  Кофе у Ани  "), "Кофе у Ани");
    assert.equal(formatSocialHandle("ivan_petrov.tv"), "@ivan_petrov.tv");
    assert.equal(formatSocialHandle(""), "");
    assert.ok(formatSocialHandle("x".repeat(80)).length <= 33);
  });
});
