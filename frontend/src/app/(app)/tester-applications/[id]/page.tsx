"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { ArrowLeft, Bug, Check, Clock3, ExternalLink, MessageCircle, Share2, Star, UsersRound, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/Avatar";

type AppStatus = "PENDING" | "APPROVED" | "REJECTED";
type Application = {
  id: string;
  name: string;
  description: string;
  problem: string | null;
  testInstructions: string;
  logoUrl: string | null;
  screenshotUrls: string[];
  platform: string;
  createdDate: string | null;
  websiteUrl: string | null;
  downloadUrl: string;
  technologies: string | null;
  ownerName: string;
  ownerTitle: string;
  ownerCity: string;
  ownerCountry: string;
  status: AppStatus;
  rejectionReason: string | null;
  shares: number;
  ownerId: string;
  canManage: boolean;
  createdAt: string;
  averageRating: number | null;
  reviewCount: number;
};
type Person = { id: string; name: string | null; handle: string | null; image: string | null };
type BugReport = { id: string; title: string | null; content: string | null; bugStatus: string; createdAt: string; author: Person };
type Interaction = {
  id: string;
  type: "REVIEW" | "COMMENT" | "POLL";
  title: string | null;
  content: string | null;
  rating: number | null;
  options: string[];
  createdAt: string;
  author: Person;
  voteCounts: Record<string, number>;
  userVote: string | null;
};

const platformLabels: Record<string, string> = { IOS: "iOS", ANDROID: "Android", WEB: "Web", DESKTOP: "Desktop" };

function displayName(person: Person, locale: string) {
  return person.name || (person.handle ? `@${person.handle}` : locale === "fr" ? "Membre LynoraLink" : "LynoraLink member");
}

function ApplicationDetailLoadingSkeleton({ label }: { label: string }) {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 xl:px-8" aria-busy="true" aria-label={label}>
      <div className="skeleton h-5 w-44" aria-hidden="true" />

      <nav className="flex flex-wrap gap-2" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-9 w-28 rounded-full" />)}
      </nav>

      <section className="card overflow-hidden rounded-3xl" aria-hidden="true">
        <div className="relative min-h-64 overflow-hidden bg-gradient-to-br from-emerald-300/[0.08] via-midnight-card/80 to-gold/[0.05] p-5 sm:p-8">
          <div className="absolute inset-0 skeleton opacity-30" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="skeleton h-20 w-20 shrink-0 rounded-3xl sm:h-[88px] sm:w-[88px]" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap gap-2"><div className="skeleton h-6 w-20 rounded-full" /><div className="skeleton h-4 w-36" /></div>
              <div className="skeleton h-9 w-2/3 max-w-80" />
              <div className="skeleton h-4 w-36" />
              <div className="space-y-2"><div className="skeleton h-4 w-full max-w-3xl" /><div className="skeleton h-4 w-4/5 max-w-2xl" /></div>
              <div className="skeleton h-3 w-56 max-w-full" />
            </div>
            <div className="skeleton h-10 w-32 shrink-0" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-midnight-border/70 bg-midnight-card/65 px-5 py-4 sm:px-8">
          <div className="skeleton h-10 w-32" />
          <div className="skeleton h-10 w-28" />
          <div className="skeleton h-4 w-48 max-w-full" />
        </div>
      </section>

      <section className="rounded-2xl border border-midnight-border bg-midnight-card/50 p-5 sm:p-6" aria-hidden="true">
        <div className="skeleton h-3 w-32" />
        <div className="mt-3 space-y-2"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-4/5" /></div>
      </section>

      <section className="rounded-2xl border border-midnight-border bg-midnight-card/50 p-5 sm:p-6" aria-hidden="true">
        <div className="skeleton h-3 w-36" />
        <div className="mt-3 space-y-2"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-2/3" /></div>
      </section>

      <section className="space-y-3" aria-hidden="true">
        <div className="skeleton h-6 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="skeleton aspect-video w-full rounded-2xl" />)}
        </div>
      </section>

      <section className="scroll-mt-24 space-y-5" aria-hidden="true">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2"><div className="skeleton h-8 w-56" /><div className="skeleton h-4 w-72 max-w-full" /></div>
          <div className="flex gap-2 rounded-xl border border-midnight-border bg-midnight-card/80 p-1">
            <div className="skeleton h-9 w-32 rounded-lg" /><div className="skeleton h-9 w-28 rounded-lg" />
          </div>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-5">
            <div className="card space-y-3 p-5">
              <div className="skeleton h-5 w-40" /><div className="skeleton h-20 w-full" /><div className="skeleton h-10 w-36" />
            </div>
            <div className="card space-y-3 p-5">
              <div className="skeleton h-5 w-32" /><div className="skeleton h-4 w-20" /><div className="skeleton h-10 w-full" /><div className="skeleton h-20 w-full" /><div className="skeleton h-10 w-36" />
            </div>
            <div className="card space-y-3 p-5">
              <div className="skeleton h-5 w-36" /><div className="skeleton h-10 w-full" /><div className="grid gap-2 sm:grid-cols-2"><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /></div><div className="skeleton h-10 w-40" />
            </div>
          </div>
          <div className="card min-h-80 space-y-4 p-5">
            <div className="skeleton h-5 w-40" />
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-3 border-t border-midnight-border/70 pt-4">
                <div className="flex items-center gap-3"><div className="skeleton h-9 w-9 rounded-full" /><div className="space-y-2"><div className="skeleton h-3 w-28" /><div className="skeleton h-3 w-20" /></div></div>
                <div className="space-y-2"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-4/5" /></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function TesterApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { t, locale } = useTranslation();
  const dateLocale = locale === "fr" ? "fr-FR" : "en-US";
  const [section, setSection] = useState<"bugs" | "interactions">("interactions");
  const [error, setError] = useState("");
  const [pendingInteraction, setPendingInteraction] = useState<"BUG_REPORT" | "COMMENT" | "REVIEW" | null>(null);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<number | null>(null);
  const hasScrolledToWorkspace = useRef(false);

  const applicationQuery = useQuery({
    queryKey: ["tester-application", id],
    queryFn: async () => {
      const response = await fetch(`/api/tester-applications/${id}`);
      if (!response.ok) throw new Error(response.status === 404 ? t("testerApplications.detail.notFound") : t("testerApplications.detail.loadApplicationError"));
      return (await response.json() as { application: Application }).application;
    },
  });
  useEffect(() => {
    if (!applicationQuery.data || !["#tester-workspace", "#tester-bugs"].includes(window.location.hash) || hasScrolledToWorkspace.current) return;
    const frame = window.requestAnimationFrame(() => {
      hasScrolledToWorkspace.current = true;
      if (window.location.hash === "#tester-bugs") setSection("bugs");
      document.getElementById("tester-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [applicationQuery.data]);
  const canManage = applicationQuery.data?.canManage ?? false;
  const isPublished = applicationQuery.data?.status === "APPROVED";
  const bugsQuery = useQuery({
    queryKey: ["tester-application-bugs", id],
    enabled: Boolean(isPublished),
    queryFn: async () => {
      const response = await fetch(`/api/tester-applications/${id}/bugs`);
      if (!response.ok) throw new Error(t("testerApplications.detail.loadBugsError"));
      return (await response.json() as { reports: BugReport[] }).reports;
    },
  });
  const interactionsQuery = useQuery({
    queryKey: ["tester-application-interactions", id],
    enabled: Boolean(isPublished),
    queryFn: async () => {
      const response = await fetch(`/api/tester-applications/${id}/interactions`);
      if (!response.ok) throw new Error(t("testerApplications.detail.loadInteractionsError"));
      return (await response.json() as { interactions: Interaction[] }).interactions;
    },
  });

  async function submitBug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingInteraction) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPendingInteraction("BUG_REPORT");
    try {
      if (await submit("/bugs", { title: form.get("title"), content: form.get("content") }, ["tester-application-bugs", id])) formElement.reset();
    } finally {
      setPendingInteraction(null);
    }
  }

  async function submitInteraction(event: FormEvent<HTMLFormElement>, kind: "COMMENT" | "REVIEW") {
    event.preventDefault();
    if (pendingInteraction) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = kind === "REVIEW"
      ? { kind, rating: Number(form.get("rating")), content: form.get("content") }
      : { kind, content: form.get("content") };
    setPendingInteraction(kind);
    try {
      const success = await submit("/interactions", body, ["tester-application-interactions", id]);
      if (success) {
        formElement.reset();
        if (kind === "REVIEW") {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["tester-application", id] }),
            queryClient.invalidateQueries({ queryKey: ["tester-applications"] }),
          ]);
        }
      }
    } finally {
      setPendingInteraction(null);
    }
  }

  async function submit(path: string, body: unknown, queryKey: unknown[]) {
    setError("");
    try {
      const response = await fetch(`/api/tester-applications/${id}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(t("testerApplications.detail.submitError"));
      await queryClient.invalidateQueries({ queryKey });
      return true;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("testerApplications.detail.submitError"));
      return false;
    }
  }

  async function vote(pollId: string, option: string) {
    if (votingPollId || pendingInteraction) return;
    setError("");
    setVotingPollId(pollId);
    try {
      const response = await fetch(`/api/tester-applications/${id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "VOTE", activityId: pollId, option }),
      });
      if (!response.ok) throw new Error(t("testerApplications.detail.voteError"));
      await queryClient.invalidateQueries({ queryKey: ["tester-application-interactions", id] });
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : t("testerApplications.detail.voteError"));
    } finally {
      setVotingPollId(null);
    }
  }

  async function shareApplication() {
    const application = applicationQuery.data;
    if (!application) return;
    setSharing(true);
    setError("");
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: application.name, text: t("testerApplications.detail.shareText", { name: application.name }), url });
      else {
        await navigator.clipboard.writeText(url);
      }
      await fetch(`/api/tester-applications/${id}`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["tester-application", id] });
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") return;
      setError(t("testerApplications.detail.shareError"));
    } finally {
      setSharing(false);
    }
  }

  function scrollToSection(event: MouseEvent<HTMLAnchorElement>, sectionId: string) {
    event.preventDefault();
    window.history.replaceState(null, "", `#${sectionId}`);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }

  if (applicationQuery.isLoading) return <ApplicationDetailLoadingSkeleton label={t("testerApplications.detail.loading")} />;
  if (applicationQuery.isError || !applicationQuery.data) return <main className="mx-auto max-w-3xl px-4 py-12"><div role="alert" className="card p-6 text-center"><h1 className="text-xl font-semibold text-ink">{t("testerApplications.detail.notFound")}</h1><p className="mt-2 text-sm text-ink-muted">{applicationQuery.error instanceof Error ? applicationQuery.error.message : t("testerApplications.detail.inaccessible")}</p><Link href="/tester-applications" className="btn-ghost mt-5"><ArrowLeft size={16} /> {t("testerApplications.detail.backToList")}</Link></div></main>;
  const application = applicationQuery.data;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 xl:px-8">
      <Link href="/tester-applications" className="inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"><ArrowLeft size={16} /> {t("testerApplications.detail.back")}</Link>
      {application.status !== "APPROVED" ? (
        <section className="card mx-auto max-w-3xl p-6 sm:p-9">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${application.status === "PENDING" ? "bg-amber-300/10 text-amber-200" : "bg-rose-300/10 text-rose-200"}`}>
            {application.status === "PENDING" ? <Clock3 size={14} /> : <Check size={14} />}
            {application.status === "PENDING" ? t("testerApplications.detail.pending") : t("testerApplications.detail.rejected")}
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink">{application.name}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{application.status === "PENDING" ? t("testerApplications.detail.pendingDescription") : application.rejectionReason || t("testerApplications.detail.rejectedFallback")}</p>
        </section>
      ) : (
        <>
          <nav aria-label={t("testerApplications.detail.pageSections")} className="flex flex-wrap gap-2">
            <a href="#app-overview" onClick={(event) => scrollToSection(event, "app-overview")} className="rounded-full border border-midnight-border bg-midnight-card/60 px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-emerald-300/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">{t("testerApplications.detail.overview")}</a>
            <a href="#test-guide" onClick={(event) => scrollToSection(event, "test-guide")} className="rounded-full border border-midnight-border bg-midnight-card/60 px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-emerald-300/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">{t("testerApplications.detail.testPath")}</a>
            {application.screenshotUrls.length > 0 && <a href="#app-screenshots" onClick={(event) => scrollToSection(event, "app-screenshots")} className="rounded-full border border-midnight-border bg-midnight-card/60 px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-emerald-300/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">{t("testerApplications.detail.screenshots")}</a>}
            <a href="#tester-workspace" onClick={(event) => scrollToSection(event, "tester-workspace")} className="rounded-full border border-midnight-border bg-midnight-card/60 px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-emerald-300/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">{t("testerApplications.detail.testerSpace")}</a>
            {canManage && <Link href={`/tester-applications/${id}/manage`} className="rounded-full border border-gold/25 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-soft transition hover:border-gold/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">{t("testerApplications.detail.manageSpace")}</Link>}
          </nav>

          <section id="app-overview" className="card relative isolate scroll-mt-24 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-300/[0.08] via-midnight-card/80 to-gold/[0.05]">
            <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 -z-10 h-64 w-64 rounded-full border border-emerald-300/10 bg-emerald-300/[0.04] blur-2xl" />
            {application.screenshotUrls[0] && (
              <button
                id="app-screenshots"
                type="button"
                onClick={() => setSelectedScreenshot(0)}
                aria-label={t("testerApplications.detail.openScreenshot", { number: 1 })}
                className="group absolute inset-0 z-0 cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/60"
              >
                <Image
                  src={application.screenshotUrls[0]}
                  alt={t("testerApplications.detail.screenshotAlt", { number: 1, name: application.name })}
                  fill
                  unoptimized
                  sizes="(max-width: 1280px) 100vw, 1152px"
                  className="object-cover opacity-50 transition duration-300 group-hover:opacity-60"
                />
                <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-midnight-deep/80 via-midnight-deep/65 to-midnight-card/60" />
              </button>
            )}
            <div className="relative z-10 flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:p-8">
              {application.logoUrl ? <Image src={application.logoUrl} alt="" width={88} height={88} unoptimized className="h-20 w-20 shrink-0 rounded-3xl border border-midnight-border object-cover sm:h-[88px] sm:w-[88px]" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-emerald-300/10 font-display text-3xl font-bold text-emerald-100 sm:h-[88px] sm:w-[88px]">{application.name.slice(0, 1)}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-200"><span className="rounded-full bg-emerald-300/10 px-2.5 py-1">{platformLabels[application.platform] ?? application.platform}</span><span>{application.ownerCity}, {application.ownerCountry}</span></div>
                <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{application.name}</h1>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm" aria-label={`${application.averageRating?.toFixed(1) ?? "—"} · ${t(application.reviewCount === 1 ? "testerApplications.detail.reviewCountOne" : "testerApplications.detail.reviewCount", { count: application.reviewCount })}`}>
                  <Star size={15} className="text-amber-300" fill="currentColor" aria-hidden="true" />
                  <span className="font-semibold text-amber-100">{application.averageRating?.toFixed(1) ?? "—"}</span>
                  <span className="text-xs text-ink-muted">{t(application.reviewCount === 1 ? "testerApplications.detail.reviewCountOne" : "testerApplications.detail.reviewCount", { count: application.reviewCount })}</span>
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{application.description}</p>
                <p className="mt-3 text-xs text-ink-muted">{t("testerApplications.detail.createdBy")} <span className="font-medium text-ink">{application.ownerName}</span> · {application.ownerTitle}</p>
              </div>
              <button type="button" disabled={sharing} onClick={shareApplication} className="btn-ghost shrink-0"><Share2 size={16} /> {sharing ? t("testerApplications.detail.sharing") : t("testerApplications.detail.share", { count: application.shares })}</button>
            </div>
            <div className="relative z-10 flex flex-wrap items-center gap-3 border-t border-midnight-border/70 bg-midnight-card/65 px-5 py-4 backdrop-blur-sm sm:px-8">
              <a href={application.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-gold">{t("testerApplications.detail.testApp")} <ExternalLink size={15} /></a>
              {application.websiteUrl && <a href={application.websiteUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">{t("testerApplications.detail.website")} <ExternalLink size={15} /></a>}
              {application.technologies && <span className="self-center text-xs text-ink-muted">{t("testerApplications.detail.technologies", { value: application.technologies })}</span>}
            </div>
          </section>

          {application.problem && <section className="scroll-mt-24 rounded-2xl border border-midnight-border bg-midnight-card/50 p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.detail.problem")}</p><p className="mt-2 text-sm leading-6 text-ink-muted">{application.problem}</p></section>}
          <section id="test-guide" className="scroll-mt-24 rounded-2xl border border-midnight-border bg-midnight-card/50 p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.detail.testPath")}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{application.testInstructions}</p></section>
          {application.screenshotUrls.length > 1 && <section id="app-screenshot-gallery" aria-label={t("testerApplications.detail.screenshots")} className="scroll-mt-24 space-y-3"><h2 className="font-display text-xl font-semibold text-ink">{t("testerApplications.detail.screenshots")}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{application.screenshotUrls.slice(1).map((url, index) => <button key={`${url}-${index + 1}`} type="button" onClick={() => setSelectedScreenshot(index + 1)} aria-label={t("testerApplications.detail.openScreenshot", { number: index + 2 })} className="group relative overflow-hidden rounded-2xl border border-midnight-border bg-white text-left transition hover:border-emerald-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"><Image src={url} alt={t("testerApplications.detail.screenshotAlt", { number: index + 2, name: application.name })} width={800} height={600} unoptimized className="aspect-video w-full object-contain transition duration-300 group-hover:scale-[1.02]" /><span className="sr-only">{t("testerApplications.detail.openScreenshot", { number: index + 2 })}</span></button>)}</div></section>}

          <section id="tester-workspace" className="scroll-mt-24 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><h2 className="font-display text-2xl font-semibold text-ink">{t("testerApplications.detail.testerSpace")}</h2><p className="mt-1 text-sm text-ink-muted">{t("testerApplications.detail.testerSpaceDescription")}</p></div>
              <div className="flex rounded-xl border border-midnight-border bg-midnight-card/80 p-1">
                <button type="button" aria-pressed={section === "interactions"} onClick={() => setSection("interactions")} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-none ${section === "interactions" ? "bg-gold/15 text-gold-soft shadow-[inset_0_0_0_1px_rgb(var(--gold-soft)/0.28)]" : "text-ink-muted hover:bg-midnight-deep/10 hover:text-ink"}`}><UsersRound size={14} /> {t("testerApplications.detail.interactions")}</button>
                <button type="button" aria-pressed={section === "bugs"} onClick={() => setSection("bugs")} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-none ${section === "bugs" ? "bg-gold/15 text-gold-soft shadow-[inset_0_0_0_1px_rgb(var(--gold-soft)/0.28)]" : "text-ink-muted hover:bg-midnight-deep/10 hover:text-ink"}`}><Bug size={14} /> {t("testerApplications.detail.bugReports")}</button>
              </div>
            </div>

            {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
            {section === "bugs" ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <form onSubmit={submitBug} className="card space-y-4 p-5">
                  <h3 className="font-semibold text-ink">{t("testerApplications.detail.reportProblem")}</h3>
                  <label className="block"><span className="mb-1.5 block text-sm text-ink-muted">{t("testerApplications.detail.bugTitle")} *</span><input name="title" required minLength={3} maxLength={120} className="input w-full" placeholder={t("testerApplications.detail.bugTitlePlaceholder")} /></label>
                  <label className="block"><span className="mb-1.5 block text-sm text-ink-muted">{t("testerApplications.detail.bugDetails")} *</span><textarea name="content" required minLength={10} maxLength={3000} rows={5} className="input w-full" placeholder={t("testerApplications.detail.bugDetailsPlaceholder")} /></label>
                  <button type="submit" disabled={pendingInteraction !== null} className="btn-gold disabled:cursor-not-allowed disabled:opacity-50"><Bug size={15} /> {t("testerApplications.detail.sendBug")}</button>
                </form>
                <div className="card space-y-4 p-5">
                  <div className="flex items-center justify-between"><h3 className="font-semibold text-ink">{t("testerApplications.detail.allBugReports")}</h3><span className="text-xs text-ink-muted">{bugsQuery.data?.length ?? 0}</span></div>
                  {bugsQuery.isLoading ? (
                    <p className="text-sm text-ink-muted">{t("testerApplications.detail.loading")}</p>
                  ) : bugsQuery.isError ? (
                    <p role="alert" className="text-sm text-rose-200">{t("testerApplications.detail.loadBugsError")}</p>
                  ) : bugsQuery.data?.length ? (
                    bugsQuery.data.map((report) => {
                      const authorName = displayName(report.author, locale);
                      return (
                        <article key={report.id} className="border-t border-midnight-border/70 pt-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <h4 className="text-sm font-semibold text-ink">{report.title}</h4>
                            <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[10px] text-amber-200">{t(`testerApplications.detail.bugStatus.${report.bugStatus}`)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{report.content}</p>
                          <div className="mt-3 inline-flex min-w-0 items-center gap-2">
                            <Avatar src={report.author.image} name={authorName} size={28} />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-ink">{authorName}</span>
                              <span className="block text-[10px] text-ink-muted">{new Date(report.createdAt).toLocaleDateString(dateLocale)}</span>
                            </span>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="py-6 text-center text-sm text-ink-muted">{t("testerApplications.detail.noBugs")}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="space-y-5">
                  <form onSubmit={(event) => submitInteraction(event, "COMMENT")} className="card space-y-3 p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-ink"><MessageCircle size={16} className="text-emerald-200" /> {t("testerApplications.detail.comment")}</h3>
                    <textarea name="content" required minLength={1} maxLength={2000} rows={3} className="input w-full" placeholder={t("testerApplications.detail.shareExperience")} />
                    <button type="submit" disabled={pendingInteraction !== null} className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"><MessageCircle size={15} /> {t("testerApplications.detail.publishComment")}</button>
                  </form>
                  <form onSubmit={(event) => submitInteraction(event, "REVIEW")} className="card space-y-3 p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-ink"><Star size={16} className="text-amber-200" /> {t("testerApplications.detail.review")}</h3>
                    <label className="block">
                      <span className="mb-1.5 block text-xs text-ink-muted">{t("testerApplications.detail.rating")}</span>
                      <Select name="rating" required defaultValue="5">
                        <SelectTrigger className="h-11 w-full rounded-xl border-midnight-border bg-midnight-deep/60 px-3 text-sm text-ink shadow-sm transition hover:border-amber-300/30 focus-visible:border-amber-300/50 focus-visible:ring-2 focus-visible:ring-amber-300/15">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-300/10 text-amber-200"><Star size={14} fill="currentColor" aria-hidden="true" /></span>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-midnight-border bg-midnight-card p-1.5 shadow-2xl">
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <SelectItem key={rating} value={String(rating)} className="min-h-10 rounded-lg px-3 py-2 text-sm text-ink focus:bg-midnight-deep focus:text-ink">
                              <span className="inline-flex items-center gap-2">
                                <span className="flex text-amber-200" aria-hidden="true">{Array.from({ length: rating }).map((_, index) => <Star key={index} size={12} fill="currentColor" />)}</span>
                                <span>{t("testerApplications.detail.ratingValue", { rating: String(rating) })}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <textarea name="content" required minLength={3} maxLength={2000} rows={3} className="input w-full" placeholder={t("testerApplications.detail.reviewPlaceholder")} />
                    <button type="submit" disabled={pendingInteraction !== null} className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"><Star size={15} /> {t("testerApplications.detail.publishReview")}</button>
                  </form>
                </div>
                <section aria-labelledby="tester-activity-title" className="card space-y-4 p-5 lg:max-h-[calc(100dvh-8rem)] lg:overscroll-contain lg:overflow-y-auto">
                  <h3 id="tester-activity-title" className="font-semibold text-ink">{t("testerApplications.detail.activityTitle")}</h3>
                  {interactionsQuery.isLoading ? <p className="text-sm text-ink-muted">{t("testerApplications.detail.loading")}</p> : interactionsQuery.isError ? <p role="alert" className="text-sm text-rose-200">{t("testerApplications.detail.loadInteractionsError")}</p> : interactionsQuery.data?.length ? interactionsQuery.data.map((item) => (
                    <article key={item.id} className="border-t border-midnight-border/70 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-emerald-200">{t(`testerApplications.detail.activity${item.type === "REVIEW" ? "Review" : item.type === "POLL" ? "Poll" : "Comment"}`)}</span>
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Avatar src={item.author.image} name={displayName(item.author, locale)} size={28} />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-ink">{displayName(item.author, locale)}</span>
                            <span className="block text-[10px] text-ink-muted">{new Date(item.createdAt).toLocaleDateString(dateLocale)}</span>
                          </span>
                        </span>
                      </div>
                      {item.type === "POLL" ? (
                        <>
                          <p className="mt-2 text-sm font-medium text-ink">{item.title}</p>
                          <p className="mt-1 text-xs text-ink-muted">{t("testerApplications.detail.votes", { count: Object.values(item.voteCounts).reduce((total, count) => total + count, 0) })}</p>
                          <div className="mt-3 space-y-2">
                            {item.options.map((option) => {
                              const count = item.voteCounts[option] ?? 0;
                              const totalVotes = Object.values(item.voteCounts).reduce((total, votes) => total + votes, 0);
                              const percentage = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                              const selected = item.userVote === option;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  aria-pressed={selected}
                                  disabled={votingPollId !== null || pendingInteraction !== null}
                                  onClick={() => void vote(item.id, option)}
                                  className={`w-full rounded-xl border px-3 py-2 text-left transition disabled:cursor-wait disabled:opacity-60 ${selected ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-midnight-border bg-midnight-card/80 text-ink-muted hover:border-emerald-300/30"}`}
                                >
                                  <span className="flex items-center justify-between gap-3 text-sm">
                                    <span>{option}</span>
                                    <span className="shrink-0 text-xs tabular-nums">{count} · {percentage}%</span>
                                  </span>
                                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-midnight-border/70">
                                    <span className={`block h-full rounded-full transition-[width] ${selected ? "bg-emerald-300" : "bg-emerald-300/50"}`} style={{ width: `${percentage}%` }} />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-xs text-ink-muted">{t("testerApplications.detail.changeVoteHint")}</p>
                        </>
                      ) : (
                        <>
                          {item.type === "REVIEW" && item.rating && <div className="mt-2 flex gap-1 text-amber-200" aria-label={t("testerApplications.detail.ratingValue", { rating: item.rating })}>{Array.from({ length: item.rating }).map((_, index) => <Star key={index} size={14} fill="currentColor" />)}</div>}
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{item.content}</p>
                        </>
                      )}
                    </article>
                  )) : <p className="py-8 text-center text-sm text-ink-muted">{t("testerApplications.detail.emptyInteractions")}</p>}
                </section>
              </div>
            )}
          </section>
          <Dialog open={selectedScreenshot !== null} onOpenChange={(open) => { if (!open) setSelectedScreenshot(null); }}>
            <DialogContent showCloseButton={false} aria-label={t("testerApplications.detail.screenshots")} className="w-[calc(100%-1rem)] max-w-6xl gap-3 border-midnight-border bg-midnight-deep p-3 text-ink shadow-2xl sm:w-[calc(100%-3rem)] sm:p-5">
              <div className="flex items-start justify-between gap-4 pr-1">
                <div>
                  <DialogTitle className="text-base font-semibold">{application.name}</DialogTitle>
                  {selectedScreenshot !== null && <DialogDescription className="mt-1 text-xs text-ink-muted">{t("testerApplications.detail.screenshotAlt", { number: selectedScreenshot + 1, name: application.name })}</DialogDescription>}
                </div>
                <button type="button" autoFocus onClick={() => setSelectedScreenshot(null)} aria-label={t("testerApplications.detail.closeScreenshot")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-midnight-border text-ink-muted transition hover:bg-midnight-card hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              {selectedScreenshot !== null && (
                <div className="relative h-[min(78dvh,850px)] w-full">
                  <Image src={application.screenshotUrls[selectedScreenshot]} alt={t("testerApplications.detail.screenshotAlt", { number: selectedScreenshot + 1, name: application.name })} fill unoptimized sizes="96vw" className="object-contain" />
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </main>
  );
}
