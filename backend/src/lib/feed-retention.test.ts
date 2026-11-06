import assert from "node:assert/strict";
import test from "node:test";
import { FEED_MAX_AGE_DAYS, getFeedCutoffDate } from "./feed-retention";

test("feed cutoff is exactly fourteen days before the current time", () => {
  const now = new Date("2026-11-03T09:00:00.000Z");
  const cutoff = getFeedCutoffDate(now);

  assert.equal(FEED_MAX_AGE_DAYS, 14);
  assert.equal(now.getTime() - cutoff.getTime(), 14 * 24 * 60 * 60 * 1000);
});

test("feed cutoff does not mutate the supplied date", () => {
  const now = new Date("2026-11-03T09:00:00.000Z");
  const originalTime = now.getTime();

  getFeedCutoffDate(now);

  assert.equal(now.getTime(), originalTime);
});
