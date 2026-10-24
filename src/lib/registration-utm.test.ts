import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseRegistrationUtmCookie,
  readOAuthRegistrationAttribution,
  REGISTRATION_REF_COOKIE,
  REGISTRATION_UTM_COOKIE,
} from "./registration-utm";

describe("parseRegistrationUtmCookie", () => {
  const utm = { utm_source: "qrstars", utm_campaign: "reviews_landing", utm_content: "2gis" };

  it("reads raw and URI-encoded JSON", () => {
    assert.deepEqual(parseRegistrationUtmCookie(JSON.stringify(utm)), utm);
    assert.deepEqual(parseRegistrationUtmCookie(encodeURIComponent(JSON.stringify(utm))), utm);
  });

  it("drops unknown keys and ignores garbage", () => {
    assert.deepEqual(
      parseRegistrationUtmCookie(JSON.stringify({ utm_source: "x", evil: "1" })),
      { utm_source: "x" }
    );
    assert.equal(parseRegistrationUtmCookie("not-json"), null);
    assert.equal(parseRegistrationUtmCookie("%E0%A4%A"), null);
    assert.equal(parseRegistrationUtmCookie(undefined), null);
  });
});

describe("readOAuthRegistrationAttribution", () => {
  it("combines UTM cookie and _ym_uid", () => {
    const jar: Record<string, string> = {
      [REGISTRATION_UTM_COOKIE]: encodeURIComponent(JSON.stringify({ utm_campaign: "menu_search" })),
      _ym_uid: "1727712345123456789",
      [REGISTRATION_REF_COOKIE]: "BLOGGER_1",
    };
    assert.deepEqual(readOAuthRegistrationAttribution((name) => jar[name]), {
      registrationUtm: { utm_campaign: "menu_search" },
      metrikaClientId: "1727712345123456789",
      referralCode: "BLOGGER_1",
    });
  });

  it("returns nulls without cookies", () => {
    assert.deepEqual(readOAuthRegistrationAttribution(() => undefined), {
      registrationUtm: null,
      metrikaClientId: null,
      referralCode: null,
    });
  });
});
