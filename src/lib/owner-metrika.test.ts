import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMetrikaCounterInput } from "./owner-metrika";

test("номер счётчика как есть", () => {
  assert.equal(parseMetrikaCounterInput("12345678"), "12345678");
  assert.equal(parseMetrikaCounterInput(" 109307713 "), "109307713");
  assert.equal(parseMetrikaCounterInput(98765432), "98765432");
});

test("пусто и null — отключить", () => {
  assert.equal(parseMetrikaCounterInput(""), null);
  assert.equal(parseMetrikaCounterInput("   "), null);
  assert.equal(parseMetrikaCounterInput(null), null);
});

test("номер из кода счётчика и ссылок", () => {
  const snippet = `<script>(function(m,e,t,r,i,k,a){...})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=55511122', 'ym');
ym(55511122, 'init', {webvisor:true});</script><noscript><img src="https://mc.yandex.ru/watch/55511122"/></noscript>`;
  assert.equal(parseMetrikaCounterInput(snippet), "55511122");
  assert.equal(parseMetrikaCounterInput("https://metrika.yandex.ru/dashboard?id=44433322"), "44433322");
  assert.equal(parseMetrikaCounterInput("https://metrika.yandex.ru/settings?id=44433322&tab=code"), "44433322");
  assert.equal(parseMetrikaCounterInput("https://mc.yandex.ru/watch/33322211"), "33322211");
});

test("мусор — не номер", () => {
  assert.equal(parseMetrikaCounterInput("abc"), undefined);
  assert.equal(parseMetrikaCounterInput("1234"), undefined);
  assert.equal(parseMetrikaCounterInput("<script>alert(1)</script>"), undefined);
  assert.equal(parseMetrikaCounterInput({}), undefined);
  assert.equal(parseMetrikaCounterInput("G-ABC123"), undefined);
});
