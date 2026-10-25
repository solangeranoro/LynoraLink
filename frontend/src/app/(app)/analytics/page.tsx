"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Activity, ArrowLeft, ArrowRight, BarChart3, MessageCircle, FolderKanban, ThumbsUp } from "@/components/FontAwesomeIcons";
import { POST_REACTIONS, ReactionArtwork, type ReactionType } from "@/components/ReactionPicker";
import { useTranslation } from "@/lib/i18n";

type AnalyticsData = {
  projects: number;
  posts: number;
  reactions: number;
  comments: number;
  activity: { date: string; posts: number; engagement: number }[];
  distribution: Record<string, number>;
  reactionDistribution: Record<string, number>;
  topPosts: { id: string; excerpt: string; imageUrl: string | null; tags: string[]; type: string; createdAt: string; reactions: number; comments: number; engagement: number }[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const CHART_LEFT = 48;
const CHART_RIGHT = 590;
const CHART_TOP = 20;
const CHART_BOTTOM = 184;
const CHART_WIDTH = CHART_RIGHT - CHART_LEFT;
const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP;

function curvePath(values: number[], max: number) {
  const points = values.map((value, index) => ({
    x: CHART_LEFT + (values.length > 1 ? (index / (values.length - 1)) * CHART_WIDTH : CHART_WIDTH / 2),
    y: CHART_BOTTOM - (value / max) * CHART_HEIGHT,
  }));
  if (points.length < 2) return `M ${CHART_LEFT} ${CHART_BOTTOM} L ${CHART_RIGHT} ${CHART_BOTTOM}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const beforePrevious = points[index - 2] ?? previous;
    const next = points[index + 1] ?? point;
    const firstControlX = previous.x + (point.x - beforePrevious.x) / 6;
    const firstControlY = previous.y + (point.y - beforePrevious.y) / 6;
    const secondControlX = point.x - (next.x - previous.x) / 6;
    const secondControlY = point.y - (next.y - previous.y) / 6;
    return `${path} C ${firstControlX} ${firstControlY}, ${secondControlX} ${secondControlY}, ${point.x} ${point.y}`;
  }, "");
}

function chartMaximum(value: number) {
  if (value <= 0) return 4;
  const roughStep = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  return Math.ceil(value / step) * step;
}

function numberLabel(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

function paginationItems(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}

function AnimatedActivityChart({ data, isFrench, locale }: {
  data: { date: string; posts: number; engagement: number }[];
  isFrench: boolean;
  locale: string;
}) {
  const postsPath = useRef<SVGPathElement>(null);
  const engagementPath = useRef<SVGPathElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const paths = [postsPath.current, engagementPath.current].filter((path): path is SVGPathElement => path !== null);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const lengths = paths.map((path) => path.getTotalLength());

    if (reducedMotion) {
      paths.forEach((path) => {
        path.style.strokeDasharray = "";
        path.style.strokeDashoffset = "";
      });
      return;
    }

    paths.forEach((path, index) => {
      path.style.strokeDasharray = `${lengths[index]}`;
      path.style.strokeDashoffset = `${lengths[index]}`;
    });
    const start = performance.now();
    const draw = (now: number) => {
      const progress = Math.min(1, (now - start) / 1500);
      const eased = 1 - (1 - progress) ** 3;
      paths.forEach((path, index) => {
        path.style.strokeDashoffset = `${lengths[index] * (1 - eased)}`;
      });
      if (progress < 1) frame = window.requestAnimationFrame(draw);
      else paths.forEach((path) => {
        path.style.strokeDasharray = "";
        path.style.strokeDashoffset = "";
      });
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [data]);

  const max = chartMaximum(Math.max(0, ...data.flatMap(({ posts, engagement }) => [posts, engagement])));
  const postsLine = curvePath(data.map(({ posts }) => posts), max);
  const engagementLine = curvePath(data.map(({ engagement }) => engagement), max);
  const postsArea = `${postsLine} L ${CHART_RIGHT} ${CHART_BOTTOM} L ${CHART_LEFT} ${CHART_BOTTOM} Z`;
  const labels = data.length > 0
    ? [0, Math.floor((data.length - 1) / 4), Math.floor((data.length - 1) / 2), Math.floor((data.length - 1) * 3 / 4), data.length - 1]
      .filter((index, position, indices) => indices.indexOf(index) === position)
    : [];
  const hovered = hoveredIndex === null ? null : data[hoveredIndex];
  const tooltipLeft = hoveredIndex === null || data.length < 2
    ? 0
    : Math.max(0, Math.min(78, (hoveredIndex / (data.length - 1)) * 100 - 10));

  return (
    <div className="relative">
      {hovered && (
        <div id="analytics-chart-tooltip" aria-live="polite" className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-xl border border-midnight-border bg-midnight-card/95 p-3 text-xs shadow-xl backdrop-blur" style={{ left: `${tooltipLeft}%` }}>
          <p className="mb-2 font-semibold text-ink">{new Intl.DateTimeFormat(isFrench ? "fr-FR" : "en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${hovered.date}T00:00:00Z`))}</p>
          <p className="flex items-center justify-between gap-4 text-ink-muted"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-gold" />{isFrench ? "Publications" : "Posts"}</span><strong className="text-ink">{hovered.posts}</strong></p>
          <p className="mt-1 flex items-center justify-between gap-4 text-ink-muted"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-400" />{isFrench ? "Interactions" : "Engagement"}</span><strong className="text-ink">{hovered.engagement}</strong></p>
        </div>
      )}
      <svg
        viewBox="0 0 600 220"
        preserveAspectRatio="none"
        role="img"
        aria-label={isFrench ? "Courbe animée des publications et interactions des 30 derniers jours" : "Animated chart of posts and engagement over the last 30 days"}
        aria-describedby={hovered ? "analytics-chart-tooltip" : undefined}
        className="h-56 w-full overflow-visible"
        tabIndex={0}
        onPointerMove={(event) => {
          if (!data.length) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * 600;
          const index = Math.round(((viewBoxX - CHART_LEFT) / CHART_WIDTH) * Math.max(data.length - 1, 0));
          setHoveredIndex(Math.max(0, Math.min(data.length - 1, index)));
        }}
        onPointerLeave={() => setHoveredIndex(null)}
        onFocus={() => setHoveredIndex((current) => current ?? Math.max(0, data.length - 1))}
        onBlur={() => setHoveredIndex(null)}
        onKeyDown={(event) => {
          if (!data.length) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setHoveredIndex((current) => Math.max(0, (current ?? data.length - 1) - 1));
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            setHoveredIndex((current) => Math.min(data.length - 1, (current ?? -1) + 1));
          } else if (event.key === "Escape") {
            setHoveredIndex(null);
          }
        }}
      >
        <defs>
          <linearGradient id="analytics-posts-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#d8a94f" stopOpacity=".25" />
            <stop offset="100%" stopColor="#d8a94f" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="analytics-engagement-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity=".14" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }, (_, index) => {
          const value = (max / 4) * (4 - index);
          const y = CHART_TOP + (CHART_HEIGHT / 4) * index;
          return (
            <g key={value}>
              <line x1={CHART_LEFT} x2={CHART_RIGHT} y1={y} y2={y} stroke="currentColor" strokeOpacity={index === 4 ? ".24" : ".12"} strokeDasharray={index === 4 ? undefined : "3 5"} className="text-ink-muted" />
              <text x={CHART_LEFT - 10} y={y + 3} textAnchor="end" fill="currentColor" fillOpacity=".65" fontSize="10" className="text-ink-muted">{numberLabel(value, locale)}</text>
            </g>
          );
        })}
        {data.length > 1 && <path d={`${engagementLine} L ${CHART_RIGHT} ${CHART_BOTTOM} L ${CHART_LEFT} ${CHART_BOTTOM} Z`} fill="url(#analytics-engagement-area)" />}
        {data.length > 1 && <path d={postsArea} fill="url(#analytics-posts-area)" />}
        <path ref={postsPath} d={postsLine} fill="none" stroke="#d8a94f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path ref={engagementPath} d={engagementLine} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hoveredIndex !== null && data.length > 0 && (
          <g pointerEvents="none">
            <line x1={CHART_LEFT + (hoveredIndex / Math.max(data.length - 1, 1)) * CHART_WIDTH} x2={CHART_LEFT + (hoveredIndex / Math.max(data.length - 1, 1)) * CHART_WIDTH} y1={CHART_TOP} y2={CHART_BOTTOM} stroke="currentColor" strokeOpacity=".35" strokeDasharray="3 4" className="text-ink-muted" />
            <circle cx={CHART_LEFT + (hoveredIndex / Math.max(data.length - 1, 1)) * CHART_WIDTH} cy={CHART_BOTTOM - (data[hoveredIndex].posts / max) * CHART_HEIGHT} r="5" fill="#d8a94f" stroke="#101728" strokeWidth="2" />
            <circle cx={CHART_LEFT + (hoveredIndex / Math.max(data.length - 1, 1)) * CHART_WIDTH} cy={CHART_BOTTOM - (data[hoveredIndex].engagement / max) * CHART_HEIGHT} r="5" fill="#34d399" stroke="#101728" strokeWidth="2" />
          </g>
        )}
        {labels.map((index) => (
          <text key={index} x={CHART_LEFT + (index / Math.max(data.length - 1, 1)) * CHART_WIDTH} y="211" textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} fill="currentColor" fillOpacity=".7" fontSize="10" className="text-ink-muted">
            {new Intl.DateTimeFormat(isFrench ? "fr-FR" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${data[index].date}T00:00:00Z`))}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function AnalyticsPage() {
  const { locale, t } = useTranslation();
  const isFrench = locale === "fr";
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["analytics", page],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?page=${page}`);
      if (!response.ok) throw new Error(`analytics_load_failed_${response.status}`);
      return response.json() as Promise<AnalyticsData>;
    },
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const pageCount = Math.max(1, data?.pagination.totalPages ?? 1);
  const pageItems = paginationItems(data?.pagination.page ?? page, pageCount);
  const firstPost = data?.pagination.total ? (data.pagination.page - 1) * data.pagination.pageSize + 1 : 0;
  const lastPost = Math.min((data?.pagination.page ?? page) * (data?.pagination.pageSize ?? 0), data?.pagination.total ?? 0);
  useEffect(() => {
    if (data && !query.isPlaceholderData && data.pagination.page !== page) {
      setPage(data.pagination.page);
    }
  }, [data, page, query.isPlaceholderData]);
  const number = new Intl.NumberFormat(locale);
  const date = (value: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(value));
  const summary = [
    { label: isFrench ? "Projets" : "Projects", value: data?.projects ?? 0, icon: FolderKanban },
    { label: isFrench ? "Publications" : "Posts", value: data?.posts ?? 0, icon: BarChart3 },
    { label: isFrench ? "Réactions" : "Reactions", value: data?.reactions ?? 0, icon: ThumbsUp },
    { label: isFrench ? "Commentaires" : "Comments", value: data?.comments ?? 0, icon: MessageCircle },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{isFrench ? "Votre activité" : "Your activity"}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">{isFrench ? "Analytics" : "Analytics"}</h1>
        <p className="mt-2 text-sm text-ink-muted">{isFrench ? "Suivez la portée de vos projets et publications." : "Track the reach of your projects and posts."}</p>
      </header>

      {query.isLoading && <p role="status" className="text-sm text-ink-muted">{isFrench ? "Chargement des analytics…" : "Loading analytics…"}</p>}
      {query.isError && <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{isFrench ? "Impossible de charger vos analytics. Réessayez." : "Could not load your analytics. Please try again."}<button type="button" onClick={() => void query.refetch()} className="ml-3 underline">{isFrench ? "Réessayer" : "Retry"}</button></div>}

      {data && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.map(({ label, value, icon: Icon }) => (
              <article key={label} className="card flex items-center gap-4 p-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold-soft"><Icon size={18} aria-hidden="true" /></span>
                <div><p className="text-xs text-ink-muted">{label}</p><p className="mt-1 text-2xl font-semibold text-ink">{number.format(value)}</p></div>
              </article>
            ))}
          </section>

          <section className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-base font-semibold text-ink">{isFrench ? "Activité sur 30 jours" : "30-day activity"}</h2><p className="mt-1 text-xs text-ink-muted">{isFrench ? "Publications et interactions reçues" : "Posts and engagement received"}</p></div>
              <div className="flex gap-4 text-xs"><span className="flex items-center gap-2 text-ink-muted"><i className="h-2 w-2 rounded-full bg-gold" />{isFrench ? "Publications" : "Posts"}</span><span className="flex items-center gap-2 text-ink-muted"><i className="h-2 w-2 rounded-full bg-emerald-400" />{isFrench ? "Interactions" : "Engagement"}</span></div>
            </div>
            <div className="mt-5"><AnimatedActivityChart data={data.activity} isFrench={isFrench} locale={locale} /></div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">{isFrench ? "Types de publications" : "Post types"}</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(data.distribution).length === 0 && <p className="text-sm text-ink-muted">{isFrench ? "Aucune publication pour le moment." : "No posts yet."}</p>}
                {Object.entries(data.distribution).map(([type, count]) => {
                  const percent = data.posts ? count / data.posts * 100 : 0;
                  return <div key={type}><div className="flex justify-between text-sm"><span className="text-ink-muted">{type}</span><span className="text-ink">{number.format(count)}</span></div><div className="mt-2 h-2 rounded-full bg-midnight-border"><div className="h-2 rounded-full bg-gold" style={{ width: `${percent}%` }} /></div></div>;
                })}
              </div>
            </section>
            <section className="card p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">{isFrench ? "Types de réactions" : "Reaction types"}</h2>
              <div className="mt-4 space-y-3">
                {POST_REACTIONS.map((reaction: ReactionType) => {
                  const count = data.reactionDistribution[reaction] ?? 0;
                  const percent = data.reactions ? count / data.reactions * 100 : 0;
                  return <article key={reaction} className="flex min-w-0 items-center gap-3 rounded-xl border border-midnight-border/80 bg-midnight-deep/40 p-3 transition hover:border-gold/25 hover:bg-midnight-deep/70">
                    <ReactionArtwork reaction={reaction} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{t(`feed.reactions.${reaction}`)}</p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-midnight-border"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} /></div>
                    </div>
                    <span className="min-w-8 text-right text-lg font-semibold tabular-nums text-ink">{number.format(count)}</span>
                  </article>;
                })}
              </div>
            </section>
          </div>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight-border p-4 sm:px-5">
              <div><h2 className="text-base font-semibold text-ink">{isFrench ? "Publications les plus interactives" : "Top posts"}</h2><p className="mt-1 text-xs text-ink-muted">{isFrench ? "Classées par réactions et commentaires" : "Ranked by reactions and comments"}</p></div>
              <p className="text-xs tabular-nums text-ink-muted" aria-live="polite">{isFrench ? `${number.format(firstPost)}–${number.format(lastPost)} sur ${number.format(data.pagination.total)} publications` : `${number.format(firstPost)}–${number.format(lastPost)} of ${number.format(data.pagination.total)} posts`}</p>
            </div>
            {data.topPosts.length ? <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              {data.topPosts.map((post) => <article key={post.id} className="card flex min-w-0 flex-col overflow-hidden border border-midnight-border/80 transition hover:-translate-y-0.5 hover:border-gold/30">
                {post.imageUrl && <div className="relative aspect-[16/9] w-full overflow-hidden bg-midnight-deep"><Image src={post.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" /></div>}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-gold/20 bg-gold/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold-soft">{post.type}</span>
                    <span className="text-xs text-ink-muted">{date(post.createdAt)}</span>
                  </div>
                  <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap text-sm leading-6 text-ink">{post.excerpt}{post.excerpt.length >= 180 ? "…" : ""}</p>
                  {post.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{post.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-md bg-midnight-deep px-2 py-1 text-[10px] text-ink-muted">#{tag}</span>)}</div>}
                  <div className="mt-4 flex items-center justify-between border-t border-midnight-border/70 pt-3">
                    <div className="flex items-center gap-3 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1.5"><ReactionArtwork reaction="like" size={20} /><span>{number.format(post.reactions)}</span></span>
                      <span className="inline-flex items-center gap-1.5"><MessageCircle size={15} /><span>{number.format(post.comments)}</span></span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold-soft"><Activity size={13} />{number.format(post.engagement)}</span>
                  </div>
                </div>
              </article>)}
            </div> : <p className="p-5 text-sm text-ink-muted">{isFrench ? "Vos publications apparaîtront ici." : "Your posts will appear here."}</p>}
            {data.pagination.totalPages > 1 && (
              <nav aria-label={isFrench ? "Pagination des publications" : "Posts pagination"} className="flex flex-wrap items-center justify-center gap-1 border-t border-midnight-border p-3 sm:justify-between sm:px-5">
                <p className="hidden text-xs text-ink-muted sm:block">{isFrench ? `Page ${data.pagination.page} sur ${data.pagination.totalPages}` : `Page ${data.pagination.page} of ${data.pagination.totalPages}`}</p>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={data.pagination.page <= 1 || query.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label={isFrench ? "Page précédente" : "Previous page"} className="grid h-9 w-9 place-items-center rounded-lg border border-midnight-border text-ink-muted transition hover:bg-midnight-card hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={15} aria-hidden="true" /></button>
                  {pageItems.map((item, index) => item === "ellipsis"
                    ? <span key={`ellipsis-${index}`} aria-hidden="true" className="grid h-9 min-w-7 place-items-center text-sm text-ink-muted">…</span>
                    : <button key={item} type="button" disabled={query.isFetching} onClick={() => setPage(item)} aria-label={isFrench ? `Aller à la page ${item}` : `Go to page ${item}`} aria-current={item === data.pagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-lg border px-2 text-sm tabular-nums transition disabled:cursor-wait ${item === data.pagination.page ? "border-gold/50 bg-gold/10 font-semibold text-gold-soft" : "border-transparent text-ink-muted hover:border-midnight-border hover:bg-midnight-card hover:text-ink"}`}>{item}</button>)}
                  <button type="button" disabled={data.pagination.page >= data.pagination.totalPages || query.isFetching} onClick={() => setPage((current) => Math.min(data.pagination.totalPages, current + 1))} aria-label={isFrench ? "Page suivante" : "Next page"} className="grid h-9 w-9 place-items-center rounded-lg border border-midnight-border text-ink-muted transition hover:bg-midnight-card hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight size={15} aria-hidden="true" /></button>
                </div>
              </nav>
            )}
          </section>
        </>
      )}
    </main>
  );
}
