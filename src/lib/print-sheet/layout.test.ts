import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRINT_DESIGNS,
  PRINT_FORMATS,
  PRINT_TEXT_PRESETS,
  buildSheetLayout,
  defaultPrintSettings,
  exportDpi,
  findPrintFormat,
  sanitizePrintSettings,
  scenarioForMode,
  type Orientation,
  type PrintOutput,
} from "./layout";
import { contrastRatio } from "./render";

const EPS = 1e-6;

describe("print-sheet layout", () => {
  it("id форматов и дизайнов уникальны", () => {
    assert.equal(new Set(PRINT_FORMATS.map((f) => f.id)).size, PRINT_FORMATS.length);
    assert.equal(new Set(PRINT_DESIGNS.map((d) => d.id)).size, PRINT_DESIGNS.length);
  });

  it("таблички не выходят за лист и не пересекаются", () => {
    for (const format of PRINT_FORMATS) {
      for (const orientation of ["portrait", "landscape"] as Orientation[]) {
        for (const output of ["sheet", "exact"] as PrintOutput[]) {
          const l = buildSheetLayout(format, orientation, output);
          assert.ok(l.items.length > 0, `${format.id}: пустой лист`);
          for (const it of l.items) {
            assert.ok(it.x >= -EPS && it.y >= -EPS, `${format.id}: отрицательные координаты`);
            assert.ok(it.x + it.w <= l.pageWMm + EPS, `${format.id}: вылез вправо`);
            assert.ok(it.y + it.h <= l.pageHMm + EPS, `${format.id}: вылез вниз`);
          }
          for (let i = 0; i < l.items.length; i++) {
            for (let j = i + 1; j < l.items.length; j++) {
              const a = l.items[i];
              const b = l.items[j];
              const overlap =
                a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
              assert.ok(!overlap, `${format.id}: таблички ${i} и ${j} пересекаются`);
            }
          }
        }
      }
    }
  });

  it("A6 — 4 шт. на A4, A5 — 2 шт., стикеры 5 см — больше 10", () => {
    assert.equal(buildSheetLayout(findPrintFormat("a6"), "portrait", "sheet").items.length, 4);
    assert.equal(buildSheetLayout(findPrintFormat("a6"), "landscape", "sheet").items.length, 4);
    assert.equal(buildSheetLayout(findPrintFormat("a5"), "portrait", "sheet").items.length, 2);
    assert.equal(buildSheetLayout(findPrintFormat("a5"), "landscape", "sheet").items.length, 2);
    assert.equal(buildSheetLayout(findPrintFormat("sticker-50"), "portrait", "sheet").items.length, 15);
    assert.equal(buildSheetLayout(findPrintFormat("sticker-60"), "portrait", "sheet").items.length, 12);
    assert.equal(buildSheetLayout(findPrintFormat("sticker-90"), "portrait", "sheet").items.length, 6);
  });

  it("книжная A5 на листе сохраняет пропорции A5", () => {
    const l = buildSheetLayout(findPrintFormat("a5"), "portrait", "sheet");
    const it = l.items[0];
    assert.ok(it.h > it.w);
    assert.ok(Math.abs(it.w / it.h - 148 / 210) < 0.01);
  });

  it("для типографии — точный формат и вылеты", () => {
    const l = buildSheetLayout(findPrintFormat("a5"), "landscape", "exact");
    assert.equal(l.bleedMm, 2);
    assert.equal(l.pageWMm, 210 + 4);
    assert.equal(l.pageHMm, 148 + 4);
    assert.deepEqual(l.items, [{ x: 2, y: 2, w: 210, h: 148 }]);
  });

  it("домик: верхняя панель перевёрнута, есть линия сгиба", () => {
    for (const id of ["tent-a5", "tent-a6"]) {
      const l = buildSheetLayout(findPrintFormat(id), "portrait", "exact");
      assert.equal(l.bleedMm, 0, "домик всегда на листе");
      assert.ok(l.foldLines.length > 0);
      const top = l.items.filter((i) => i.rotate180);
      assert.equal(top.length, l.items.length / 2);
      for (const t of top) assert.ok(t.y < l.pageHMm / 2);
    }
  });

  it("dpi ограничен 300 и размером canvas", () => {
    assert.equal(exportDpi(105, 148), 300);
    const a3 = exportDpi(297, 420);
    assert.ok(a3 < 300 && a3 >= 200);
    const px = ((297 / 25.4) * a3) * ((420 / 25.4) * a3);
    assert.ok(px <= 15_000_000);
  });

  it("режимы QR → сценарии текстов", () => {
    assert.equal(scenarioForMode("REVIEW"), "REVIEW");
    assert.equal(scenarioForMode("REDIRECT"), "LINK");
    assert.equal(scenarioForMode("CUSTOM_SECTION"), "LINK");
    assert.equal(scenarioForMode(null), "LINK");
    for (const presets of Object.values(PRINT_TEXT_PRESETS)) {
      assert.ok(presets.length > 0);
      for (const p of presets) assert.ok(p.title.trim().length > 0);
    }
  });

  it("настройки по умолчанию и чистка мусора из localStorage", () => {
    const def = defaultPrintSettings("REVIEW", "#abc");
    assert.equal(def.accent, "#AABBCC");
    assert.equal(def.showStars, true);
    assert.equal(defaultPrintSettings("MENU", "bad").showStars, false);

    const s = sanitizePrintSettings(
      { formatId: "zzz", design: "neon", accent: "red", title: "x".repeat(500), showLogo: false, orientation: 1 },
      def,
    );
    assert.equal(s.formatId, def.formatId);
    assert.equal(s.design, def.design);
    assert.equal(s.accent, def.accent);
    assert.equal(s.title.length, 80);
    assert.equal(s.showLogo, false);
    assert.equal(s.orientation, "portrait");
    assert.deepEqual(sanitizePrintSettings(null, def), def);
  });

  it("contrastRatio: белый на чёрном = 21", () => {
    assert.ok(Math.abs(contrastRatio("#FFFFFF", "#000000") - 21) < 0.01);
  });
});
