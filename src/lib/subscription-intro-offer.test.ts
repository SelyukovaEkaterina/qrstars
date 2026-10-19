import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAN_PRICING, PRO_INTRO_OFFER, offerYearlyRub } from "@/lib/plans";
import {
  isProIntroOfferEligible,
  isProIntroOfferReminderDue,
  getEligibleCampaigns,
  proIntroOfferDailyCapReached,
} from "@/lib/lifecycle-email-campaigns";
import { startOfMskDay } from "@/lib/lifecycle-email-msk";
import {
  LIFECYCLE_EMAIL_SUBJECTS,
  renderProOfferD14Email,
  renderProOfferReminderEmail,
  resolveProOfferQrProfile,
} from "@/lib/lifecycle-email-templates";
import type { LifecycleUserState } from "@/lib/lifecycle-email-state";

function state(patch: Partial<LifecycleUserState>): LifecycleUserState {
  return {
    userId: "user-1",
    email: "owner@example.com",
    name: "Анна",
    role: "OWNER",
    marketingEmailsEnabled: true,
    registrationSource: null,
    createdAt: new Date("2026-09-01T09:00:00.000Z"),
    firstScanAt: new Date("2026-10-01T09:00:00.000Z"),
    needsSetup: false,
    accessibleEstablishmentCount: 1,
    ownedQrCount: 1,
    totalScans: 5,
    reviewCount: 1,
    reviewsLast90Days: 1,
    scansLast90Days: 5,
    submittedFeedbackKinds: new Set(),
    hasTelegram: false,
    sentCampaignKeys: new Set(),
    plan: "FREE",
    firstOwnedEstablishmentAt: new Date("2026-09-20T09:00:00.000Z"),
    firstOwnedQrAt: new Date("2026-09-28T09:00:00.000Z"),
    proOfferCampaignStartedAt: new Date("2026-09-01T09:00:00.000Z"),
    proIntroOffer: null,
    ...patch,
    ...(patch.sentCampaignKeys ? { sentCampaignKeys: patch.sentCampaignKeys } : {}),
  };
}

const NOW = new Date("2026-10-18T09:00:00.000Z");

describe("PRO intro offer price", () => {
  it("rounds 30% off the yearly PRO price to 10 rubles", () => {
    assert.equal(PLAN_PRICING.PRO.yearlyRub, 990);
    assert.equal(offerYearlyRub(990, 30), 690);
    assert.equal(PRO_INTRO_OFFER.yearlyRub, 690);
    assert.equal(PRO_INTRO_OFFER.discountPercent, 30);
    assert.equal(PRO_INTRO_OFFER.validDays, 7);
    assert.equal(PRO_INTRO_OFFER.maxPerDay, 5);
    assert.equal(proIntroOfferDailyCapReached(4), false);
    assert.equal(proIntroOfferDailyCapReached(5), true);
  });

  it("counts the Moscow calendar day from midnight", () => {
    const start = startOfMskDay(new Date("2026-10-19T10:00:00.000Z"));
    assert.equal(start.toISOString(), "2026-10-18T21:00:00.000Z");
  });
});

describe("PRO intro offer eligibility", () => {
  it("sends once the first scan is 14 days old, even if registration was long ago", () => {
    const eligible = state({
      createdAt: new Date("2026-01-01T09:00:00.000Z"),
      firstScanAt: new Date("2026-10-04T09:00:00.000Z"),
    });
    assert.equal(isProIntroOfferEligible(eligible, NOW), true);
  });

  it("waits until 14 calendar days after the first scan", () => {
    const recent = state({ firstScanAt: new Date("2026-10-06T09:00:00.000Z") });
    assert.equal(isProIntroOfferEligible(recent, NOW), false);
    const exact = state({ firstScanAt: new Date("2026-10-04T09:00:00.000Z") });
    assert.equal(isProIntroOfferEligible(exact, NOW), true);
  });

  it("skips scans that happened before the campaign cutoff", () => {
    const early = state({
      firstScanAt: new Date("2026-10-01T09:00:00.000Z"),
      proOfferCampaignStartedAt: new Date("2026-10-10T09:00:00.000Z"),
    });
    assert.equal(isProIntroOfferEligible(early, NOW), false);
  });

  it("skips free accounts without enough scans, without a QR, or already on PRO", () => {
    assert.equal(isProIntroOfferEligible(state({ totalScans: 2 }), NOW), false);
    assert.equal(isProIntroOfferEligible(state({ ownedQrCount: 0 }), NOW), false);
    assert.equal(isProIntroOfferEligible(state({ plan: "PRO" }), NOW), false);
    assert.equal(isProIntroOfferEligible(state({ firstScanAt: null }), NOW), false);
  });

  it("does not send the generic PRO hint together with the offer", () => {
    const keys = getEligibleCampaigns(state({}), { cronOnly: true, now: NOW }).map((c) => c.key);
    assert.ok(keys.includes("pro_offer_d14"));
    assert.equal(keys.includes("pro_hint_d14"), false);
  });

  it("reminds only while the unused code has at most two days left", () => {
    const offer = {
      code: "START30-ABC234",
      amountRub: 690,
      listAmountRub: 990,
      expiresAt: new Date(NOW.getTime() + 36 * 60 * 60 * 1000),
      usedAt: null,
    };
    const due = state({
      sentCampaignKeys: new Set(["pro_offer_d14"]),
      proIntroOffer: offer,
    });
    assert.equal(isProIntroOfferReminderDue(due, NOW), true);

    const early = state({
      sentCampaignKeys: new Set(["pro_offer_d14"]),
      proIntroOffer: { ...offer, expiresAt: new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000) },
    });
    assert.equal(isProIntroOfferReminderDue(early, NOW), false);

    const used = state({
      sentCampaignKeys: new Set(["pro_offer_d14"]),
      proIntroOffer: { ...offer, usedAt: NOW },
    });
    assert.equal(isProIntroOfferReminderDue(used, NOW), false);

    const paid = state({
      plan: "PRO",
      sentCampaignKeys: new Set(["pro_offer_d14"]),
      proIntroOffer: offer,
    });
    assert.equal(isProIntroOfferReminderDue(paid, NOW), false);
  });
});

describe("PRO intro offer email", () => {
  const sampleOffer = {
    code: "START30-ABC234",
    amountRub: 690,
    listAmountRub: 990,
    expiresAt: new Date("2026-10-25T10:00:00.000Z"),
    usedAt: null,
  };

  it("prints the personal code, both prices, and the deadline", () => {
    process.env.NEXTAUTH_SECRET ??= "test-secret";
    const html = renderProOfferD14Email(state({ proIntroOffer: sampleOffer }));
    assert.match(html, /START30-ABC234/);
    assert.match(html, /690/);
    assert.match(html, /990/);
    assert.match(html, /25 октября/);
    assert.match(html, /следующего года/);
  });

  it("switches email copy and subject between review, redirect, and content QR modes", () => {
    process.env.NEXTAUTH_SECRET ??= "test-secret";
    assert.equal(resolveProOfferQrProfile(null), "review");
    assert.equal(resolveProOfferQrProfile("REVIEW"), "review");
    assert.equal(resolveProOfferQrProfile("REDIRECT"), "redirect");
    assert.equal(resolveProOfferQrProfile("MENU"), "content");
    assert.equal(resolveProOfferQrProfile("BUSINESS_CARD"), "content");
    assert.equal(resolveProOfferQrProfile("WIFI"), "content");
    assert.equal(resolveProOfferQrProfile("FILE"), "content");

    const reviewState = state({ topQrMode: "REVIEW", proIntroOffer: sampleOffer });
    const redirectState = state({ topQrMode: "REDIRECT", proIntroOffer: sampleOffer });
    const contentState = state({ topQrMode: "MENU", proIntroOffer: sampleOffer });

    const reviewHtml = renderProOfferD14Email(reviewState);
    const redirectHtml = renderProOfferD14Email(redirectState);
    const contentHtml = renderProOfferD14Email(contentState);

    assert.match(reviewHtml, /Жалобы в Telegram и MAX за секунду/);
    assert.match(redirectHtml, /Мгновенный переход без промежуточного экрана QrStars/);
    assert.match(contentHtml, /Все разделы в одном QR и ваш бренд/);

    const reviewReminder = renderProOfferReminderEmail(reviewState);
    const redirectReminder = renderProOfferReminderEmail(redirectState);
    const contentReminder = renderProOfferReminderEmail(contentState);

    assert.match(reviewReminder, /Перехват негатива в моменте/);
    assert.match(redirectReminder, /Прямой переход без задержки/);
    assert.match(contentReminder, /Микросайт в одном QR-коде/);

    const subjectFn = LIFECYCLE_EMAIL_SUBJECTS.pro_offer_d14 as (s: LifecycleUserState) => string;
    assert.match(subjectFn(reviewState), /жалобы в Telegram/);
    assert.match(subjectFn(redirectState), /Прямой переход по QR без экрана QrStars/);
    assert.match(subjectFn(contentState), /Микросайт и ваш бренд/);
  });
});
