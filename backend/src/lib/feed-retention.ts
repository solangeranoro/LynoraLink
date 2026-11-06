export const FEED_MAX_AGE_DAYS = 14;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function getFeedCutoffDate(now = new Date()) {
  return new Date(now.getTime() - FEED_MAX_AGE_DAYS * DAY_IN_MILLISECONDS);
}
