import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NO_ANALYTICS_COOKIE,
  NO_ANALYTICS_COOKIE_VALUE,
  buildNoAnalyticsCookieOptions,
  isAnalyticsDisabled,
  isInternalTestEmail,
  resolveRegistrationSource,
} from "./analytics-exclusion";

describe("isInternalTestEmail", () => {
  it("matches +test in local part", () => {
    assert.equal(isInternalTestEmail("qa+test@gmail.com"), true);
    assert.equal(isInternalTestEmail("QA+TEST@Gmail.com"), true);
  });

  it("matches configured internal domains", () => {
    assert.equal(isInternalTestEmail("user@example.com"), true);
    assert.equal(isInternalTestEmail("user@test.qrstars.ru"), true);
    assert.equal(isInternalTestEmail("user@test.example.com"), true);
  });

  it("does not match regular emails", () => {
    assert.equal(isInternalTestEmail("owner@gmail.com"), false);
    assert.equal(isInternalTestEmail("qa@qrstars.ru"), false);
  });
});

describe("isAnalyticsDisabled", () => {
  it("reads qrstars_no_analytics cookie", () => {
    assert.equal(
      isAnalyticsDisabled({
        get: (name) =>
          name === NO_ANALYTICS_COOKIE ? { value: NO_ANALYTICS_COOKIE_VALUE } : undefined,
      }),
      true
    );
    assert.equal(
      isAnalyticsDisabled({
        get: () => undefined,
      }),
      false
    );
  });
});

describe("buildNoAnalyticsCookieOptions", () => {
  it("sets .qrstars.ru domain on production host", () => {
    assert.deepEqual(buildNoAnalyticsCookieOptions("app.qrstars.ru").domain, ".qrstars.ru");
  });

  it("omits domain on localhost", () => {
    assert.equal(buildNoAnalyticsCookieOptions("localhost").domain, undefined);
  });
});

describe("resolveRegistrationSource", () => {
  it("marks QA cookie and internal emails as internal_test", () => {
    assert.equal(
      resolveRegistrationSource({ email: "owner@gmail.com", analyticsDisabled: true }),
      "internal_test"
    );
    assert.equal(
      resolveRegistrationSource({ email: "user@example.com", analyticsDisabled: false }),
      "internal_test"
    );
    assert.equal(
      resolveRegistrationSource({ email: "owner@gmail.com", analyticsDisabled: false }),
      "register"
    );
  });
});
