import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildQrStlModel,
  crc32,
  encodeBinaryStl,
  meshVolume,
  qrStlModuleMm,
  zipStore,
  type QrStlOptions,
} from "./stl";
import type { QrModules } from "./types";

/** Псевдо-QR 21×21 с шахматными пятнами — разные соседства модулей. */
function fakeModules(size = 21): QrModules {
  const data = new Uint8Array(size * size);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) data[r * size + c] = (r * 7 + c * 3 + ((r * c) % 5)) % 3 === 0 ? 1 : 0;
  // Глазок: сплошной квадрат 7×7 с дыркой.
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) data[r * size + c] = r === 0 || r === 6 || c === 0 || c === 6 || (r > 1 && r < 5 && c > 1 && c < 5) ? 1 : 0;
  return { size, data };
}

/** Каждое направленное ребро встречается один раз, и обратное ему — тоже один раз. */
function assertClosed(tris: Float32Array, label: string) {
  const key = (p: number) => `${tris[p].toFixed(4)},${tris[p + 1].toFixed(4)},${tris[p + 2].toFixed(4)}`;
  const edges = new Map<string, number>();
  for (let t = 0; t < tris.length; t += 9) {
    const v = [key(t), key(t + 3), key(t + 6)];
    for (let i = 0; i < 3; i++) {
      const e = `${v[i]}>${v[(i + 1) % 3]}`;
      edges.set(e, (edges.get(e) ?? 0) + 1);
    }
  }
  for (const [e, n] of edges) {
    assert.equal(n, 1, `${label}: ребро ${e} встречается ${n} раз`);
    const [a, b] = e.split(">");
    assert.equal(edges.get(`${b}>${a}`), 1, `${label}: у ребра ${e} нет пары`);
  }
}

describe("qr-engine stl", () => {
  const variants: Partial<QrStlOptions>[] = [
    { style: "raised" },
    { style: "engraved" },
    { style: "raised", margin: 1, baseMm: 1.2, reliefMm: 0.6 },
  ];

  for (const v of variants) {
    it(`builds watertight meshes (${JSON.stringify(v)})`, () => {
      const m = buildQrStlModel(fakeModules(), v);
      assertClosed(m.single, "single");
      for (const p of m.parts) assertClosed(p.triangles, p.name);
      assert.ok(meshVolume(m.single) > 0, "нормали наружу");
      const partsVolume = m.parts.reduce((s, p) => s + meshVolume(p.triangles), 0);
      assert.ok(Math.abs(partsVolume - meshVolume(m.single)) < 1e-3 * meshVolume(m.single), "две детали = одно тело");
    });
  }

  it("keyring ring is a closed separate shell and extends the depth", () => {
    const m = buildQrStlModel(fakeModules(), { keyring: true, sizeMm: 40 });
    assertClosed(m.single, "single+ring");
    assert.ok(m.depthMm > 40);
  });

  it("has expected volume for raised style", () => {
    const modules = fakeModules();
    const o = { sizeMm: 50, baseMm: 2, reliefMm: 1, margin: 2, style: "raised" as const };
    const m = buildQrStlModel(modules, o);
    let dark = 0;
    for (let i = 0; i < modules.data.length; i++) if (modules.data[i]) dark++;
    const cell = qrStlModuleMm(modules, o);
    const expected = 50 * 50 * 2 + dark * cell * cell * 1;
    assert.ok(Math.abs(meshVolume(m.single) - expected) < 2e-3 * expected, `${meshVolume(m.single)} vs ${expected}`);
    assert.equal(m.colorChangeMm, 2);
    assert.equal(m.heightMm, 3);
  });

  it("encodes binary STL with the right size", () => {
    const m = buildQrStlModel(fakeModules(), {});
    const bytes = encodeBinaryStl(m.single);
    const count = m.single.length / 9;
    assert.equal(bytes.length, 84 + count * 50);
    assert.equal(new DataView(bytes.buffer).getUint32(80, true), count);
  });

  it("crc32 and zip store", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
    const zip = zipStore([{ name: "a.stl", data: new Uint8Array([1, 2, 3]) }]);
    const view = new DataView(zip.buffer);
    assert.equal(view.getUint32(0, true), 0x04034b50);
    assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  });
});
