"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Star } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { useTranslation } from "@/lib/i18n";

type ReviewItem = {
  id: string;
  rating: number;
  label: string;
  comment: string | null;
  createdAt: string;
  user: { id: string; name: string | null; handle: string | null; image: string | null };
};

type ReviewSummary = { average: number; total: number; ratingCounts: Record<number, number> };
type ReviewPagination = { page: number; pageSize: number; total: number; totalPages: number };

function ReviewsSectionSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="space-y-5">
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <div className="space-y-2"><div className="skeleton h-4 w-36" /><div className="skeleton h-3 w-56 max-w-full" /></div>
        <div className="flex items-center gap-2"><div className="skeleton h-7 w-12" /><div className="skeleton h-3 w-20" /></div>
      </div>
      <div className="space-y-3 rounded-xl border border-midnight-border p-4" aria-hidden="true">
        <div className="skeleton h-4 w-28" />
        <div className="flex gap-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton h-10 w-10 rounded-md" />)}</div>
        <div className="skeleton h-20 w-full rounded-lg" />
        <div className="skeleton h-9 w-28 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-3" aria-hidden="true"><div className="skeleton h-9 w-40 rounded-lg" /><div className="skeleton h-9 w-40 rounded-lg" /></div>
      <ul className="divide-y divide-midnight-border border-y border-midnight-border" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="space-y-3 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-3 w-20" />
            </div>
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-2/3" />
            <div className="flex items-center gap-2"><div className="skeleton h-7 w-7 rounded-full" /><div className="skeleton h-3 w-24" /></div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between" aria-hidden="true"><div className="skeleton h-8 w-28 rounded-lg" /><div className="skeleton h-8 w-28 rounded-lg" /></div>
    </div>
  );
}

export function ProjectReviews({ projectId, id = "reviews", embedded = false }: { projectId: string; id?: string; embedded?: boolean }) {
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [reviewRating, setReviewRating] = useState(0);
  const [hoveredReviewRating, setHoveredReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRatingFilter, setReviewRatingFilter] = useState("all");
  const [reviewDateSort, setReviewDateSort] = useState<"newest" | "oldest">("newest");
  const [reviewPage, setReviewPage] = useState(1);
  const hydratedProjectRef = useRef<string | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ["project-reviews", projectId, reviewRatingFilter, reviewDateSort, reviewPage],
    queryFn: async () => {
      const search = new URLSearchParams({ sort: reviewDateSort, page: String(reviewPage) });
      if (reviewRatingFilter !== "all") search.set("rating", reviewRatingFilter);
      const response = await fetch(`/api/projects/${projectId}/reviews?${search.toString()}`);
      if (!response.ok) throw new Error("reviews_load_failed");
      return (await response.json()) as { reviews: ReviewItem[]; userReview: ReviewItem | null; summary: ReviewSummary; pagination: ReviewPagination };
    },
  });

  useEffect(() => {
    if (!reviewsQuery.data || hydratedProjectRef.current === projectId) return;
    hydratedProjectRef.current = projectId;
    setReviewRating(reviewsQuery.data?.userReview?.rating ?? 0);
    setReviewComment(reviewsQuery.data?.userReview?.comment ?? "");
  }, [projectId, reviewsQuery.data]);

  const saveReview = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() || undefined }),
      });
      if (!response.ok) throw new Error("review_save_failed");
      return response.json();
    },
    onSuccess: async () => {
      setReviewRating(0);
      setHoveredReviewRating(0);
      setReviewComment("");
      await queryClient.invalidateQueries({ queryKey: ["project-reviews", projectId] });
    },
  });

  const reviewLabels = [
    t("projects.reviewLabels.1"),
    t("projects.reviewLabels.2"),
    t("projects.reviewLabels.3"),
    t("projects.reviewLabels.4"),
    t("projects.reviewLabels.5"),
  ];

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reviewRating >= 1 && reviewRating <= 5) saveReview.mutate();
  }

  return (
    <section id={id} aria-busy={reviewsQuery.isLoading} className={embedded ? "mt-4 space-y-5 rounded-xl border border-gold/20 bg-midnight-deep/40 p-4 sm:p-5" : "space-y-5 border-b border-midnight-border pb-7"}>
      {reviewsQuery.isLoading ? <ReviewsSectionSkeleton label={t("common.loading")} /> : <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{t("projects.reviewsTitle")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("projects.reviewsHint")}</p>
        </div>
        {reviewsQuery.data && <div className="flex items-center gap-2" aria-label={t("projects.reviewsAverage", { average: reviewsQuery.data.summary.average.toFixed(1), count: reviewsQuery.data.summary.total })}>
          <span className="text-2xl font-semibold tabular-nums text-ink">{reviewsQuery.data.summary.average.toFixed(1)}</span>
          <span className="flex flex-col gap-0.5">
            <span className="flex" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-[13px] w-[13px] ${index < Math.round(reviewsQuery.data!.summary.average) ? "text-gold" : "text-midnight-border"}`} />)}</span>
            <span className="text-[11px] text-ink-muted">{t("projects.reviewCount", { count: reviewsQuery.data.summary.total })}</span>
          </span>
        </div>}
      </div>

      <form onSubmit={submitReview} className="space-y-3 rounded-xl border border-gold/20 bg-[#13294B]/70 p-4">
        <div>
          <p className="text-sm font-medium text-ink">{t("projects.yourReview")}</p>
          <div className="mt-2 flex items-center gap-1" role="group" aria-label={t("projects.ratingLabel")} onMouseLeave={() => setHoveredReviewRating(0)}>
            {Array.from({ length: 5 }, (_, index) => {
              const score = index + 1;
              const label = reviewLabels[index];
              const isActive = (hoveredReviewRating || reviewRating) >= score;
              return <button key={score} type="button" onClick={() => setReviewRating(score)} onMouseEnter={() => setHoveredReviewRating(score)} aria-pressed={reviewRating === score} aria-label={t("projects.reviewStarAria", { rating: score, label })} className={`grid h-10 w-10 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${isActive ? "text-gold" : "text-ink-muted hover:text-gold"}`}>
                <Star size={25} className={isActive ? "text-gold" : "text-ink-muted"} aria-hidden="true" />
              </button>;
            })}
            {reviewRating > 0 && <span className="ml-2 text-sm font-medium text-gold-soft">{reviewLabels[reviewRating - 1]}</span>}
          </div>
        </div>
        <label className="block">
          <span className="sr-only">{t("projects.reviewComment")}</span>
          <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={2000} rows={3} className="input min-w-0 resize-y !rounded-xl" placeholder={t("projects.reviewPlaceholder")} />
        </label>
        {saveReview.isError && <p role="alert" className="text-xs text-rose-300">{t("projects.reviewError")}</p>}
        <button type="submit" disabled={saveReview.isPending || reviewRating === 0} className="btn-gold !rounded-lg">{saveReview.isPending ? t("projects.reviewSaving") : t("projects.submitReview")}</button>
      </form>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <span>{t("projects.filterByRating")}</span>
          <select value={reviewRatingFilter} onChange={(event) => { setReviewRatingFilter(event.target.value); setReviewPage(1); }} className="input !min-h-9 !w-auto !py-1.5">
            <option value="all">{t("projects.allRatings")}</option>
            {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} {t("projects.reviewStars")} ({reviewsQuery.data?.summary.ratingCounts[rating] ?? 0})</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <span>{t("projects.filterByDate")}</span>
          <select value={reviewDateSort} onChange={(event) => { setReviewDateSort(event.target.value as "newest" | "oldest"); setReviewPage(1); }} className="input !min-h-9 !w-auto !py-1.5">
            <option value="newest">{t("projects.newestReviews")}</option>
            <option value="oldest">{t("projects.oldestReviews")}</option>
          </select>
        </label>
      </div>

      {reviewsQuery.isError ? <p role="alert" className="text-sm text-rose-300">{t("projects.reviewsLoadError")}</p> : reviewsQuery.data?.reviews.length ? (
        <ul className="divide-y divide-midnight-border border-y border-midnight-border">
          {reviewsQuery.data.reviews.map((review) => {
            const authorName = review.user.name ?? (review.user.handle ? `@${review.user.handle}` : t("teams.unknownMember"));
            return (
              <li key={review.id} className="animate-fade-in py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex" aria-label={t("projects.reviewStarAria", { rating: review.rating, label: reviewLabels[review.rating - 1] })}>{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-[14px] w-[14px] ${index < review.rating ? "text-gold" : "text-midnight-border"}`} aria-hidden="true" />)}</span>
                    <span className="text-xs font-semibold text-gold-soft">{reviewLabels[review.rating - 1]}</span>
                  </div>
                  <time className="text-[11px] text-ink-muted" dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString(locale)}</time>
                </div>
                {review.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{review.comment}</p>}
                <Link href={`/makers/${encodeURIComponent(review.user.handle ?? review.user.id)}`} aria-label={t("feed.viewProfile", { name: authorName })} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md text-left transition hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
                  <Avatar src={review.user.image} name={review.user.name ?? review.user.handle} size={28} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-ink">{authorName}</span>
                    {review.user.name && review.user.handle && <span className="block text-[11px] text-ink-muted">@{review.user.handle}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-ink-muted">{t("projects.noReviews")}</p>}

      {reviewsQuery.data && reviewsQuery.data.pagination.totalPages > 1 && <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={t("projects.reviewsPagination")}>
        <button type="button" onClick={() => setReviewPage((page) => Math.max(1, page - 1))} disabled={reviewPage <= 1 || reviewsQuery.isFetching} className="btn-ghost !rounded-lg !px-3 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />{t("projects.reviewsPreviousPage")}
        </button>
        <span className="text-xs tabular-nums text-ink-muted">{t("projects.reviewsPage", { page: reviewsQuery.data.pagination.page, total: reviewsQuery.data.pagination.totalPages })}</span>
        <button type="button" onClick={() => setReviewPage((page) => Math.min(reviewsQuery.data?.pagination.totalPages ?? page, page + 1))} disabled={reviewPage >= reviewsQuery.data.pagination.totalPages || reviewsQuery.isFetching} className="btn-ghost !rounded-lg !px-3 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50">
          {t("projects.reviewsNextPage")}<ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>}
      </>}
    </section>
  );
}