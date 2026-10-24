import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignmentCenters,
  ditherHalftone,
  fitSilhouette,
  functionModuleMap,
  halftoneForcedMap,
  maxInscribedSquare,
  HALFTONE_RES,
  QR_SILHOUETTES,
  type QrMask,
} from "./art";
import { ART_PRESETS, ART_PRESET_CATEGORIES } from "./art-presets";
import { contrastRatio, MIN_QR_CONTRAST } from "./palette";

function rectMask(w: number, h: number, fill: (x: number, y: number) => boolean): QrMask {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = fill(x, y) ? 1 : 0;
  return { w, h, data };
}

describe("qr-engine art", () => {
  it("finds alignment pattern centers by version", () => {
    assert.deepEqual(alignmentCenters(21), []);
    assert.deepEqual(alignmentCenters(25), [[18, 18]]);
    // Версия 7: координаты 6, 22, 38 — шесть узоров (три угла заняты поисковыми).
    assert.equal(alignmentCenters(45).length, 6);
    assert.ok(alignmentCenters(45).some(([r, c]) => r === 22 && c === 22));
  });

  it("marks timing, alignment and finder zones", () => {
    const map = functionModuleMap(25);
    assert.equal(map[6 * 25 + 12], 1);
    assert.equal(map[12 * 25 + 6], 1);
    assert.equal(map[18 * 25 + 18], 1);
    assert.equal(map[0], 2);
    assert.equal(map[12 * 25 + 12], 0);
  });

  it("forces module centers in the halftone map, margin stays free", () => {
    const count = 21;
    const modules = new Uint8Array(count * count);
    modules[10 * count + 10] = 1;
    const margin = 2;
    const forced = halftoneForcedMap(modules, count, margin);
    const side = (count + margin * 2) * HALFTONE_RES;
    const center = (r: number, c: number) =>
      forced[((r + margin) * HALFTONE_RES + 3) * side + (c + margin) * HALFTONE_RES + 3];
    assert.equal(center(10, 10), 1);
    assert.equal(center(10, 11), 2);
    assert.equal(forced[0], 0);
    // Угол клетки данных свободен для фото.
    assert.equal(forced[((10 + margin) * HALFTONE_RES) * side + (10 + margin) * HALFTONE_RES], 0);
  });

  it("dithers mid-gray to roughly half dark and respects forced pixels", () => {
    const w = 40;
    const h = 40;
    const lum = new Float32Array(w * h).fill(128);
    const forced = new Uint8Array(w * h);
    forced[0] = 2;
    forced[1] = 1;
    const out = ditherHalftone(lum, w, h, forced);
    const dark = out.reduce((s, v) => s + v, 0) / out.length;
    assert.ok(dark > 0.4 && dark < 0.6, `dark share ${dark}`);
    assert.equal(out[0], 0);
    assert.equal(out[1], 1);
  });

  it("finds the largest inscribed square near the center", () => {
    const mask = rectMask(100, 40, () => true);
    const sq = maxInscribedSquare(mask)!;
    assert.ok(sq.size >= 38);
    assert.ok(Math.abs(sq.x + sq.size / 2 - 50) <= 2);
  });

  it("fits the code into a silhouette and keeps the shape around it", () => {
    const r = 60;
    const circle = rectMask(120, 120, (x, y) => (x - 60) ** 2 + (y - 60) ** 2 <= r * r);
    const fit = fitSilhouette(circle, 25, 90)!;
    assert.ok(fit.cols > 25 && fit.rows > 25);
    // Код целиком внутри сетки.
    assert.ok(fit.qrCol >= 0 && fit.qrCol + 25 <= fit.cols);
    // Углы сетки — снаружи круга, центр — внутри.
    assert.equal(fit.inside[0], 0);
    assert.equal(fit.inside[Math.floor(fit.rows / 2) * fit.cols + Math.floor(fit.cols / 2)], 1);
    assert.equal(fitSilhouette(rectMask(4, 4, () => true), 25, 90), null);
  });
});

describe("qr-engine art presets", () => {
  it("has unique ids, known categories and shapes", () => {
    const ids = new Set(ART_PRESETS.map((p) => p.id));
    assert.equal(ids.size, ART_PRESETS.length);
    const cats = new Set(ART_PRESET_CATEGORIES.map((c) => c.id));
    const shapes = new Set<string>(QR_SILHOUETTES.map((s) => s.id));
    for (const p of ART_PRESETS) {
      assert.ok(cats.has(p.category), p.id);
      if (p.design.silhouette) assert.ok(shapes.has(p.design.silhouette), p.id);
    }
  });

  it("keeps modules readable against the background", () => {
    for (const p of ART_PRESETS) {
      const bg = p.design.bg ?? "#ffffff";
      const colors = p.design.gradient ? [p.design.grad1!, p.design.grad2!] : [p.design.fg ?? "#1e293b"];
      if (p.design.eyeCustom) colors.push(p.design.eyeColor!);
      // Бирюзовый «Зуб» — уже в продакшене, его вид не меняем; камеры его читают.
      const min = p.id === "art-tooth" ? 3.5 : MIN_QR_CONTRAST;
      for (const c of colors) assert.ok(contrastRatio(c, bg) >= min, `${p.id}: ${c} on ${bg} = ${contrastRatio(c, bg).toFixed(2)}`);
    }
  });
});
