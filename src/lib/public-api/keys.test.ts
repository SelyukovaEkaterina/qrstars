import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiKeyDisplayPrefix,
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
  normalizeApiKeyName,
} from "./keys";

describe("API-ключи", () => {
  it("генерирует ключ qrs_ + 40 символов base62, каждый раз новый", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    assert.match(a, /^qrs_[A-Za-z0-9]{40}$/);
    assert.notEqual(a, b);
    assert.ok(looksLikeApiKey(a));
  });

  it("отсекает чужие форматы до похода в базу", () => {
    assert.equal(looksLikeApiKey("qrs_short"), false);
    assert.equal(looksLikeApiKey("eyJhbGciOiJIUzI1NiJ9.x.y"), false);
    assert.equal(looksLikeApiKey("qrs_" + "-".repeat(40)), false);
  });

  it("хеш стабилен, префикс не раскрывает ключ", () => {
    const key = generateApiKey();
    assert.equal(hashApiKey(key), hashApiKey(key));
    assert.equal(hashApiKey(key).length, 64);
    assert.equal(apiKeyDisplayPrefix(key).length, 10);
    assert.ok(key.startsWith(apiKeyDisplayPrefix(key)));
  });

  it("проверяет название", () => {
    assert.equal(normalizeApiKeyName("  amoCRM   прод "), "amoCRM прод");
    assert.equal(normalizeApiKeyName("   "), null);
    assert.equal(normalizeApiKeyName("x".repeat(61)), null);
    assert.equal(normalizeApiKeyName(42), null);
  });
});
