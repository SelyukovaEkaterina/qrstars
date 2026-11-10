import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoScanCodeFromHost, isMicrositeSlug, micrositeSlugFromHost } from "./microsite-host";

describe("microsite host", () => {
  it("reads a client subdomain", () => {
    assert.equal(micrositeSlugFromHost("strainelectric.qrstars.ru"), "strainelectric");
    assert.equal(micrositeSlugFromHost("Cafe.qrstars.ru:443"), "cafe");
  });

  it("ignores service hosts and the apex", () => {
    assert.equal(micrositeSlugFromHost("app.qrstars.ru"), null);
    assert.equal(micrositeSlugFromHost("www.qrstars.ru"), null);
    assert.equal(micrositeSlugFromHost("s3.qrstars.ru"), null);
    assert.equal(micrositeSlugFromHost("qrstars.ru"), null);
    assert.equal(micrositeSlugFromHost("localhost:3000"), null);
    assert.equal(micrositeSlugFromHost("a.b.qrstars.ru"), null);
  });

  it("rejects names that cannot be a hostname label", () => {
    assert.equal(isMicrositeSlug("my_cafe"), false);
    assert.equal(isMicrositeSlug("-cafe"), false);
    assert.equal(isMicrositeSlug("a"), false);
    assert.equal(isMicrositeSlug("app"), false);
    assert.equal(isMicrositeSlug("my-cafe"), true);
  });

  it("keeps demo names for the service", () => {
    assert.equal(isMicrositeSlug("demo-landing"), false);
    assert.equal(isMicrositeSlug("demo-cafe"), false);
    assert.equal(isMicrositeSlug("democafe"), true);
    assert.equal(micrositeSlugFromHost("demo.qrstars.ru"), null);
  });

  it("maps demo.qrstars.ru to the demo microsite", () => {
    assert.equal(demoScanCodeFromHost("demo.qrstars.ru"), "demo-landing");
    assert.equal(demoScanCodeFromHost("Demo.qrstars.ru:443"), "demo-landing");
    assert.equal(demoScanCodeFromHost("cafe.qrstars.ru"), null);
    assert.equal(demoScanCodeFromHost("demo.example.com"), null);
  });
});
