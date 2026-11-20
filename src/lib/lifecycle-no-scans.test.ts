import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEligibleCampaigns, returnedAfterFirstQr } from "@/lib/lifecycle-email-campaigns";
import {
  LIFECYCLE_EMAIL_SUBJECTS,
  renderNoScansD2Email,
  renderNoScansD5Email,
  resolveNoScansProfile,
} from "@/lib/lifecycle-email-templates";
import { reportsUnsubscribeUrl } from "@/lib/email-layout";
import type { LifecycleUserState } from "@/lib/lifecycle-email-state";

process.env.NEXTAUTH_SECRET ??= "test-secret";

const QR_AT = new Date("2026-11-15T06:43:00.000Z");
const NOW = new Date("2026-11-20T07:00:00.000Z");

function state(patch: Partial<LifecycleUserState>): LifecycleUserState {
  return {
    userId: "user-1",
    email: "owner@example.com",
    name: "Анна",
    role: "OWNER",
    marketingEmailsEnabled: true,
    registrationSource: null,
    createdAt: QR_AT,
    firstScanAt: null,
    needsSetup: false,
    accessibleEstablishmentCount: 1,
    ownedQrCount: 1,
    totalScans: 0,
    reviewCount: 0,
    reviewsLast90Days: 0,
    scansLast90Days: 0,
    submittedFeedbackKinds: new Set(),
    hasTelegram: false,
    sentCampaignKeys: new Set(["welcome", "no_scans_d2"]),
    plan: "FREE",
    firstOwnedEstablishmentAt: QR_AT,
    firstOwnedQrAt: QR_AT,
    topQrMode: "BUSINESS_CARD",
    topQr: { id: "qr-1", code: "abc123", establishmentId: "est-1" },
    lastDashboardActivityAt: null,
    proOfferCampaignStartedAt: null,
    proIntroOffer: null,
    ...patch,
  };
}

function subject(key: string, s: LifecycleUserState): string {
  const t = LIFECYCLE_EMAIL_SUBJECTS[key];
  return typeof t === "function" ? t(s) : t;
}

describe("no_scans_d5: только вернувшимся в кабинет", () => {
  it("не шлёт тому, кто ушёл в день создания QR", () => {
    const s = state({ lastDashboardActivityAt: new Date("2026-11-15T07:00:00.000Z") });
    assert.equal(returnedAfterFirstQr(s), false);
    assert.ok(!getEligibleCampaigns(s, { now: NOW }).some((c) => c.key === "no_scans_d5"));
  });

  it("не шлёт без событий кабинета", () => {
    assert.ok(!getEligibleCampaigns(state({}), { now: NOW }).some((c) => c.key === "no_scans_d5"));
  });

  it("шлёт, если человек вернулся на следующий день", () => {
    const s = state({ lastDashboardActivityAt: new Date("2026-11-16T09:00:00.000Z") });
    assert.equal(returnedAfterFirstQr(s), true);
    assert.ok(getEligibleCampaigns(s, { now: NOW }).some((c) => c.key === "no_scans_d5"));
  });

  it("no_scans_d2 по-прежнему уходит без возврата", () => {
    const s = state({ sentCampaignKeys: new Set(["welcome"]) });
    assert.ok(getEligibleCampaigns(s, { now: NOW }).some((c) => c.key === "no_scans_d2"));
  });
});

describe("письма «нет сканов» по режиму QR", () => {
  it("режимы раскладываются по профилям", () => {
    assert.equal(resolveNoScansProfile("BUSINESS_CARD"), "card");
    assert.equal(resolveNoScansProfile("MENU"), "menu");
    assert.equal(resolveNoScansProfile("FORM"), "form");
    assert.equal(resolveNoScansProfile("WIFI"), "wifi");
    assert.equal(resolveNoScansProfile("REDIRECT"), "link");
    assert.equal(resolveNoScansProfile("FILE"), "link");
    assert.equal(resolveNoScansProfile("LANDING"), "site");
    assert.equal(resolveNoScansProfile("REVIEW"), "review");
    assert.equal(resolveNoScansProfile(null), "review");
  });

  it("визитке — про ссылку в мессенджер, без столов и туалетов", () => {
    const s = state({});
    const html = renderNoScansD2Email(s) + renderNoScansD5Email(s);
    assert.match(html, /WhatsApp/);
    assert.match(html, /abc123/);
    assert.doesNotMatch(html, /туалет|на столах|гост/i);
    assert.match(subject("no_scans_d2", s), /визитк/i);
  });

  it("ни в одном профиле нет совета про туалет", () => {
    for (const mode of ["REVIEW", "MENU", "BUSINESS_CARD", "FORM", "WIFI", "REDIRECT", "LANDING"]) {
      const s = state({ topQrMode: mode });
      assert.doesNotMatch(renderNoScansD2Email(s) + renderNoScansD5Email(s), /туалет/i, mode);
    }
  });

  it("для печатных сценариев кнопка ведёт на табличку конкретного QR", () => {
    const html = renderNoScansD2Email(state({ topQrMode: "MENU" }));
    assert.match(html, /\/dashboard\/projects\/est-1\/qrcodes\/qr-1\?print=1/);
  });

  it("QR без проекта открывается через unassigned", () => {
    const html = renderNoScansD2Email(
      state({ topQrMode: "REDIRECT", topQr: { id: "qr-2", code: "x", establishmentId: null } })
    );
    assert.match(html, /\/dashboard\/projects\/unassigned\/qrcodes\/qr-2\?print=1/);
  });
});

describe("отписка в письмах", () => {
  it("подвал — заметная ссылка отписки", () => {
    const html = renderNoScansD2Email(state({}));
    assert.match(html, /Не хотите получать такие письма\?\s+<a [^>]+>Отписаться<\/a>/);
    assert.match(html, /\/api\/unsubscribe\?token=/);
  });

  it("ссылка отписки от отчётов несёт type=reports", () => {
    assert.match(reportsUnsubscribeUrl("user-1"), /\/api\/unsubscribe\?token=[^&]+&type=reports$/);
  });
});
