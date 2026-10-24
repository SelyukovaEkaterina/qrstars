import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generatorStyleToTemplateConfig,
  parseGeneratorStyle,
  templateConfigKey,
} from "./generator-style";

const base = {
  v: 1,
  dotStyle: "rounded",
  eyeStyle: "leaf",
  fg: "#1e293b",
  bg: "#ffffff",
  bgTransparent: false,
  gradient: true,
  grad1: "#4f46e5",
  grad2: "#a855f7",
  gradType: "radial",
  eyeCustom: false,
  eyeColor: "#4f46e5",
  logoPreset: "☕",
  logoSrc: null,
  logoFill: false,
  logoSize: 22,
  frame: true,
  frameText: "НАВЕДИ КАМЕРУ",
  frameStyle: "ribbon",
  ecc: "H",
  margin: 0,
  scatter: true,
  scatterDensity: 4,
  scatterShape: "heart",
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

describe("generator style transfer", () => {
  it("parses a landing design including cyrillic frame text", () => {
    const style = parseGeneratorStyle(encode(base));
    assert.ok(style);
    assert.equal(style.frameText, "НАВЕДИ КАМЕРУ");
    const config = generatorStyleToTemplateConfig(style);
    assert.equal(config.scatterShape, "heart");
    assert.equal(config.margin, 0);
    assert.equal(config.logoPreset, "☕");
    assert.equal(config.logoDataUrl, null);
  });

  it("rejects external logo URLs, bad colors and garbage", () => {
    assert.equal(parseGeneratorStyle(encode({ ...base, logoSrc: "https://evil.example/x.png" })), null);
    assert.equal(parseGeneratorStyle(encode({ ...base, fg: "red" })), null);
    assert.equal(parseGeneratorStyle(encode({ ...base, v: 2 })), null);
    assert.equal(parseGeneratorStyle("not base64!"), null);
    assert.equal(parseGeneratorStyle(encode("x".repeat(5000))), null);
    assert.equal(parseGeneratorStyle(null), null);
  });

  it("compares configs independent of key order", () => {
    assert.equal(templateConfigKey({ a: 1, b: 2 }), templateConfigKey({ b: 2, a: 1 }));
  });
});

describe("generator style transfer: art modes", () => {
  const ART_KEYS = ["silhouette", "silhouetteFit", "rotate45", "inkShift", "photoStyle", "silhouetteDataUrl"];

  it("keeps old links compatible: no art fields in the config", () => {
    const style = parseGeneratorStyle(encode(base));
    assert.ok(style);
    const config = generatorStyleToTemplateConfig(style);
    for (const key of ART_KEYS) assert.equal(key in config, false, key);
  });

  it("transfers art styles", () => {
    const style = parseGeneratorStyle(
      encode({ ...base, dotStyle: "liquid", silhouette: "heart", silhouetteFit: 90, rotate45: true, inkShift: true }),
    );
    assert.ok(style);
    const config = generatorStyleToTemplateConfig(style);
    assert.equal(config.dotStyle, "liquid");
    assert.equal(config.silhouette, "heart");
    assert.equal(config.silhouetteFit, 90);
    assert.equal(config.rotate45, true);
    assert.equal(config.inkShift, true);
  });

  it("rejects unknown dot styles and custom silhouettes", () => {
    assert.equal(parseGeneratorStyle(encode({ ...base, dotStyle: "sparkles" })), null);
    assert.equal(parseGeneratorStyle(encode({ ...base, silhouette: "custom" })), null);
    assert.equal(parseGeneratorStyle(encode({ ...base, silhouette: "heart", silhouetteFit: 20 })), null);
    assert.equal(parseGeneratorStyle(encode({ ...base, rotate45: "yes" })), null);
  });
});
