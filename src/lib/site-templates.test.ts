import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SITE_TEMPLATES,
  SITE_TEMPLATE_IDS,
  defaultSiteTemplateForIndustry,
  parseSiteTemplateInput,
  resolveCardSiteTemplate,
  resolveSiteTemplate,
} from "./site-templates";

describe("site templates", () => {
  it("каждый id описан ровно один раз", () => {
    assert.deepEqual(
      SITE_TEMPLATES.map((t) => t.id),
      [...SITE_TEMPLATE_IDS]
    );
  });

  it("шаблон по отрасли", () => {
    assert.equal(defaultSiteTemplateForIndustry("HORECA"), "showcase");
    assert.equal(defaultSiteTemplateForIndustry("BEAUTY"), "editorial");
    assert.equal(defaultSiteTemplateForIndustry("CLINIC"), "classic");
    assert.equal(defaultSiteTemplateForIndustry(null), "classic");
  });

  it("сохранённый шаблон важнее отрасли, битый — игнорируется", () => {
    assert.equal(resolveSiteTemplate("bold", "HORECA"), "bold");
    assert.equal(resolveSiteTemplate("nope", "HORECA"), "showcase");
    assert.equal(resolveSiteTemplate(null, "AUTO"), "classic");
  });

  it("разбор значения из API", () => {
    assert.equal(parseSiteTemplateInput("editorial"), "editorial");
    assert.equal(parseSiteTemplateInput(null), null);
    assert.equal(parseSiteTemplateInput(""), null);
    assert.equal(parseSiteTemplateInput("<script>"), undefined);
    assert.equal(parseSiteTemplateInput(42), undefined);
  });

  it("сайт-визитка: FREE — всегда «Классика», PRO — свой выбор", () => {
    assert.equal(resolveCardSiteTemplate("bold", "AUTO", false), "classic");
    assert.equal(resolveCardSiteTemplate("bold", "AUTO", true), "bold");
    assert.equal(resolveCardSiteTemplate(null, null, true), "classic");
    assert.equal(resolveCardSiteTemplate(null, "HORECA", true), "showcase");
  });
});
