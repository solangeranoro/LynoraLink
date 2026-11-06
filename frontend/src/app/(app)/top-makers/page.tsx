"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Trophy } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { FlaskConical, Star, UsersRound } from "lucide-react";
import { BadgeIconList, type AwardedBadge, type MakerStanding } from "@/components/GamificationBadges";
import { useTranslation } from "@/lib/i18n";

type ReviewedTeam = {
  id: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  reviewCount: number;
  averageRating: number;
  memberCount: number;
};

type ReviewedApplication = {
  id: string;
  name: string;
  platform: string;
  logoUrl: string | null;
  ownerName: string;
  reviewCount: number;
  averageRating: number;
};

type LeaderboardMaker = {
  rank: number;
  activityScore: number;
  activity: MakerStanding["activity"];
  weights: MakerStanding["weights"];
  totalRanked: number;
  minimumScore: number;
  maker: {
    id: string;
    name: string | null;
    image: string | null;
    handle: string | null;
    headline: string | null;
    badges: AwardedBadge[];
  };
};

type Activity = MakerStanding["activity"];
type Weights = MakerStanding["weights"];

function getActivityBreakdown(activity: Activity, weights: Weights) {
  return [
    {
      label: "rankingBuild",
      score: activity.PROJECT * weights.PROJECT + activity.TEAM * weights.TEAM,
      count: activity.PROJECT + activity.TEAM,
      color: "bg-sky-400",
    },
    {
      label: "rankingPublish",
      score: activity.POST * weights.POST,
      count: activity.POST,
      color: "bg-violet-400",
    },
    {
      label: "rankingCommunity",
      score: activity.COMMENT * weights.COMMENT
        + activity.FEEDBACK * weights.FEEDBACK
        + activity.POLL * weights.POLL
        + activity.LIKE * weights.LIKE
        + activity.LIVE_SESSION * weights.LIVE_SESSION,
      count: activity.COMMENT + activity.FEEDBACK + activity.POLL + activity.LIKE + activity.LIVE_SESSION,
      color: "bg-emerald-400",
    },
  ] as const;
}

function ReviewLeaderboard({ title, description, hrefPrefix, items, icon: Icon, reviewLabel, emptyLabel }: {
  title: string;
  description: string;
  hrefPrefix: string;
  items: Array<{
    id: string;
    name: string;
    image: string | null;
    detail: string;
    reviewCount: number;
    averageRating: number;
  }>;
  icon: typeof UsersRound;
  reviewLabel: (count: number) => string;
  emptyLabel: string;
}) {
  return (
    <section className="space-y-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft"><Icon size={18} aria-hidden="true" /></span>
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-xs text-ink-muted">{description}</p>
        </div>
      </header>
      {items.length ? (
        <ol className="divide-y divide-midnight-border border-y border-midnight-border">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link href={`${hrefPrefix}/${encodeURIComponent(item.id)}`} className="group flex min-w-0 items-center gap-3 py-4 sm:gap-4">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-bold tabular-nums ${index === 0 ? "border-gold/40 bg-gold/15 text-gold-soft" : "border-midnight-border bg-midnight-card text-ink"}`}>{index + 1}</span>
                <Avatar src={item.image} name={item.name} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink group-hover:text-gold-soft">{item.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">{item.detail}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-ink">
                    <Star size={13} className="text-amber-400" fill="currentColor" aria-hidden="true" />
                    {item.averageRating.toFixed(1)}
                  </span>
                  <span className="block text-[10px] text-ink-muted">{reviewLabel(item.reviewCount)}</span>
                </span>
                <ArrowUpRight size={14} className="shrink-0 text-ink-muted transition group-hover:text-gold-soft" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-midnight-border/70 px-4 py-6 text-center text-sm text-ink-muted">{emptyLabel}</p>
      )}
    </section>
  );
}

export default function TopMakersPage() {
  const { t } = useTranslation();
  const leaderboardQuery = useQuery({
    queryKey: ["top-makers"],
    queryFn: async () => {
      const response = await fetch("/api/makers/leaderboard");
      if (!response.ok) throw new Error("leaderboard_load_failed");
      return (await response.json()) as {
        makers: LeaderboardMaker[];
        teams: ReviewedTeam[];
        applications: ReviewedApplication[];
      };
    },
  });

  if (leaderboardQuery.isLoading) {
    return <div className="space-y-4" aria-busy="true"><div className="skeleton h-44" /><div className="skeleton h-20" /><div className="skeleton h-20" /><div className="skeleton h-20" /></div>;
  }
  if (leaderboardQuery.isError) return <p role="alert" className="border-y border-rose-400/25 py-5 text-sm text-rose-300">{t("gamification.loadError")}</p>;

  const makers = leaderboardQuery.data?.makers ?? [];
  const teams = (leaderboardQuery.data?.teams ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    image: team.logoUrl,
    detail: `${team.memberCount} ${t(team.memberCount === 1 ? "gamification.teamMemberOne" : "gamification.teamMemberMany")} · ${team.tagline}`,
    reviewCount: team.reviewCount,
    averageRating: team.averageRating,
  }));
  const applications = (leaderboardQuery.data?.applications ?? []).map((application) => ({
    id: application.id,
    name: application.name,
    image: application.logoUrl,
    detail: `${t(`testerApplications.list.platform.${application.platform}`)} · ${t("gamification.applicationBy", { name: application.ownerName })}`,
    reviewCount: application.reviewCount,
    averageRating: application.averageRating,
  }));
  const [leader, ...remaining] = makers;
  const leaderScore = leader?.activityScore ?? 0;
  const leaderBreakdown = leader ? getActivityBreakdown(leader.activity, leader.weights) : [];
  const leaderCategoryMax = Math.max(1, ...leaderBreakdown.map((item) => item.score));

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <header className="border-b border-midnight-border pb-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-gold-soft"><Trophy size={14} aria-hidden="true" />{t("gamification.activeWindow")}</p>
        <h1 className="section-title mt-2">{t("gamification.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{t("gamification.subtitle")}</p>
        <details className="group mt-4 max-w-2xl rounded-xl border border-midnight-border/70 bg-midnight-card/40 px-4 py-3">
          <summary className="cursor-pointer list-none text-xs font-semibold text-ink marker:hidden">
            {t("gamification.rankingExplain")}
          </summary>
          <p className="mt-2 text-xs leading-5 text-ink-muted">{t("gamification.rankingMethod")}</p>
          {leaderboardQuery.data?.makers[0] && (
            <>
              <p className="mt-2 text-[11px] font-medium text-gold-soft">
                {t("gamification.rankingMinimumScore", { score: leaderboardQuery.data.makers[0].minimumScore })}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
                {([
                ["PROJECT", "rankingWeightProject"],
                ["TEAM", "rankingWeightTeam"],
                ["POST", "rankingWeightPost"],
                ["COMMENT", "rankingWeightComment"],
                ["FEEDBACK", "rankingWeightFeedback"],
                ["POLL", "rankingWeightPoll"],
                ["LIKE", "rankingWeightLike"],
                ["LIVE_SESSION", "rankingWeightSession"],
              ] as const).map(([type, labelKey]) => (
                <div key={type} className="flex items-center justify-between gap-2 text-[11px]">
                  <dt className="text-ink-muted">{t(`gamification.${labelKey}`)}</dt>
                  <dd className="font-semibold tabular-nums text-ink">+{leaderboardQuery.data.makers[0].weights[type]}</dd>
                </div>
              ))}
              </dl>
            </>
          )}
        </details>
      </header>

      {!leader ? <p className="py-12 text-center text-sm text-ink-muted">{t("gamification.emptyLeaderboard")}</p> : (
        <>
          <section aria-label={t("gamification.rank", { rank: leader.rank })} className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-midnight-card/50 to-transparent p-5 shadow-lg shadow-black/10 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-amber-500/50 bg-amber-400/15 text-amber-500">
                <Trophy size={27} aria-hidden="true" />
                <span className="absolute -bottom-2 -right-2 grid h-7 w-7 place-items-center rounded-full border-2 border-midnight-card bg-amber-400 text-[11px] font-black text-amber-950">1</span>
              </span>
              <Avatar src={leader.maker.image} name={leader.maker.name} size={64} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase text-gold-soft">{t("gamification.rank", { rank: leader.rank })}</p>
                <Link href={`/makers/${encodeURIComponent(leader.maker.handle ?? leader.maker.id)}`} className="mt-1 inline-flex max-w-full items-center gap-1 text-lg font-semibold text-ink hover:text-gold-soft">
                  <span className="truncate">{leader.maker.name ?? leader.maker.handle ?? "Maker"}</span><ArrowUpRight size={15} aria-hidden="true" />
                </Link>
                {leader.maker.headline && <p className="mt-1 truncate text-sm text-ink-muted">{leader.maker.headline}</p>}
                <div className="mt-2"><BadgeIconList badges={leader.maker.badges} size={16} /></div>
                <p className="mt-3 text-[11px] text-ink-muted">
                  {t("gamification.rankingBuild")}: {leader.activity.PROJECT + leader.activity.TEAM}
                  {" · "}{t("gamification.rankingPublish")}: {leader.activity.POST}
                  {" · "}{t("gamification.rankingCommunity")}: {leader.activity.COMMENT + leader.activity.FEEDBACK + leader.activity.POLL + leader.activity.LIKE + leader.activity.LIVE_SESSION}
                </p>
              </div>
              <div className="rounded-xl border border-gold/20 bg-midnight/40 px-5 py-3 sm:min-w-36 sm:text-right">
                <p className="text-2xl font-bold tabular-nums text-gold-soft">{leader.activityScore}</p>
                <p className="text-xs text-ink-muted">{t("gamification.activityScore")}</p>
                <p className="mt-1 text-[10px] text-ink-muted">{t("gamification.rankingFirstPlace")}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 border-t border-gold/15 pt-5 sm:grid-cols-3">
              {leaderBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-ink-muted">{t(`gamification.${item.label}`)}</span>
                    <span className="font-semibold tabular-nums text-ink">{item.score} <span className="font-normal text-ink-muted">· {item.count}</span></span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-midnight-border"
                    role="progressbar"
                    aria-label={t(`gamification.${item.label}`)}
                    aria-valuemin={0}
                    aria-valuemax={leaderCategoryMax}
                    aria-valuenow={item.score}
                  >
                    <div className={`${item.color} h-full rounded-full transition-[width]`} style={{ width: `${(item.score / leaderCategoryMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {remaining.length > 0 && <section aria-label={t("gamification.title")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-ink-muted">{t("gamification.scoreComparedToLeader")}</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {[
                  ["rankingBuild", "bg-sky-400"],
                  ["rankingPublish", "bg-violet-400"],
                  ["rankingCommunity", "bg-emerald-400"],
                ].map(([label, color]) => (
                  <li key={label} className="inline-flex items-center gap-1.5 text-[10px] text-ink-muted">
                    <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />{t(`gamification.${label}`)}
                  </li>
                ))}
              </ul>
            </div>
            <ol className="space-y-2">
              {remaining.map(({ rank, activityScore, activity, weights, maker }) => {
                const breakdown = getActivityBreakdown(activity, weights);
                const categoryTotal = Math.max(1, breakdown.reduce((sum, item) => sum + item.score, 0));
                const scoreRatio = Math.min(100, (activityScore / leaderScore) * 100);
                return (
                <li key={maker.id} className="rounded-xl border border-midnight-border bg-midnight-card/40 px-3 py-3 sm:px-4">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-xs font-bold tabular-nums ${rank === 2 ? "border-slate-400/50 bg-slate-200 text-slate-800" : rank === 3 ? "border-amber-500/40 bg-amber-100 text-amber-900" : "border-midnight-border bg-midnight-card text-ink"}`}>{rank}</span>
                  <Avatar src={maker.image} name={maker.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/makers/${encodeURIComponent(maker.handle ?? maker.id)}`} className="inline-flex max-w-full items-center gap-1 text-sm font-semibold text-ink hover:text-gold-soft">
                      <span className="truncate">{maker.name ?? maker.handle ?? "Maker"}</span><ArrowUpRight size={13} aria-hidden="true" />
                    </Link>
                    {maker.headline && <p className="truncate text-xs text-ink-muted">{maker.headline}</p>}
                    <div className="mt-1"><BadgeIconList badges={maker.badges} size={13} /></div>
                    <p className="mt-1 truncate text-[10px] text-ink-muted">
                      {t("gamification.rankingBuild")}: {activity.PROJECT + activity.TEAM}
                      {" · "}{t("gamification.rankingPublish")}: {activity.POST}
                      {" · "}{t("gamification.rankingCommunity")}: {activity.COMMENT + activity.FEEDBACK + activity.POLL + activity.LIKE + activity.LIVE_SESSION}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-gold-soft">{activityScore}</p>
                    <p className="text-[10px] text-ink-muted">{t("gamification.activityScore")}</p>
                  </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 pl-12 sm:pl-14">
                    <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-midnight-border" aria-label={t("gamification.activityBreakdown")}>
                      {breakdown.map((item) => (
                        <span key={item.label} className={`${item.color} h-full`} style={{ width: `${(item.score / categoryTotal) * 100}%` }} />
                      ))}
                    </div>
                    <div className="w-20 shrink-0" role="progressbar" aria-label={t("gamification.scoreComparedToLeader")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(scoreRatio)}>
                      <div className="h-1.5 overflow-hidden rounded-full bg-midnight-border">
                        <div className="h-full rounded-full bg-gold/80" style={{ width: `${scoreRatio}%` }} />
                      </div>
                    </div>
                    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-ink-muted">{Math.round(scoreRatio)}%</span>
                  </div>
                </li>
              );})}
            </ol>
          </section>}
        </>
      )}
      <ReviewLeaderboard
        title={t("gamification.topReviewedTeams")}
        description={t("gamification.topReviewedTeamsDescription")}
        hrefPrefix="/teams"
        items={teams}
        icon={UsersRound}
        reviewLabel={(count) => t(count === 1 ? "gamification.reviewOne" : "gamification.reviewMany", { count })}
        emptyLabel={t("gamification.noReviewedTeams")}
      />
      <ReviewLeaderboard
        title={t("gamification.topReviewedApplications")}
        description={t("gamification.topReviewedApplicationsDescription")}
        hrefPrefix="/tester-applications"
        items={applications}
        icon={FlaskConical}
        reviewLabel={(count) => t(count === 1 ? "gamification.reviewOne" : "gamification.reviewMany", { count })}
        emptyLabel={t("gamification.noReviewedApplications")}
      />
    </div>
  );
}
