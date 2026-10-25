"use client";

import { Compass, Flame, GraduationCap, Rocket, Star, Trophy } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

export type BadgeKey = "TOP_MAKER" | "EARLY_LAUNCHER" | "MENTOR" | "CO_BUILDER" | "COMMUNITY_STAR" | "EXPLORER";
export type AwardedBadge = { key: BadgeKey; name: string; icon: string; awardedAt: string };

const badgeIcons = {
  TOP_MAKER: Trophy,
  EARLY_LAUNCHER: Rocket,
  MENTOR: GraduationCap,
  CO_BUILDER: Flame,
  COMMUNITY_STAR: Star,
  EXPLORER: Compass,
} as const;

function badgeTitle(key: BadgeKey, t: (key: string) => string) {
  return t(`gamification.badges.${key}.title`);
}

function isRecent(awardedAt: string) {
  const timestamp = new Date(awardedAt).getTime();
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}

export function BadgeIconList({ badges, size = 14 }: { badges: AwardedBadge[]; size?: number }) {
  const { t } = useTranslation();
  if (!badges.length) return null;
  return (
    <span className="inline-flex items-center gap-1" aria-label={t("gamification.badgesLabel")}>
      {badges.map((badge) => {
        const Icon = badgeIcons[badge.key];
        const title = badgeTitle(badge.key, t);
        return (
          <span key={badge.key} title={title} aria-label={title} className={`inline-grid shrink-0 place-items-center text-gold-soft ${isRecent(badge.awardedAt) ? "animate-badge-pulse" : ""}`}>
            <Icon size={size} aria-hidden="true" />
          </span>
        );
      })}
    </span>
  );
}

export function BadgeCollection({ badges, emptyLabel }: { badges: AwardedBadge[]; emptyLabel: string }) {
  const { t, locale } = useTranslation();
  if (!badges.length) return <p className="text-sm text-ink-muted">{emptyLabel}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {badges.map((badge) => {
        const Icon = badgeIcons[badge.key];
        const isNew = isRecent(badge.awardedAt);
        return (
          <li key={badge.key} className="flex min-w-0 items-start gap-3 rounded-lg border border-gold/20 bg-gold/5 p-3.5">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-gold/25 bg-gold/10 text-gold-soft ${isNew ? "animate-badge-pulse" : ""}`}>
              <Icon size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{badgeTitle(badge.key, t)}</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{t(`gamification.badges.${badge.key}.description`)}</span>
              {isNew && <span className="mt-2 inline-block text-[10px] font-semibold uppercase text-gold-soft">{t("gamification.newBadge")}</span>}
              <time className="mt-2 block text-[10px] text-ink-muted" dateTime={badge.awardedAt}>{new Date(badge.awardedAt).toLocaleDateString(locale)}</time>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
