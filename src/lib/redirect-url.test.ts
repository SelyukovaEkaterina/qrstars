import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toHeaderSafeUrl } from "./redirect-url";

describe("toHeaderSafeUrl", () => {
  it("percent-encodes cyrillic query values", () => {
    const result = toHeaderSafeUrl(
      "https://yandex.ru/maps/org/foo/123/reviews/?text=Ломбард%20585%20Золотой&z=15"
    );
    assert.equal(
      result,
      "https://yandex.ru/maps/org/foo/123/reviews/?text=%D0%9B%D0%BE%D0%BC%D0%B1%D0%B0%D1%80%D0%B4%20585%20%D0%97%D0%BE%D0%BB%D0%BE%D1%82%D0%BE%D0%B9&z=15"
    );
  });

  it("keeps already-encoded sequences intact", () => {
    const input = "https://yandex.ru/maps/?sctx=ZAAAAAgBEAA%3D%3D&ll=39.7%2C48.2";
    assert.equal(toHeaderSafeUrl(input), input);
  });

  it("converts IDN host to punycode", () => {
    assert.equal(toHeaderSafeUrl("https://сайт.рф/меню"), "https://xn--80aswg.xn--p1ai/%D0%BC%D0%B5%D0%BD%D1%8E");
  });

  it("adds https to schemeless input", () => {
    assert.equal(toHeaderSafeUrl("example.com/page"), "https://example.com/page");
  });

  it("preserves relative paths", () => {
    assert.equal(toHeaderSafeUrl("/activate/abc"), "/activate/abc");
  });

  it("strips control characters that allow header injection", () => {
    assert.equal(
      toHeaderSafeUrl("https://example.com/a\r\nX-Injected: 1"),
      "https://example.com/aX-Injected:%201"
    );
  });

  it("encodes non-ascii in opaque schemes", () => {
    const result = toHeaderSafeUrl("mailto:тест@пример.рф");
    assert.ok(result);
    // eslint-disable-next-line no-control-regex
    assert.ok(!/[^\u0000-\u007f]/.test(result));
  });

  it("returns null for empty and unparsable input", () => {
    assert.equal(toHeaderSafeUrl(""), null);
    assert.equal(toHeaderSafeUrl(null), null);
    assert.equal(toHeaderSafeUrl("   "), null);
    assert.equal(toHeaderSafeUrl("http://"), null);
  });
});
