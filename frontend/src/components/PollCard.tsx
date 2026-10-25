"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "@/components/FontAwesomeIcons";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/lib/i18n";

type PollType = "OPTIONS" | "STAR" | "TEXT";
const TEXT_ANSWERS_PER_PAGE = 5;

export type PostPoll = {
  id: string;
  type: PollType;
  question: string;
  options: string[];
  totalVotes: number;
  voteCounts: number[];
  myVote: number | null;
  resultsVisible: boolean;
  textAnswers: { answer: string; votes: number }[];
  myAnswer: string | null;
};

export function PollCard({ postId, poll }: { postId: string; poll: PostPoll }) {
  const { t, locale } = useTranslation();
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState(poll.myAnswer ?? "");
  const [selectedRating, setSelectedRating] = useState<number | null>(poll.myVote === null ? null : poll.myVote + 1);
  const [textAnswerPage, setTextAnswerPage] = useState(1);
  const userId = session?.user?.id ?? "anonymous";
  const { data: results = poll } = useQuery({
    queryKey: ["post-poll", postId, userId],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}/poll`);
      if (!response.ok) throw new Error("poll_load_failed");
      return response.json() as Promise<PostPoll>;
    },
    initialData: poll,
    staleTime: 15_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    setSelectedRating(results.myVote === null ? null : results.myVote + 1);
  }, [results.myVote, userId]);
  const voteMutation = useMutation({
    mutationFn: async (vote: { optionIndex: number } | { rating: number } | { answer: string }) => {
      const response = await fetch(`/api/posts/${postId}/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vote),
      });
      if (!response.ok) throw new Error("poll_vote_failed");
      return response.json() as Promise<Pick<PostPoll, "totalVotes" | "voteCounts" | "myVote" | "textAnswers" | "myAnswer" | "resultsVisible">>;
    },
    onSuccess: async (vote) => {
      queryClient.setQueryData<PostPoll>(["post-poll", postId, userId], (current) => current ? { ...current, ...vote } : current);
      if (vote.myAnswer) setAnswer(vote.myAnswer);
      if (vote.myVote !== null) setSelectedRating(vote.myVote + 1);
      if (vote.myAnswer) setTextAnswerPage(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["post-poll", postId] }),
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
      ]);
    },
  });
  const averageRating = results.totalVotes
    ? results.voteCounts.reduce((total, count, index) => total + count * (index + 1), 0) / results.totalVotes
    : 0;
  const formattedAverageRating = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(averageRating);
  const textAnswerPageCount = Math.ceil(results.textAnswers.length / TEXT_ANSWERS_PER_PAGE);
  const visibleTextAnswers = results.textAnswers.slice(
    (textAnswerPage - 1) * TEXT_ANSWERS_PER_PAGE,
    textAnswerPage * TEXT_ANSWERS_PER_PAGE,
  );
  useEffect(() => {
    setTextAnswerPage((page) => Math.min(page, Math.max(1, textAnswerPageCount)));
  }, [textAnswerPageCount]);

  return (
    <section id={`post-poll-${postId}`} className="mt-4 space-y-3 rounded-xl border border-gold/20 bg-midnight-deep/40 p-4" aria-label={t("feed.poll")}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{poll.question}</h3>
        <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">{t("feed.pollVoteCount", { count: results.totalVotes })}</span>
      </div>
      {poll.type === "TEXT" ? (
        <>
          <form onSubmit={(event) => { event.preventDefault(); voteMutation.mutate({ answer: answer.trim() }); }} className="flex flex-col gap-2 sm:flex-row">
            <input value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={500} required disabled={!session?.user?.id || voteMutation.isPending} placeholder={t("feed.pollAnswerPlaceholder")} aria-label={t("feed.pollAnswerLabel")} className="input min-w-0 flex-1 !rounded-lg" />
            <button type="submit" disabled={!session?.user?.id || !answer.trim() || voteMutation.isPending} className="btn-gold !rounded-xl !px-4 !py-2 text-xs">
              {voteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {results.myAnswer ? t("feed.pollUpdateAnswer") : t("feed.pollSubmitAnswer")}
            </button>
          </form>
          {results.resultsVisible && results.textAnswers.length > 0 && (
            <>
              <ul className="space-y-2" aria-label={t("feed.pollResults")}>
                {visibleTextAnswers.map(({ answer: text, votes }) => (
                  <li key={text} className="flex items-center justify-between gap-3 rounded-lg border border-midnight-border bg-midnight-card/60 px-3 py-2 text-xs">
                    <span className="min-w-0 break-words text-ink">{text}</span>
                    <span className="shrink-0 tabular-nums text-gold-soft">{t("feed.pollVoteCount", { count: votes })}</span>
                  </li>
                ))}
              </ul>
              {textAnswerPageCount > 1 && (
                <nav className="flex items-center justify-between gap-3" aria-label={t("feed.pollAnswerPagination")}>
                  <button
                    type="button"
                    onClick={() => setTextAnswerPage((page) => Math.max(1, page - 1))}
                    disabled={textAnswerPage === 1}
                    className="text-xs font-medium text-gold-soft transition hover:text-gold-bright disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("feed.pollPreviousAnswers")}
                  </button>
                  <span className="text-[11px] tabular-nums text-ink-muted">
                    {t("feed.pollAnswerPage", { current: textAnswerPage, total: textAnswerPageCount })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTextAnswerPage((page) => Math.min(textAnswerPageCount, page + 1))}
                    disabled={textAnswerPage === textAnswerPageCount}
                    className="text-xs font-medium text-gold-soft transition hover:text-gold-bright disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("feed.pollNextAnswers")}
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      ) : poll.type === "STAR" ? (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs text-ink-muted">{t("feed.pollStarSelectHint")}</legend>
            <div className="flex items-center gap-1" aria-label={t("feed.pollResults")}>
              {results.options.map((_, index) => {
                const rating = index + 1;
                const isSelected = selectedRating === rating;
                const isFilled = selectedRating !== null && rating <= selectedRating;
                return (
                  <label key={rating} className="group cursor-pointer">
                    <input
                      type="radio"
                      name={`poll-rating-${postId}`}
                      value={rating}
                      checked={isSelected}
                      onChange={() => setSelectedRating(rating)}
                      disabled={!session?.user?.id || voteMutation.isPending}
                      aria-label={t("feed.pollStarVote", { count: rating })}
                      className="peer sr-only"
                    />
                    <span className={`grid h-11 w-11 place-items-center rounded-lg transition hover:bg-gold/10 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-gold/60 ${isSelected ? "bg-gold/10" : ""}`}>
                      {isFilled ? (
                        <Star className="h-6 w-6 fill-gold text-gold" aria-hidden="true" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-ink-muted transition-colors group-hover:text-gold" aria-hidden="true">
                          <path d="m12 3.5 2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.78l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z" />
                        </svg>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-xs text-ink-muted">
              {selectedRating ? t("feed.pollStarSelected", { count: selectedRating }) : t("feed.pollStarSelectHint")}
            </p>
            <button
              type="button"
              disabled={!session?.user?.id || selectedRating === null || selectedRating === (results.myVote === null ? null : results.myVote + 1) || voteMutation.isPending}
              onClick={() => { if (selectedRating !== null) voteMutation.mutate({ rating: selectedRating }); }}
              className="btn-gold min-h-10 justify-center !rounded-lg !px-4 !py-2 text-xs"
            >
              {voteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {results.myVote === null ? t("feed.pollStarSubmit") : t("feed.pollStarUpdate")}
            </button>
          </div>
          {sessionStatus === "unauthenticated" && <p className="text-xs text-ink-muted">{t("feed.pollSignInToVote")}</p>}
          {results.resultsVisible ? (
            <div className="space-y-3 border-t border-midnight-border pt-3" aria-label={t("feed.pollResults")}>
              {results.totalVotes > 0 ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
                  <span>{formattedAverageRating} / 5</span>
                  <span className="text-xs font-normal text-ink-muted">{t("feed.pollAverageRating")} · {t("feed.pollVoteCount", { count: results.totalVotes })}</span>
                </p>
              ) : (
                <p className="text-xs text-ink-muted">{t("feed.pollNoRatingsYet")}</p>
              )}
              <ul className="space-y-2">
                {results.voteCounts.map((count, index) => {
                  const rating = index + 1;
                  const percentage = results.totalVotes ? Math.round((count / results.totalVotes) * 100) : 0;
                  return (
                    <li key={rating} className="grid grid-cols-[2.5rem_minmax(0,1fr)_3.25rem] items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-ink-muted"><Star className="h-3 w-3 fill-gold text-gold" aria-hidden="true" />{rating}</span>
                      <span role="meter" aria-label={t("feed.pollRatingDistribution", { count: rating })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} className="h-2 overflow-hidden rounded-full bg-midnight-border">
                        <span className="block h-full rounded-full bg-gold transition-[width]" style={{ width: `${percentage}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-ink-muted">{percentage}% · {count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : <p className="border-t border-midnight-border pt-3 text-xs text-ink-muted">{t("feed.pollResultsAfterVote")}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {results.options.map((option, index) => {
            const count = results.voteCounts[index] ?? 0;
            const percentage = results.totalVotes ? Math.round((count / results.totalVotes) * 100) : 0;
            const showResults = results.resultsVisible;
            return (
              <button key={`${index}-${option}`} type="button" disabled={!session?.user?.id || voteMutation.isPending} onClick={() => voteMutation.mutate({ optionIndex: index })} aria-pressed={results.myVote === index} className={`relative flex min-h-10 w-full items-center justify-between gap-3 overflow-hidden rounded-md border px-3 text-left text-xs transition ${results.myVote === index ? "border-gold/50 text-ink" : "border-midnight-border text-ink-muted hover:border-gold/35 hover:text-ink"} disabled:cursor-default`}>
                {showResults && <span className="absolute inset-y-0 left-0 bg-gold/10 transition-[width]" style={{ width: `${percentage}%` }} aria-hidden="true" />}
                <span className="relative min-w-0 flex-1 truncate">{option}</span>
                {showResults && <span className="relative shrink-0 tabular-nums">{percentage}% · {count}</span>}
              </button>
            );
          })}
        </div>
      )}
      {sessionStatus === "unauthenticated" && poll.type !== "STAR" && <p className="text-xs text-ink-muted">{t("feed.pollSignInToVote")}</p>}
      {!results.resultsVisible && poll.type !== "STAR" && <p className="text-xs text-ink-muted">{t("feed.pollResultsAfterVote")}</p>}
      {voteMutation.isError && <p role="alert" className="text-xs text-rose-300">{t("feed.pollVoteError")}</p>}
    </section>
  );
}