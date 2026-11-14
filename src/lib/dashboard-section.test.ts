import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dashboardSection, isSubscriptionHref } from "./dashboard-section";

describe("dashboardSection", () => {
  it("normalizes project pages without ids", () => {
    assert.equal(dashboardSection("/dashboard"), "home");
    assert.equal(dashboardSection("/dashboard/projects"), "projects");
    assert.equal(dashboardSection("/dashboard/projects/abc"), "project.home");
    assert.equal(dashboardSection("/dashboard/projects/abc/qrcodes"), "project.qrcodes");
    assert.equal(dashboardSection("/dashboard/projects/abc/qrcodes/q1"), "project.qrcode");
    assert.equal(dashboardSection("/dashboard/projects/abc/card"), "project.card");
    assert.equal(dashboardSection("/dashboard/projects/abc/page"), "project.page");
  });

  it("handles account pages", () => {
    assert.equal(dashboardSection("/dashboard/subscription?plan=pro"), "subscription");
    assert.equal(dashboardSection("/dashboard/settings"), "settings");
    assert.equal(dashboardSection("/dashboard/settings/templates"), "settings.templates");
    assert.equal(dashboardSection("/dashboard/start"), "start");
  });

  it("returns null outside the dashboard", () => {
    assert.equal(dashboardSection("/q/abc"), null);
    assert.equal(dashboardSection(null), null);
  });
});

describe("isSubscriptionHref", () => {
  it("matches the subscription page only", () => {
    assert.equal(isSubscriptionHref("/dashboard/subscription"), true);
    assert.equal(isSubscriptionHref("/dashboard/subscription?plan=pro"), true);
    assert.equal(isSubscriptionHref("https://app.qrstars.ru/dashboard/subscription#pro"), true);
    assert.equal(isSubscriptionHref("/dashboard/subscriptions-old"), false);
    assert.equal(isSubscriptionHref("/dashboard/support"), false);
    assert.equal(isSubscriptionHref(null), false);
  });
});
