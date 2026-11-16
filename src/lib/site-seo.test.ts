import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { businessCardJsonLd, jsonLdString, micrositeJsonLd, openingHoursSpecification } from "./site-seo";

describe("site seo", () => {
  it("часы работы → OpeningHoursSpecification, выходные пропускаются", () => {
    const spec = openingHoursSpecification({ mon: { open: "09:00", close: "21:00" }, sun: null });
    assert.deepEqual(spec, [{ "@type": "OpeningHoursSpecification", dayOfWeek: "Monday", opens: "09:00", closes: "21:00" }]);
  });

  it("микросайт: пустые поля не попадают в разметку", () => {
    const ld = micrositeJsonLd({ name: "Кафе", url: "https://cafe.qrstars.ru", address: " ", sameAs: ["javascript:alert(1)", "https://yandex.ru/maps/org/1"] });
    assert.equal(ld.address, undefined);
    assert.deepEqual(ld.sameAs, ["https://yandex.ru/maps/org/1"]);
    assert.equal(ld["@type"], "LocalBusiness");
  });

  it("визитка: услуги и район", () => {
    const ld = businessCardJsonLd({
      fullName: "Иван",
      title: "Электрик",
      url: "https://app.qrstars.ru/q/x",
      serviceArea: "Москва",
      services: [{ name: "Розетка", price: "от 400 ₽" }, { name: " " }],
    });
    assert.equal(ld.name, "Иван — Электрик");
    assert.equal(ld.areaServed, "Москва");
    assert.equal((ld.makesOffer as unknown[]).length, 1);
  });

  it("текст владельца не закрывает script", () => {
    const s = jsonLdString({ name: "</script><script>alert(1)</script>" });
    assert.ok(!s.includes("</script>"));
  });
});
