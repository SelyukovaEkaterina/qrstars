import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRO_TRIAL_DAYS, proTrialDaysLeft, proTrialEndDate } from "./pro-trial";

const MS_DAY = 24 * 60 * 60 * 1000;

describe("proTrialEndDate", () => {
  it("ends PRO_TRIAL_DAYS after the start", () => {
    const start = new Date("2026-09-17T10:00:00.000Z");
    assert.equal(
      proTrialEndDate(start).getTime() - start.getTime(),
      PRO_TRIAL_DAYS * MS_DAY
    );
  });
});

describe("proTrialDaysLeft", () => {
  it("counts a started day as a whole day", () => {
    const now = new Date("2026-09-17T10:00:00.000Z");
    const endsAt = new Date("2026-09-20T02:00:00.000Z");
    assert.equal(proTrialDaysLeft(endsAt, now), 3);
  });

  it("returns 0 for an expired trial", () => {
    const now = new Date("2026-09-17T10:00:00.000Z");
    assert.equal(proTrialDaysLeft(new Date("2026-09-16T10:00:00.000Z"), now), 0);
  });

  it("returns 0 without an end date", () => {
    assert.equal(proTrialDaysLeft(null), 0);
  });
});
