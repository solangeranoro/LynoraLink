"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "@/components/FontAwesomeIcons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartColumn, faComment, faEye, faFileCode, faFolderOpen, faImage, faListUl, faPaperclip, faPaperPlane, faPen, faPlus, faRocket, faSpinner, faTrash, faUsers, faXmark } from "@fortawesome/free-solid-svg-icons";
import { Activity, ReviewIcon, UsersRound } from "@/components/FontAwesomeIcons";
import { PostCard, type FeedPost, type PostIntent } from "@/components/PostCard";
import { PostMarkdown } from "@/components/PostMarkdown";
import { CodeBlock } from "@/components/CodeBlock";
import { FeedSkeleton } from "@/components/skeletons";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { useTranslation } from "@/lib/i18n";
import { useSession } from "next-auth/react";

type ComposerProject = {
  id: string;
  title: string;
  teamName: string | null;
  logoUrl: string | null;
};

type ComposerPostType = "PERSONAL" | "TEAM" | "PROJECT";
type ComposerPollType = "STAR" | "OPTIONS";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
  previewLoaded: boolean;
};

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

type FeedPagination = { page: number; pageSize: number; total: number; totalPages: number };
type FeedResponse = { posts: FeedPost[]; pagination?: FeedPagination };

async function fetchFeed(projectId?: string, teamId?: string, page?: number): Promise<FeedResponse> {
  const params = new URLSearchParams(page ? { take: "10", page: String(page) } : { take: "20" });
  if (projectId) params.set("projectId", projectId);
  if (teamId) params.set("teamId", teamId);
  const res = await fetch(`/api/posts?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load feed");
  return await res.json() as FeedResponse;
}

async function fetchComposerProjects(type: ComposerPostType, teamId?: string): Promise<ComposerProject[]> {
  const endpoint = type === "TEAM"
    ? "/api/projects?teams=1"
    : teamId
      ? `/api/projects?teamId=${encodeURIComponent(teamId)}`
      : "/api/projects?projects=1";
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error("Failed to load projects");
  const data = await res.json();
  const available = teamId && type === "PROJECT"
    ? data.projects
    : data.projects.filter((project: { collaborators?: { status: string }[] }) => project.collaborators?.some((member) => member.status === "APPROVED"));
  return available.map((project: { id: string; title: string; teamName: string | null; logoUrl: string | null }) => ({ id: project.id, title: project.title, teamName: project.teamName, logoUrl: project.logoUrl }));
}

export function Feed({ projectId, teamId, projectLabel, teamLogoUrl, canCompose = true, defaultPostType = "PERSONAL", showHeading = true }: { projectId?: string; teamId?: string; projectLabel?: string; teamLogoUrl?: string | null; canCompose?: boolean; defaultPostType?: ComposerPostType; showHeading?: boolean }) {
  const { t, locale } = useTranslation();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [codeLang, setCodeLang] = useState("");
  const [codeSnippetOpen, setCodeSnippetOpen] = useState(false);
  const [intent, setIntent] = useState<PostIntent>("progress");
  const [postType, setPostType] = useState<ComposerPostType>(defaultPostType);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollType, setPollType] = useState<ComposerPollType>("STAR");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [feedPage, setFeedPage] = useState(1);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const composerContentRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const attachmentBytes = attachments.reduce((total, attachment) => total + attachment.file.size, 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (composerOpen && !dialog.open) {
      dialog.showModal();
      if (composerContentRef.current) composerContentRef.current.scrollTop = 0;
    }
    if (!composerOpen && dialog.open) dialog.close();
  }, [composerOpen]);

  useEffect(() => {
    setPostType(defaultPostType);
  }, [defaultPostType, projectId, teamId]);

  useEffect(() => {
    setFeedPage(1);
  }, [projectId]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 3_500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  function closeComposer() {
    setComposerOpen(false);
  }

  function openComposer() {
    setComposerOpen(true);
  }

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["composer", "choices", postType, teamId ?? "all"],
    queryFn: () => fetchComposerProjects(postType, teamId),
    enabled: Boolean(session?.user) && !projectId && !(teamId && postType === "TEAM"),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["feed", projectId ?? teamId ?? "all", projectId ? feedPage : null],
    queryFn: () => fetchFeed(projectId, teamId, projectId ? feedPage : undefined),
    refetchInterval: projectId ? false : 3_000,
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/posts", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.set("content", content.trim());
          formData.set("type", postType);
          formData.set("tags", JSON.stringify([intent]));
          if (codeSnippet.trim()) {
            formData.set("codeSnippet", codeSnippet);
            formData.set("codeLang", codeLang.trim());
          }
          if (pollEnabled) {
            formData.set("pollType", pollType);
            formData.set("pollQuestion", pollQuestion.trim());
            if (pollType === "OPTIONS") formData.set("pollOptions", JSON.stringify(pollOptions.map((option) => option.trim()).filter(Boolean)));
          }
          if (postType === "TEAM") {
            const selectedTeam = teamId ?? selectedProjectId;
            if (selectedTeam) formData.set("teamId", selectedTeam);
          } else if (postType === "PROJECT") {
            const selectedProject = projectId ?? selectedProjectId;
            if (selectedProject) formData.set("projectId", selectedProject);
            if (teamId) formData.set("teamId", teamId);
          }
          attachments.forEach(({ file }) => formData.append("attachments", file, file.name));
          return formData;
        })(),
      });
      if (!res.ok) throw new Error("Failed to post");
      return res.json();
    },
    onSuccess: () => {
      setContent("");
      setCodeSnippet("");
      setCodeLang("");
      setCodeSnippetOpen(false);
      setIntent("progress");
      setPostType(defaultPostType);
      setPreviewMode(false);
      setPollEnabled(false);
      setPollType("STAR");
      setPollQuestion("");
      setPollOptions(["", ""]);
      setSelectedProjectId("");
      setFeedPage(1);
      attachments.forEach(({ previewUrl }) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      });
      setAttachments([]);
      setAttachmentError("");
      setToastMessage(t("feed.postSuccess"));
      closeComposer();
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const intents: { id: PostIntent; label: string; icon: typeof Activity }[] = [
    { id: "progress", label: t("feed.intentProgress"), icon: Activity },
    { id: "feedback", label: t("feed.intentFeedback"), icon: ReviewIcon },
    { id: "co-building", label: t("feed.intentCollaboration"), icon: UsersRound },
  ];
  const pollIsValid = !pollEnabled || (
    pollQuestion.trim().length >= 5 &&
    (pollType === "STAR" || (pollOptions.filter((option) => option.trim()).length >= 2 && pollOptions.filter((option) => option.trim()).length <= 5))
  );
  const selectedProject = postType === "TEAM" ? teamId ?? selectedProjectId : projectId ?? selectedProjectId;
  const selectedTeam = projects.find((project) => project.id === selectedProjectId);
  const composerIdentity = postType === "TEAM"
    ? {
      name: teamId ? projectLabel ?? t("feed.postTypeTeam") : selectedTeam?.teamName ?? selectedTeam?.title ?? t("feed.postTypeTeam"),
      image: teamId ? teamLogoUrl : selectedTeam?.logoUrl,
    }
    : postType === "PERSONAL"
      ? { name: session?.user?.name ?? t("feed.postTypePersonal"), image: session?.user?.image }
      : null;
  const postContextIsValid = postType === "PERSONAL" || Boolean(selectedProject);
  const postTypeOptions: { id: ComposerPostType; label: string; description: string; icon: typeof faRocket }[] = [
    { id: "PERSONAL", label: t("feed.postTypePersonal"), description: t("feed.postTypePersonalHint"), icon: faComment },
    { id: "TEAM", label: t("feed.postTypeTeam"), description: t("feed.postTypeTeamHint"), icon: faUsers },
    { id: "PROJECT", label: t("feed.postTypeProject"), description: t("feed.postTypeProjectHint"), icon: faFolderOpen },
  ];

  function insertFormatting(before: string, after = before) {
    const input = contentInputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = content.slice(start, end);
    const nextContent = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    setContent(nextContent);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + before.length, end + before.length);
    });
    createPost.reset();
  }

  function insertListPrefix() {
    const input = contentInputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const nextContent = `${content.slice(0, lineStart)}- ${content.slice(lineStart)}`;
    setContent(nextContent);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + 2, start + 2);
    });
    createPost.reset();
  }

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;
    if (attachments.length + selectedFiles.length > MAX_ATTACHMENT_COUNT) {
      setAttachmentError(t("feed.attachmentCountLimit"));
      return;
    }
    const addedBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
    if (attachmentBytes + addedBytes > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(t("feed.attachmentSizeLimit"));
      return;
    }
    const newAttachments = selectedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : undefined,
      previewLoaded: false,
    }));
    setAttachments((current) => [...current, ...newAttachments]);
    setAttachmentError("");
    createPost.reset();
  }

  function removeAttachment(id: string) {
    const attachment = attachments.find((item) => item.id === id);
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachments((current) => current.filter((item) => item.id !== id));
    setAttachmentError("");
    createPost.reset();
  }

  function markPreviewLoaded(id: string) {
    setAttachments((current) => current.map((attachment) => attachment.id === id ? { ...attachment, previewLoaded: true } : attachment));
  }

  function formatFileSize(bytes: number) {
    const isMegabytes = bytes >= 1024 * 1024;
    const value = isMegabytes ? bytes / (1024 * 1024) : bytes / 1024;
    const unit = isMegabytes ? t("feed.megabytes") : t("feed.kilobytes");
    return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} ${unit}`;
  }

  return (
    <section className="mx-auto w-full max-w-3xl min-w-0 space-y-4">
      {showHeading && (
        <div className="flex min-w-0 items-end justify-between gap-3">
          <div>
            <h2 className="section-title">{projectId || teamId ? t("teams.recentPosts") : t("feed.title")}</h2>
            <p className="text-sm text-ink-muted">{projectId || teamId ? t("teams.teamFeedSubtitle") : t("feed.subtitle")}</p>
          </div>
        </div>
      )}

      {session?.user && canCompose && (
        <>
          <div className="card -mx-4 flex w-[calc(100%+2rem)] max-w-none items-center gap-3 rounded-none border-x-0 p-3 sm:mx-auto sm:w-full sm:max-w-3xl sm:rounded-xl sm:border-x sm:p-5">
            <Avatar src={session.user.image} name={session.user.name} size={40} />
            <button
              type="button"
              onClick={() => {
                setAttachmentError("");
                createPost.reset();
                openComposer();
              }}
              aria-haspopup="dialog"
              className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-midnight-border bg-midnight-deep/50 px-4 text-left text-sm text-ink-muted transition hover:border-gold/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
            >
              <span className="truncate">{t("feed.composerOpen")}</span>
              <FontAwesomeIcon icon={faPlus} className="h-4 w-4 shrink-0 text-gold-soft" aria-hidden="true" />
            </button>
          </div>
          {toastMessage && (
            <p role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 right-4 z-[70] animate-slide-up rounded-xl border border-gold/30 bg-midnight-card px-4 py-3 text-sm text-gold-soft shadow-glow sm:left-auto sm:right-6 sm:w-fit">
              {toastMessage}
            </p>
          )}

          <dialog
            ref={dialogRef}
            aria-labelledby="post-composer-title"
            onCancel={(event) => {
              event.preventDefault();
              closeComposer();
            }}
            onClose={() => {
              setComposerOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeComposer();
              }
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeComposer();
            }}
            className="fixed inset-0 !m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-midnight-card p-0 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:inset-0 sm:!m-auto sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:rounded-xl sm:border"
          >
            <form
              className="flex h-full min-h-0 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                createPost.mutate();
              }}
            >
              <header className="shrink-0 space-y-4 border-b border-midnight-border bg-midnight-card px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 sm:px-6 sm:py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {composerIdentity ? <Avatar src={composerIdentity.image} name={composerIdentity.name} size={40} /> : <Logo size={38} className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 bg-midnight-deep" />}
                    <div className="min-w-0">
                      <h3 id="post-composer-title" className="text-base font-semibold text-ink">{t("feed.createPostTitle")}</h3>
                      {composerIdentity && <p className="truncate text-xs font-medium text-gold-soft">{composerIdentity.name}</p>}
                      <p className="mt-1 text-sm text-ink-muted">{t("feed.composerSubtitle")}</p>
                    </div>
                  </div>
                  <button type="button" onClick={closeComposer} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
                    <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-midnight-border bg-midnight-deep/60 p-1" role="tablist" aria-label={t("feed.postTypeLabel")}>
                  {postTypeOptions.map(({ id, label }) => (
                    <button key={id} type="button" role="tab" aria-selected={postType === id} disabled={(Boolean(projectId) && id !== defaultPostType) || (Boolean(teamId) && id === "PERSONAL")} onClick={() => { setPostType(id); setSelectedProjectId(""); createPost.reset(); }} className="min-h-10 min-w-0 rounded-md px-2 text-xs font-medium text-ink-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 aria-selected:bg-gold/10 aria-selected:text-gold-soft disabled:cursor-not-allowed disabled:opacity-40">
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </header>

              <div ref={composerContentRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
                <div className="space-y-5">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {t("feed.intentLabel")}
                  </p>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-midnight-border bg-midnight-deep/50 p-1" role="group" aria-label={t("feed.intentLabel")}>
                    {intents.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={intent === id}
                        onClick={() => {
                          setIntent(id);
                          createPost.reset();
                        }}
                        className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition sm:text-xs ${
                          intent === id
                            ? "bg-midnight-card text-gold-soft shadow-sm"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        <Icon size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <section>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-lg border border-midnight-border bg-midnight-deep/50 p-0.5" role="group" aria-label={t("feed.markdownPreview")}>
                      <button type="button" onClick={() => setPreviewMode(false)} aria-pressed={!previewMode} className="rounded-md px-2 py-1 text-[10px] text-ink-muted aria-pressed:bg-midnight-card aria-pressed:text-gold-soft"><FontAwesomeIcon icon={faPen} className="mr-1 inline h-3 w-3" aria-hidden="true" />{t("feed.write")}</button>
                      <button type="button" onClick={() => setPreviewMode(true)} aria-pressed={previewMode} className="rounded-md px-2 py-1 text-[10px] text-ink-muted aria-pressed:bg-midnight-card aria-pressed:text-gold-soft"><FontAwesomeIcon icon={faEye} className="mr-1 inline h-3 w-3" aria-hidden="true" />{t("feed.preview")}</button>
                    </div>
                    <p className="text-[11px] text-ink-muted">{t("feed.markdownHint")}</p>
                    <span id="post-character-count" className={`ml-auto text-[11px] tabular-nums ${content.length > 2800 ? "text-amber-300" : "text-ink-muted"}`}>
                      {content.length} / 3000 {t("feed.characters")}
                    </span>
                  </div>
                  {!previewMode && <div className="mb-2 flex items-center gap-1 rounded-lg border border-midnight-border bg-midnight-deep/50 p-1" role="toolbar" aria-label={t("feed.markdownToolbar")}>
                    <button type="button" onClick={() => setCodeSnippetOpen((open) => !open)} aria-pressed={codeSnippetOpen} aria-label={t(codeSnippetOpen ? "feed.removeCodeSnippet" : "feed.addCodeSnippet")} title={t(codeSnippetOpen ? "feed.removeCodeSnippet" : "feed.addCodeSnippet")} className="grid h-8 w-8 place-items-center rounded-md text-ink-muted transition hover:bg-gold/10 hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"><FontAwesomeIcon icon={faFileCode} className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => insertFormatting("**")} aria-label={t("feed.formatBold")} title={t("feed.formatBold")} className="grid h-8 w-8 place-items-center rounded-md text-sm font-bold text-ink-muted transition hover:bg-gold/10 hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">B</button>
                    <button type="button" onClick={() => insertFormatting("*")} aria-label={t("feed.formatItalic")} title={t("feed.formatItalic")} className="grid h-8 w-8 place-items-center rounded-md text-sm italic text-ink-muted transition hover:bg-gold/10 hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">I</button>
                    <button type="button" onClick={insertListPrefix} aria-label={t("feed.formatList")} title={t("feed.formatList")} className="grid h-8 w-8 place-items-center rounded-md text-ink-muted transition hover:bg-gold/10 hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"><FontAwesomeIcon icon={faListUl} className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => attachmentInputRef.current?.click()} aria-label={t("feed.addFiles")} title={t("feed.addFiles")} className="grid h-8 w-8 place-items-center rounded-md text-ink-muted transition hover:bg-gold/10 hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"><FontAwesomeIcon icon={faImage} className="h-4 w-4" aria-hidden="true" /></button>
                  </div>}
                  {previewMode ? (
                    <div className="min-h-36 rounded-xl border border-midnight-border bg-midnight-deep/40 px-4 py-3 text-sm leading-relaxed text-ink/90">
                      {content.trim() ? <PostMarkdown text={content} /> : <p className="text-ink-muted">{t("feed.previewEmpty")}</p>}
                    </div>
                  ) : (
                    <textarea
                      ref={contentInputRef}
                      value={content}
                      onChange={(event) => {
                        setContent(event.target.value);
                        createPost.reset();
                      }}
                      placeholder={t("feed.composerPlaceholder")}
                      rows={5}
                      maxLength={3000}
                      aria-label={t("feed.createPostTitle")}
                      aria-describedby="post-character-count"
                      autoFocus
                      className="input min-h-36 resize-y !rounded-xl !bg-midnight-deep/40 leading-relaxed"
                    />
                  )}
                </section>
                </div>

                {codeSnippetOpen && (
                  <section className="space-y-3">
                      <div className="space-y-2 rounded-xl border border-midnight-border bg-midnight-deep/30 p-3">
                        <label className="block">
                          <span className="label">{t("feed.codeLanguage")}</span>
                          <input value={codeLang} onChange={(event) => setCodeLang(event.target.value)} maxLength={30} placeholder="TypeScript" className="input !rounded-lg" />
                        </label>
                        <label className="block">
                          <span className="label">{t("feed.codeSnippet")}</span>
                          <textarea value={codeSnippet} onChange={(event) => setCodeSnippet(event.target.value)} maxLength={20_000} rows={5} className="input min-h-28 resize-y !rounded-lg font-mono text-xs" />
                        </label>
                      </div>
                      {codeSnippet.trim() && (
                        <CodeBlock
                          code={codeSnippet}
                          language={codeLang}
                          isFrench={locale === "fr"}
                          expandLabel={t("feed.codeShowMore")}
                          collapseLabel={t("feed.codeShowLess")}
                          ariaLabel={t("feed.codeSnippet")}
                        />
                      )}
                  </section>
                )}

                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faChartColumn} className="h-4 w-4 text-gold-soft" aria-hidden="true" />
                      <h4 className="text-xs font-semibold text-ink">{t("feed.addPoll")}</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-midnight-border bg-midnight-deep/70 p-1" role="group" aria-label={t("feed.pollTypeLabel")}>
                      {(["OPTIONS", "STAR"] as const).map((type) => (
                        <button key={type} type="button" aria-pressed={pollEnabled && pollType === type} onClick={() => {
                          setPollEnabled(true);
                          setPollType(type);
                          if (!pollQuestion.trim()) setPollQuestion(t(type === "STAR" ? "feed.pollStarPrompt" : "feed.pollOptionsPrompt"));
                        }} className="min-h-9 rounded-md px-3 text-xs font-medium text-ink-muted transition hover:text-ink aria-pressed:bg-midnight-card aria-pressed:text-gold-soft">
                          {t(type === "STAR" ? "feed.pollTypeStar" : "feed.pollTypeOptions")}
                        </button>
                      ))}
                    </div>
                    {pollEnabled && <button type="button" onClick={() => setPollEnabled(false)} className="text-xs text-ink-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">{t("feed.removePoll")}</button>}
                  </div>
                  {pollEnabled && (
                    <div className="space-y-3 rounded-xl border border-gold/20 bg-midnight-deep/30 p-4">
                      <label className="block">
                        <span className="label">{t("feed.pollQuestion")}</span>
                        <input value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} maxLength={180} minLength={5} required aria-invalid={!pollIsValid} className="input !rounded-lg" />
                      </label>
                      {pollType === "STAR" ? <p className="text-xs text-ink-muted">{t("feed.pollStarHint")}</p> : <div className="space-y-2">
                        {pollOptions.map((option, index) => <input key={index} value={option} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} maxLength={100} aria-label={t("feed.pollOptionLabel", { count: index + 1 })} placeholder={t("feed.pollOptionPlaceholder", { count: index + 1 })} className="input !rounded-lg" />)}
                        {pollOptions.length < 5 && <button type="button" onClick={() => setPollOptions((current) => [...current, ""])} className="btn-ghost !rounded-lg !px-3 !py-2 text-xs"><FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" aria-hidden="true" />{t("feed.pollAddOption")}</button>}
                        <p className="text-xs text-ink-muted">{t("feed.pollOptionsHint")}</p>
                      </div>}
                    </div>
                  )}
                </section>

                <section aria-label={t("feed.attachmentsTitle")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-semibold text-ink">{t("feed.attachmentsTitle")}</h4>
                      <p className="mt-0.5 text-[11px] text-ink-muted">{t("feed.attachmentsHint")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        multiple
                        accept=".avif,.gif,.jpeg,.jpg,.png,.webp,.c,.cc,.cpp,.cs,.css,.csv,.doc,.docx,.go,.h,.hpp,.html,.java,.js,.json,.jsx,.md,.pdf,.php,.ppt,.pptx,.py,.rb,.rs,.sh,.sql,.toml,.ts,.tsx,.txt,.xls,.xlsx,.xml,.yaml,.yml,.zip"
                        className="sr-only"
                        onChange={handleFiles}
                        tabIndex={-1}
                      />
                      <button
                        type="button"
                        onClick={() => attachmentInputRef.current?.click()}
                        className="btn-ghost !rounded-lg !px-3 !py-2 text-xs"
                      >
                        <FontAwesomeIcon icon={faPaperclip} className="h-4 w-4" aria-hidden="true" />
                        {t("feed.addFiles")}
                      </button>
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {attachments.map((attachment) => (
                        <li key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-midnight-border bg-midnight-deep/40 p-2.5">
                          {attachment.previewUrl ? (
                            <span className="relative h-12 w-14 shrink-0 overflow-hidden rounded-md border border-midnight-border bg-midnight-deep">
                              {!attachment.previewLoaded && <span className="skeleton absolute inset-0" aria-label={t("feed.previewLoading")} />}
                              {attachment.file.type.startsWith("video/") ? (
                                <video src={attachment.previewUrl} muted playsInline onLoadedData={() => markPreviewLoaded(attachment.id)} className="h-full w-full object-cover" />
                              ) : (
                                                                <img src={attachment.previewUrl} alt="" onLoad={() => markPreviewLoaded(attachment.id)} className="h-full w-full object-cover" />
                              )}
                            </span>
                          ) : (
                            <FontAwesomeIcon icon={faFileCode} className="h-5 w-5 shrink-0 text-gold-soft" aria-hidden="true" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-ink">{attachment.file.name}</span>
                            <span className="mt-0.5 block text-[10px] text-ink-muted">{formatFileSize(attachment.file.size)}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.id)}
                            aria-label={`${t("feed.removeAttachment")}: ${attachment.file.name}`}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-muted transition hover:bg-midnight-card hover:text-rose-300"
                          >
                            <FontAwesomeIcon icon={faTrash} className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-right text-[11px] tabular-nums text-ink-muted">
                    {formatFileSize(attachmentBytes)} / 50 {t("feed.megabytes")}
                  </p>
                  {attachmentError && <p role="alert" className="mt-2 text-xs text-rose-300">{attachmentError}</p>}
                </section>

                <section className="space-y-3" aria-labelledby="post-audience-title">
                  <div>
                    <h4 id="post-audience-title" className="text-xs font-semibold text-ink">{t("feed.projectLabel")}</h4>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {!projectId && !(teamId && postType === "TEAM") ? (
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-ink-muted">
                        <FontAwesomeIcon icon={faFolderOpen} className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="sr-only">{t(postType === "TEAM" ? "feed.teamProjectLabel" : "feed.projectLabel")}</span>
                        <select
                          value={selectedProjectId}
                          onChange={(event) => {
                            setSelectedProjectId(event.target.value);
                            createPost.reset();
                          }}
                          className="input min-w-0 max-w-full !rounded-lg !py-2 text-xs"
                          aria-label={t(postType === "TEAM" ? "feed.teamProjectLabel" : "feed.projectLabel")}
                          aria-required={postType !== "PERSONAL"}
                          aria-invalid={!postContextIsValid}
                        >
                          <option value="" className="bg-midnight-card">{t("feed.noProject")}</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id} className="bg-midnight-card">
                              {postType === "TEAM" ? project.teamName ?? project.title : project.title}
                            </option>
                          ))}
                        </select>
                        {projectsLoading && <FontAwesomeIcon icon={faSpinner} className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                      </label>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
                        <FontAwesomeIcon icon={faFolderOpen} className="h-4 w-4" aria-hidden="true" />
                        {t(postType === "TEAM" ? "feed.teamUpdate" : "feed.projectUpdate")}
                      </span>
                    )}
                  </div>
                  {!postContextIsValid && <p role="alert" className="text-xs text-amber-300">{t("feed.selectProjectRequired")}</p>}
                  {!pollIsValid && <p role="alert" className="text-xs text-amber-300">{t("feed.pollQuestionRequired")}</p>}
                </section>

              </div>

                <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-midnight-border bg-midnight-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <p role="status" aria-live="polite" className={`min-w-0 text-xs ${createPost.isError ? "text-rose-300" : "text-emerald-300"}`}>
                      {createPost.isError ? t("feed.postError") : ""}
                    </p>
                  </div>
                  <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <button type="button" onClick={closeComposer} className="btn-ghost min-h-11 w-full justify-center !rounded-lg !px-4 !py-2.5 sm:w-auto">{t("common.cancel")}</button>
                    <button type="submit" disabled={!content.trim() || content.length > 3000 || !pollIsValid || !postContextIsValid || createPost.isPending} className="btn-gold min-h-11 w-full justify-center !rounded-lg !px-4 !py-2.5 sm:w-auto">
                      {createPost.isPending ? <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" aria-hidden="true" />}
                      {createPost.isPending ? t("feed.publishing") : t(postType === "PERSONAL" ? "feed.publishPersonal" : postType === "TEAM" ? "feed.publishTeam" : "feed.publishProject")}
                    </button>
                  </div>
                </footer>
            </form>
          </dialog>
        </>
      )}

      {isLoading ? (
        <FeedSkeleton count={3} />
      ) : isError || !data || data.posts.length === 0 ? (
        <div className="card -mx-4 w-[calc(100%+2rem)] max-w-none rounded-none border-x-0 p-6 text-center text-sm text-ink-muted sm:mx-auto sm:w-full sm:max-w-3xl sm:rounded-xl sm:border-x sm:p-8">{t("feed.empty")}</div>
      ) : (
        <div className="min-w-0 space-y-4">
          {data.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post.type === "TEAM" ? {
                ...post,
                project: post.project ? {
                  ...post.project,
                  title: projectLabel ?? post.project.title,
                  teamName: projectLabel ?? post.project.teamName,
                  logoUrl: teamLogoUrl ?? post.project.logoUrl,
                } : post.project,
                team: post.team ? {
                  ...post.team,
                  title: projectLabel ?? post.team.title,
                  teamName: projectLabel ?? post.team.teamName,
                  logoUrl: teamLogoUrl ?? post.team.logoUrl,
                } : post.team,
              } : post}
            />
          ))}
          {projectId && data.pagination && data.pagination.totalPages > 1 && (
            <nav aria-label={t("projects.projectFeedPagination")} className="flex items-center justify-between gap-3 border-t border-midnight-border pt-3">
              <button type="button" onClick={() => setFeedPage((current) => Math.max(1, current - 1))} disabled={feedPage <= 1 || isLoading} className="btn-ghost !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-xs disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />{t("projects.previousPage")}
              </button>
              <span aria-live="polite" className="text-xs tabular-nums text-ink-muted">{t("projects.paginationPage", { page: data.pagination.page, pages: data.pagination.totalPages })}</span>
              <button type="button" onClick={() => setFeedPage((current) => Math.min(data.pagination?.totalPages ?? current, current + 1))} disabled={feedPage >= data.pagination.totalPages || isLoading} className="btn-ghost !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-xs disabled:opacity-40">
                {t("projects.nextPage")}<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}

export default Feed;
