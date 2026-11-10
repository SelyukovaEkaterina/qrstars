import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReviewInput, REVIEW_COMMENT_MAX } from "./review-input";
import { truncateComment, COMPLAINT_MESSAGE_COMMENT_MAX } from "./complaint-message";

const base = { establishmentId: "est1", rating: 2, comment: "Холодный суп", isNegative: true };

describe("parseReviewInput", () => {
  it("accepts a normal complaint and trims fields", () => {
    const r = parseReviewInput({ ...base, guestName: "  Иван ", guestPhone: " @ivan ", pdConsentGiven: true });
    assert.ok(r.ok);
    assert.equal(r.data.guestName, "Иван");
    assert.equal(r.data.guestPhone, "@ivan");
    assert.equal(r.data.pdConsentGiven, true);
    assert.equal(r.data.qrCodeId, null);
  });

  it("rejects non-integer and out-of-range ratings", () => {
    for (const rating of [4.5, 0, 6, "5", null]) {
      assert.equal(parseReviewInput({ ...base, rating }).ok, false, String(rating));
    }
  });

  it("rejects too long or non-string text", () => {
    assert.equal(parseReviewInput({ ...base, comment: "x".repeat(REVIEW_COMMENT_MAX + 1) }).ok, false);
    assert.equal(parseReviewInput({ ...base, comment: { a: 1 } }).ok, false);
    assert.equal(parseReviewInput({ ...base, guestName: 42 }).ok, false);
  });

  it("coerces flags to booleans and empty strings to null", () => {
    const r = parseReviewInput({ ...base, isNegative: "true", comment: "   ", pdConsentGiven: 1 });
    assert.ok(r.ok);
    assert.equal(r.data.isNegative, false);
    assert.equal(r.data.comment, null);
    assert.equal(r.data.pdConsentGiven, false);
  });

  it("requires establishmentId", () => {
    assert.equal(parseReviewInput({ rating: 5 }).ok, false);
    assert.equal(parseReviewInput({ ...base, establishmentId: "" }).ok, false);
  });
});

describe("truncateComment", () => {
  it("keeps short comments and cuts long ones for Telegram", () => {
    assert.equal(truncateComment("коротко"), "коротко");
    const long = truncateComment("я".repeat(5000));
    assert.equal(long.length, COMPLAINT_MESSAGE_COMMENT_MAX + 1);
    assert.ok(long.endsWith("…"));
  });
});
