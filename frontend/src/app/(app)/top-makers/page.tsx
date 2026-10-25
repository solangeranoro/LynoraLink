"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Trophy } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { BadgeIconList, type AwardedBadge } from "@/components/GamificationBadges";
import { useTranslation } from "@/lib/i18n";

type LeaderboardMaker = {
  rank: number;
  activityScore: number;
  maker: {
    id: string;
    name: string | null;
    image: string | null;
    handle: string | null;
    headline: string | null;
    badges: AwardedBadge[];
  };
};

export default function TopMakersPage() {
  const { t } = useTranslation();
  const leaderboardQuery = useQuery({
    queryKey: ["top-makers"],
    queryFn: async () => {
      const response = await fetch("/api/makers/leaderboard");
      if (!response.ok) throw new Error("leaderboard_load_failed");
      return (await response.json()).makers as LeaderboardMaker[];
    },
  });

  if (leaderboardQuery.isLoading) {
    return <div className="space-y-4" aria-busy="true"><div className="skeleton h-44" /><div className="skeleton h-20" /><div className="skeleton h-20" /><div className="skeleton h-20" /></div>;
  }
  if (leaderboardQuery.isError) return <p role="alert" className="border-y border-rose-400/25 py-5 text-sm text-rose-300">{t("gamification.loadError")}</p>;

  const makers = leaderboardQuery.data ?? [];
  const [leader, ...remaining] = makers;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <header className="border-b border-midnight-border pb-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-gold-soft"><Trophy size={14} aria-hidden="true" />{t("gamification.activeWindow")}</p>
        <h1 className="section-title mt-2">{t("gamification.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{t("gamification.subtitle")}</p>
      </header>

      {!leader ? <p className="py-12 text-center text-sm text-ink-muted">{t("gamification.emptyLeaderboard")}</p> : (
        <>
          <section aria-label={t("gamification.rank", { rank: leader.rank })} className="relative overflow-hidden border-y border-gold/30 bg-gradient-to-r from-gold/10 via-midnight-card/30 to-transparent px-5 py-6 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-gold/45 bg-gold/10 text-gold-soft"><Trophy size={25} aria-hidden="true" /></span>
              <Avatar src={leader.maker.image} name={leader.maker.name} size={64} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase text-gold-soft">{t("gamification.rank", { rank: leader.rank })}</p>
                <Link href={`/makers/${encodeURIComponent(leader.maker.handle ?? leader.maker.id)}`} className="mt-1 inline-flex max-w-full items-center gap-1 text-lg font-semibold text-ink hover:text-gold-soft">
                  <span className="truncate">{leader.maker.name ?? leader.maker.handle ?? "Maker"}</span><ArrowUpRight size={15} aria-hidden="true" />
                </Link>
                {leader.maker.headline && <p className="mt-1 truncate text-sm text-ink-muted">{leader.maker.headline}</p>}
                <div className="mt-2"><BadgeIconList badges={leader.maker.badges} size={16} /></div>
              </div>
              <div className="sm:text-right">
                <p className="text-2xl font-semibold tabular-nums text-gold-soft">{leader.activityScore}</p>
                <p className="text-xs text-ink-muted">{t("gamification.activityScore")}</p>
              </div>
            </div>
          </section>

          {remaining.length > 0 && <section aria-label={t("gamification.title")}>
            <ol className="divide-y divide-midnight-border border-y border-midnight-border">
              {remaining.map(({ rank, activityScore, maker }) => (
                <li key={maker.id} className="flex min-w-0 items-center gap-3 py-4 sm:gap-5">
                  <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums text-ink-muted">{rank}</span>
                  <Avatar src={maker.image} name={maker.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/makers/${encodeURIComponent(maker.handle ?? maker.id)}`} className="inline-flex max-w-full items-center gap-1 text-sm font-semibold text-ink hover:text-gold-soft">
                      <span className="truncate">{maker.name ?? maker.handle ?? "Maker"}</span><ArrowUpRight size={13} aria-hidden="true" />
                    </Link>
                    {maker.headline && <p className="truncate text-xs text-ink-muted">{maker.headline}</p>}
                    <div className="mt-1"><BadgeIconList badges={maker.badges} size={13} /></div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-gold-soft">{activityScore}</p>
                    <p className="text-[10px] text-ink-muted">{t("gamification.activityScore")}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>}
        </>
      )}
    </div>
  );
}
