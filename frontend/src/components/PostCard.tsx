"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark, faChartColumn, faCheck, faComment, faCopy, faDownload, faEllipsis, faEyeSlash, faFileCode, faFileLines, faFlag, faFolderOpen, faHandshake, faLink, faPen, faShare, faShareNodes, faSpinner, faStar, faTrash, faUserPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { faDiscord, faFacebook, faGithub, faWhatsapp, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { Avatar } from "@/components/Avatar";
import { useActionToast } from "@/components/ActionToast";
import { PostMarkdown } from "@/components/PostMarkdown";
import { PaginatedCodeBlock } from "@/components/PaginatedCodeBlock";
import { PollCard, type PostPoll } from "@/components/PollCard";
import { PostComments } from "@/components/PostComments";
import { ProjectReviews } from "@/components/ProjectReviews";
import { ReactionPicker, type ReactionType } from "@/components/ReactionPicker";
import { useTranslation } from "@/lib/i18n";
import { cn, timeAgo } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { BadgeIconList, type AwardedBadge } from "@/components/GamificationBadges";
import { Activity, ReviewIcon, UsersRound } from "@/components/FontAwesomeIcons";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export type PostIntent = "progress" | "feedback" | "co-building";
export type FeedPostType = "PERSONAL" | "TEAM" | "PROJECT";
export type PostCardVariant = "standard" | "compact";
type PostDialogMode = "edit" | "delete" | "report" | null;
type PostReportReason = "spam" | "harassment" | "inappropriate" | "other";
type ReviewPreview = {
  reviews: { id: string; rating: number; comment: string | null; createdAt: string; user: { id: string; name: string | null; handle: string | null; image: string | null } }[];
  summary: { total: number; average: number };
};
type UserAssociation = { requesterId: string; addresseeId: string; status: "PENDING" | "ACCEPTED" | "REJECTED" };

export interface FeedPost {
  id: string;
  type: FeedPostType;
  content: string;
  codeSnippet: string | null;
  codeLang: string | null;
  imageUrl: string | null;
  attachments: { id: string; name: string; mimeType: string; size: number }[];
  tags: string[];
  createdAt: string;
  isFeatured?: boolean;
  likedByMe?: boolean;
  savedByMe?: boolean;
  hiddenByMe?: boolean;
  reactionByMe?: ReactionType | null;
  reactionCounts?: Partial<Record<ReactionType, number>>;
  poll?: PostPoll | null;
  shareCount: number;
  author: { id: string; name: string | null; image: string | null; handle: string | null; headline: string | null; skills?: string[]; isVerified?: boolean; badges?: AwardedBadge[] };
  project: {
    id: string;
    title: string;
    slug: string;
    status: string;
    githubUrl?: string | null;
    logoUrl?: string | null;
    coverUrl?: string | null;
    teamName?: string | null;
    creator?: { id: string; name: string | null; handle: string | null; image: string | null } | null;
    parentTeam?: { id: string; title: string; teamName: string | null; logoUrl: string | null } | null;
    collaborationStatus: string | null;
  } | null;
  team?: { id: string; title: string; slug: string; logoUrl?: string | null; teamName?: string | null } | null;
  _count: { likes: number; comments: number };
}

export interface PostCardProps {
  post: FeedPost;
  variant?: PostCardVariant;
  showActions?: boolean;
  showJoinAction?: boolean;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
}

const postIntentPresentation: Record<PostIntent, { label: string; icon: typeof Activity; className: string }> = {
  progress: { label: "feed.intentProgress", icon: Activity, className: "border-gold/30 bg-gold/10 text-gold-soft" },
  feedback: { label: "feed.intentFeedback", icon: ReviewIcon, className: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  "co-building": { label: "feed.intentCollaboration", icon: UsersRound, className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
};

function isPostIntent(tag: string): tag is PostIntent {
  return tag === "progress" || tag === "feedback" || tag === "co-building";
}

function formatAttachmentSize(bytes: number, locale: string) {
  const isMegabytes = bytes >= 1024 * 1024;
  const value = isMegabytes ? bytes / (1024 * 1024) : bytes / 1024;
  const unit = isMegabytes ? (locale === "fr" ? "Mo" : "MB") : (locale === "fr" ? "Ko" : "KB");
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} ${unit}`;
}

export function PostCard({
  post,
  variant = "standard",
  showActions = true,
  showJoinAction = true,
  onComment,
  onShare,
}: PostCardProps) {
  const { t, locale } = useTranslation();
  const { showToast } = useActionToast();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [reaction, setReaction] = useState<ReactionType | null>(post.reactionByMe ?? (post.likedByMe ? "like" : null));
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [reactionCounts, setReactionCounts] = useState<Partial<Record<ReactionType, number>>>(post.reactionCounts ?? {});
  const [commentCount, setCommentCount] = useState(post._count.comments);
  const [shareCount, setShareCount] = useState(post.shareCount ?? 0);
  const [associationStatus, setAssociationStatus] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);
  const [dialogMode, setDialogMode] = useState<PostDialogMode>(null);
  const [editContent, setEditContent] = useState(post.content);
  const [reportReason, setReportReason] = useState<PostReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [optionMessage, setOptionMessage] = useState("");
  const [saved, setSaved] = useState(post.savedByMe ?? false);
  const [hidden, setHidden] = useState(post.hiddenByMe ?? false);
  const [removed, setRemoved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [contentExpandable, setContentExpandable] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const postContentRef = useRef<HTMLDivElement>(null);
  const isOwnPost = Boolean(session?.user?.id && session.user.id === post.author.id);
  const collaborationStatus = joinStatus ?? post.project?.collaborationStatus ?? null;
  const associationsQuery = useQuery({
    queryKey: ["associations", session?.user?.id],
    enabled: Boolean(session?.user?.id),
    queryFn: async () => {
      const response = await fetch("/api/associations");
      if (!response.ok) throw new Error("associations_load_failed");
      return response.json() as Promise<{ associations: UserAssociation[] }>;
    },
  });
  const isAuthorAssociated = associationStatus === "ACCEPTED" || associationsQuery.data?.associations.some((association) => (
    association.status === "ACCEPTED"
    && ((association.requesterId === session?.user?.id && association.addresseeId === post.author.id)
      || (association.requesterId === post.author.id && association.addresseeId === session?.user?.id))
  ));
  const postIntent = post.tags.find(isPostIntent);
  const visibleTags = post.tags.filter((tag) => !isPostIntent(tag));
  const postType = post.type ?? "PERSONAL";
  const profileHref = `/makers/${encodeURIComponent(post.author.handle ?? post.author.id)}`;
  const teamContext = post.team ?? post.project;
  const teamDisplayName = teamContext?.teamName ?? teamContext?.title ?? t("feed.postTypeTeam");
  const teamHref = teamContext ? `/teams/${teamContext.id}` : profileHref;
  const contextHref = post.project ? `${postType === "TEAM" ? "/teams" : "/projects"}/${post.project.id}` : null;
  const projectTeam = post.project?.parentTeam ?? post.team ?? null;
  const projectCreator = post.project?.creator ?? null;
  const projectIdentityName = projectTeam?.teamName?.trim()
    || projectTeam?.title
    || projectCreator?.name
    || projectCreator?.handle
    || post.author.name
    || post.author.handle
    || "Maker";
  const projectIdentityImage = projectTeam ? projectTeam.logoUrl : projectCreator?.image ?? post.author.image;
  const projectIdentityHref = projectTeam
    ? `/teams/${projectTeam.id}`
    : `/makers/${encodeURIComponent(projectCreator?.handle ?? projectCreator?.id ?? post.author.handle ?? post.author.id)}`;
  const projectTeamDisplayName = projectTeam?.teamName?.trim() || projectTeam?.title || "";
  const showProjectTeamName = Boolean(projectTeamDisplayName && post.project && projectTeamDisplayName.toLowerCase() !== post.project.title.trim().toLowerCase());
  const identityHref = postType === "TEAM" ? teamHref : postType === "PROJECT" ? projectIdentityHref : profileHref;
  const identityName = postType === "TEAM" ? teamDisplayName : postType === "PROJECT" ? projectIdentityName : post.author.name ?? post.author.handle ?? "Maker";
  const identityImage = postType === "TEAM" ? teamContext?.logoUrl : postType === "PROJECT" ? projectIdentityImage : post.author.image;
  const authorNameHref = postType === "PERSONAL" ? profileHref : contextHref ?? profileHref;
  const postTypeLabel = t(postType === "PERSONAL" ? "feed.postTypePersonal" : postType === "TEAM" ? "feed.postTypeTeam" : "feed.postTypeProject");
  const intentPresentation = postIntent ? postIntentPresentation[postIntent] : null;
  useEffect(() => {
    setReaction(post.reactionByMe ?? (post.likedByMe ? "like" : null));
    setLikeCount(post._count.likes);
    setReactionCounts(post.reactionCounts ?? {});
    setCommentCount(post._count.comments);
    setShareCount(post.shareCount ?? 0);
  }, [post.reactionByMe, post.likedByMe, post._count.likes, post.reactionCounts, post._count.comments, post.shareCount]);

  useEffect(() => {
    const contentElement = postContentRef.current;
    if (!contentElement) return;

    const updateExpandable = () => {
      setContentExpandable(contentElement.scrollHeight > 168);
    };
    updateExpandable();
    const observer = new ResizeObserver(updateExpandable);
    observer.observe(contentElement);
    return () => observer.disconnect();
  }, [post.content]);

  const projectReviewsQuery = useQuery({
    queryKey: ["project-reviews", post.project?.id ?? null, "all", "newest", 1],
    enabled: Boolean(post.project?.id),
    refetchInterval: 3_000,
    staleTime: 30_000,
    queryFn: async () => {
      if (!post.project) throw new Error("project_unavailable");
      const response = await fetch(`/api/projects/${post.project.id}/reviews?sort=newest&page=1`);
      if (!response.ok) throw new Error("reviews_load_failed");
      return response.json() as Promise<ReviewPreview>;
    },
  });
  const likeMutation = useMutation({
    mutationFn: async (nextReaction: ReactionType) => {
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction: nextReaction }),
      });
      if (!res.ok) throw new Error("like failed");
      return res.json() as Promise<{
        liked: boolean;
        reaction: ReactionType | null;
        count: number;
        reactionCounts: Partial<Record<ReactionType, number>>;
      }>;
    },
    onMutate: (nextReaction) => {
      const previous = { reaction, likeCount, reactionCounts };
      const nextSelectedReaction = reaction === nextReaction ? null : nextReaction;
      setReaction(nextSelectedReaction);
      setLikeCount((count) => Math.max(0, count + (reaction === null ? 1 : nextSelectedReaction === null ? -1 : 0)));
      setReactionCounts((current) => {
        const updated = { ...current };
        if (reaction) updated[reaction] = Math.max(0, (updated[reaction] ?? 0) - 1);
        if (nextSelectedReaction) updated[nextSelectedReaction] = (updated[nextSelectedReaction] ?? 0) + 1;
        return updated;
      });
      return previous;
    },
    onSuccess: async (data) => {
      setReaction(data.reaction);
      setLikeCount(data.count);
      setReactionCounts(data.reactionCounts);
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (_error, _nextReaction, previous) => {
      if (!previous) return;
      setReaction(previous.reaction);
      setLikeCount(previous.likeCount);
      setReactionCounts(previous.reactionCounts);
    },
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!post.project) throw new Error("project_unavailable");
      const res = await fetch(`/api/projects/${post.project.id}/collaborate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "CO_BUILDER" }),
      });
      const result = await res.json().catch(() => ({})) as { collaborator?: { status?: string } };
      if (!res.ok && res.status !== 409) throw new Error("join failed");
      return { status: result.collaborator?.status ?? "PENDING" };
    },
    onSuccess: ({ status }) => {
      setJoinStatus(status);
      if (status === "PENDING") showToast(t("teams.requestSubmitted"));
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => setJoinStatus(null),
  });

  const associationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/associations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeId: post.author.id }),
      });
      if (!response.ok) throw new Error("association_failed");
      return response.json() as Promise<{ association?: { status?: string } }>;
    },
    onSuccess: async (result) => {
      const status = result.association?.status ?? "PENDING";
      setAssociationStatus(status);
      if (status === "PENDING") showToast(t("feed.associationSent"));
      await queryClient.invalidateQueries({ queryKey: ["associations", session?.user?.id] });
    },
    onError: () => setAssociationStatus(null),
  });

  const shareMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/posts/${post.id}/share`, { method: "POST" });
      if (!response.ok) throw new Error("share_failed");
      return response.json() as Promise<{ shareCount: number }>;
    },
    onSuccess: ({ shareCount: count }) => {
      setShareCount(count);
      onShare?.(post.id);
    },
    onError: () => setOptionMessage(t("feed.shareTrackingError")),
  });

  const preferenceMutation = useMutation({
    mutationFn: async ({ preference, enabled }: { preference: "saved" | "hidden"; enabled: boolean }) => {
      const response = await fetch(`/api/posts/${post.id}/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preference, enabled }),
      });
      if (!response.ok) throw new Error("post_preference_failed");
      return response.json() as Promise<{ saved: boolean; hidden: boolean }>;
    },
    onSuccess: async ({ saved: nextSaved, hidden: nextHidden }) => {
      setSaved(nextSaved);
      setHidden(nextHidden);
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => setOptionMessage(t("feed.preferenceError")),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!response.ok) throw new Error("post_edit_failed");
      return response.json();
    },
    onSuccess: async () => {
      setDialogMode(null);
      await queryClient.invalidateQueries();
    },
    onError: () => setDialogError(t("feed.editError")),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("post_delete_failed");
      return response.json();
    },
    onMutate: () => setRemoved(true),
    onSuccess: async () => {
      queryClient.setQueriesData<FeedPost[]>({ queryKey: ["feed"] }, (posts) => posts?.filter(({ id }) => id !== post.id));
      setDialogMode(null);
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => {
      setRemoved(false);
      setDialogError(t("feed.deleteError"));
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/posts/${post.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || undefined }),
      });
      if (response.status === 409) throw new Error("already_reported");
      if (!response.ok) throw new Error("post_report_failed");
      return response.json();
    },
    onSuccess: () => {
      setDialogMode(null);
      setOptionMessage(t("feed.reportSuccess"));
    },
    onError: (error) => setDialogError(error instanceof Error && error.message === "already_reported"
      ? t("feed.alreadyReported")
      : t("feed.reportError")),
  });

  useEffect(() => {
    setSaved(post.savedByMe ?? false);
    setHidden(post.hiddenByMe ?? false);
  }, [post.id, post.savedByMe, post.hiddenByMe]);

  useEffect(() => {
    setCommentCount(post._count.comments);
  }, [post._count.comments]);

  useEffect(() => {
    setReaction(post.reactionByMe ?? (post.likedByMe ? "like" : null));
    setLikeCount(post._count.likes);
    setReactionCounts(post.reactionCounts ?? {});
  }, [post.reactionByMe, post.likedByMe, post._count.likes, post.reactionCounts]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogMode && !dialog.open) dialog.showModal();
    if (!dialogMode && dialog.open) dialog.close();
  }, [dialogMode]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    setSupportsNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!shareOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!shareRef.current?.contains(event.target as Node)) setShareOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShareOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [shareOpen]);

  function openDialog(mode: Exclude<PostDialogMode, null>) {
    setMenuOpen(false);
    setDialogError("");
    if (mode === "edit") setEditContent(post.content);
    if (mode === "report") {
      setReportReason("spam");
      setReportDetails("");
    }
    setDialogMode(mode);
  }

  function toggleSaved() {
    preferenceMutation.mutate({ preference: "saved", enabled: !saved });
    setMenuOpen(false);
  }

  function hidePost() {
    preferenceMutation.mutate({ preference: "hidden", enabled: true });
    setMenuOpen(false);
  }

  function restorePost() {
    preferenceMutation.mutate({ preference: "hidden", enabled: false });
  }

  function getPostShareUrl() {
    const postUrl = new URL(window.location.href);
    postUrl.hash = `post-${post.id}`;
    return postUrl.toString();
  }

  async function copyPostLink() {
    try {
      await navigator.clipboard.writeText(getPostShareUrl());
      setCopied(true);
      setOptionMessage(t("feed.linkCopied"));
      shareMutation.mutate();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setOptionMessage(t("feed.copyError"));
    }
    setMenuOpen(false);
  }

  function shareOnX() {
    const shareUrl = new URL("https://twitter.com/intent/tweet");
    shareUrl.searchParams.set("text", post.content.slice(0, 240));
    shareUrl.searchParams.set("url", getPostShareUrl());
    openShareWindow(shareUrl);
  }

  function shareOnFacebook() {
    const shareUrl = new URL("https://www.facebook.com/sharer/sharer.php");
    shareUrl.searchParams.set("u", getPostShareUrl());
    openShareWindow(shareUrl);
  }

  function shareOnWhatsApp() {
    const shareUrl = new URL("https://wa.me/");
    shareUrl.searchParams.set("text", `${post.content.slice(0, 240)} ${getPostShareUrl()}`);
    openShareWindow(shareUrl);
  }

  function openShareWindow(shareUrl: URL) {
    const shareWindow = window.open(shareUrl.toString(), "_blank");
    if (shareWindow) {
      shareWindow.opener = null;
      shareMutation.mutate();
      setOptionMessage(t("feed.shareStarted"));
    } else {
      setOptionMessage(t("feed.sharePopupBlocked"));
    }
    setMenuOpen(false);
    setShareOpen(false);
  }

  async function shareOnDiscord() {
    const discordWindow = window.open("https://discord.com/channels/@me", "_blank");
    if (discordWindow) discordWindow.opener = null;
    try {
      await navigator.clipboard.writeText(getPostShareUrl());
      setCopied(true);
      shareMutation.mutate();
      setOptionMessage(t(discordWindow ? "feed.discordLinkCopied" : "feed.sharePopupBlocked"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setOptionMessage(t("feed.copyError"));
    }
    setMenuOpen(false);
    setShareOpen(false);
  }

  async function shareNatively() {
    try {
      await navigator.share({
        title: post.project?.title ?? post.author.name ?? t("feed.sharePost"),
        text: post.content.slice(0, 240),
        url: getPostShareUrl(),
      });
      shareMutation.mutate();
      setOptionMessage(t("feed.shareStarted"));
      setShareOpen(false);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setOptionMessage(t("feed.shareError"));
      }
    }
  }

  function submitDialog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialogMode === "edit") editMutation.mutate();
    if (dialogMode === "delete") deleteMutation.mutate();
    if (dialogMode === "report") reportMutation.mutate();
  }

  if (removed) return null;
  if (hidden) {
    return (
      <article id={`post-${post.id}`} className="card flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-ink-muted">{t("feed.hiddenPost")}</p>
          {optionMessage && <p role="status" className="mt-1 text-xs text-rose-300">{optionMessage}</p>}
        </div>
        <button type="button" onClick={restorePost} disabled={preferenceMutation.isPending} className="text-xs font-semibold text-gold-soft hover:text-gold-bright disabled:opacity-50">
          {t("feed.undoHide")}
        </button>
      </article>
    );
  }

  return (
    <article className={cn(
      "card -mx-4 w-[calc(100%+2rem)] max-w-none min-w-0 rounded-none border-x-0 transition hover:border-gold/30 sm:mx-auto sm:w-full sm:max-w-3xl sm:rounded-xl sm:border-x",
      variant === "compact" ? "p-3 sm:p-4" : "animate-fade-in p-3 sm:p-5",
    )} id={`post-${post.id}`}>
      <header className="flex min-w-0 flex-wrap items-start gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href={identityHref} aria-label={postType === "PERSONAL" ? t("feed.viewProfile", { name: identityName }) : identityName} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
            <Avatar src={identityImage} name={identityName} size={variant === "compact" ? 40 : 44} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {postType === "PROJECT" && post.project ? (
                <Link href={projectIdentityHref} className="truncate text-sm font-semibold text-ink transition hover:text-gold-soft">
                  {projectIdentityName}
                </Link>
              ) : authorNameHref ? (
                <Link href={authorNameHref} className="min-w-0 break-words text-sm font-semibold text-ink transition hover:text-gold-soft">
                  {postType === "PERSONAL" ? post.author.name ?? post.author.handle ?? "Maker" : teamDisplayName}
                  {post.author.isVerified && postType === "PERSONAL" && <span className="ml-1 inline-flex align-middle"><VerifiedBadge label={t("feed.verifiedMaker")} size="sm" /></span>}
                  {postType === "PERSONAL" && <span className="ml-2 inline-flex align-middle"><BadgeIconList badges={post.author.badges ?? []} size={13} /></span>}
                </Link>
              ) : <span className="text-sm font-semibold text-ink">{post.author.name ?? post.author.handle ?? "Maker"}</span>}
              <span className="text-xs text-ink-muted">· {timeAgo(post.createdAt, locale)}</span>
            </div>
            {postType === "PROJECT" && post.project ? (
              <p className="mt-0.5 truncate text-xs text-ink-muted">
                {t(projectTeam ? "feed.projectByTeam" : "feed.projectByMaker")}
                {projectCreator && projectCreator.id !== post.author.id && (
                  <>
                    {" · "}{t("feed.postedBy")}{" "}
                    <Link href={profileHref} className="transition hover:text-gold-soft">
                      {post.author.handle ? `@${post.author.handle}` : post.author.name ?? "Maker"}
                    </Link>
                  </>
                )}
              </p>
            ) : postType === "TEAM" ? (
              <p className="mt-0.5 truncate text-xs text-ink-muted">
                {t("feed.postedBy")}{" "}
                <Link href={profileHref} className="transition hover:text-gold-soft">
                  {post.author.handle ? `@${post.author.handle}` : post.author.name ?? "Maker"}
                </Link>
              </p>
            ) : (
              <>
                {post.author.handle && <p className="truncate text-xs text-ink-muted">@{post.author.handle}</p>}
                {post.author.headline && <p className="truncate text-xs text-ink-muted">{post.author.headline}</p>}
                {postType === "PERSONAL" && post.author.skills && post.author.skills.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {post.author.skills.slice(0, 3).map((skill) => <span key={skill} className="rounded-md border border-midnight-border px-1.5 py-0.5 text-[9px] text-ink-muted">{skill}</span>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="relative ml-auto shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-label={t("feed.postOptions")}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-deep hover:text-ink"
          >
            <FontAwesomeIcon icon={faEllipsis} className="h-4 w-4" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" aria-label={t("feed.postOptions")} className="absolute right-0 top-9 z-30 min-w-52 rounded-lg border border-midnight-border bg-midnight-card p-1.5 shadow-xl">
              {isOwnPost && (
                <>
                  <button type="button" role="menuitem" onClick={() => openDialog("edit")} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs text-ink transition hover:bg-midnight-deep">
                    <FontAwesomeIcon icon={faPen} className="h-4 w-4 text-ink-muted" aria-hidden="true" />{t("feed.editPost")}
                  </button>
                  <button type="button" role="menuitem" onClick={() => openDialog("delete")} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-midnight-deep">
                    <FontAwesomeIcon icon={faTrash} className="h-4 w-4" aria-hidden="true" />{t("feed.deletePost")}
                  </button>
                  <div role="separator" className="my-1 border-t border-midnight-border" />
                </>
              )}
              <button type="button" role="menuitem" onClick={copyPostLink} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs text-ink transition hover:bg-midnight-deep">
                <FontAwesomeIcon icon={faCopy} className="h-4 w-4 text-ink-muted" aria-hidden="true" />{t(copied ? "feed.linkCopied" : "feed.copyLink")}
              </button>
              <button type="button" role="menuitem" onClick={shareOnX} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs text-ink transition hover:bg-midnight-deep">
                <FontAwesomeIcon icon={faXTwitter} className="h-4 w-4 text-ink-muted" aria-hidden="true" />{t("feed.shareOnX")}
              </button>
              <button type="button" role="menuitem" onClick={toggleSaved} disabled={preferenceMutation.isPending} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs text-ink transition hover:bg-midnight-deep disabled:opacity-50">
                <FontAwesomeIcon icon={faBookmark} className={`h-4 w-4 ${saved ? "text-gold-soft" : "text-ink-muted"}`} aria-hidden="true" />
                {t(saved ? "feed.postUnsaved" : "feed.postSaved")}
              </button>
              <button type="button" role="menuitem" onClick={hidePost} disabled={preferenceMutation.isPending} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs text-ink transition hover:bg-midnight-deep disabled:opacity-50">
                <FontAwesomeIcon icon={faEyeSlash} className="h-4 w-4 text-ink-muted" aria-hidden="true" />{t("feed.hidePost")}
              </button>
              {!isOwnPost && <div role="separator" className="my-1 border-t border-midnight-border" />}
              {!isOwnPost && (
                <button type="button" role="menuitem" onClick={() => openDialog("report")} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-midnight-deep">
                  <FontAwesomeIcon icon={faFlag} className="h-4 w-4" aria-hidden="true" />{t("feed.reportPost")}
                </button>
              )}
            </div>
          )}
        </div>
        {postType !== "PROJECT" && <div className="ml-auto flex w-full min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center justify-start gap-1.5">
            <span className="inline-flex max-w-full items-center rounded-full border border-gold/25 bg-gold/5 px-2.5 py-1 text-[10px] font-semibold text-gold-soft">{postTypeLabel}</span>
            {post.isFeatured && <span className="badge-gold max-w-full text-[10px]">{t("feed.featured")}</span>}
            {intentPresentation && (
              <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${intentPresentation.className}`}>
                <intentPresentation.icon size={12} className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{t(intentPresentation.label)}</span>
              </span>
            )}
            {postType === "TEAM" && (
              <Link href={profileHref} aria-label={t("feed.viewProfile", { name: post.author.name ?? post.author.handle ?? "Maker" })} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-midnight-border bg-midnight-deep/60 py-1 pl-1 pr-2 transition hover:border-gold/40 hover:text-gold-soft">
                <Avatar src={post.author.image} name={post.author.name} size={20} />
                <span className="truncate text-[10px] font-medium">{post.author.name ?? post.author.handle ?? "Maker"}</span>
              </Link>
            )}
            {post.project && postType !== "TEAM" && (
              <div className="inline-flex max-w-full flex-wrap items-center gap-1.5">
                <Link href={contextHref ?? "#"} className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-midnight-border bg-midnight-deep/60 px-2 py-1 text-[10px] text-ink-muted transition hover:border-gold/40 hover:text-gold-soft">
                  {post.project.logoUrl && <Image src={post.project.logoUrl} alt="" width={16} height={16} unoptimized className="h-4 w-4 rounded-full object-cover" />}
                  <span className="truncate">{post.project.title}</span>
                </Link>
                {post.project.githubUrl && (
                  <a href={post.project.githubUrl} target="_blank" rel="noopener noreferrer" aria-label={t("feed.openProjectOnGithub")} title={t("feed.openProjectOnGithub")} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-midnight-border text-ink-muted transition hover:border-gold/40 hover:text-gold-soft">
                    <FontAwesomeIcon icon={faGithub} className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>}
      </header>

      {postType === "PROJECT" && post.project && (
        <Link href={contextHref ?? "#"} aria-label={post.project.title} className="group relative mt-4 block aspect-[16/8] overflow-hidden rounded-xl border border-midnight-border bg-midnight-deep sm:aspect-[16/7]">
          {post.project.coverUrl ? (
            <Image src={post.project.coverUrl} alt="" fill sizes="(max-width: 768px) 100vw, 768px" unoptimized className="object-cover" />
          ) : (
            <>
              {post.project.logoUrl && (
                <Image src={post.project.logoUrl} alt="" fill sizes="(max-width: 768px) 100vw, 768px" unoptimized className="scale-110 object-cover opacity-25 blur-xl" />
              )}
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-gold/20 via-midnight-deep/70 to-cyan-950/80" />
            </>
          )}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10 transition group-hover:from-black/90" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
                {t("feed.postTypeProject")}
              </span>
              {intentPresentation && (
                <span className={`inline-flex items-center gap-1 rounded-full border bg-black/35 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm ${intentPresentation.className}`}>
                  <intentPresentation.icon size={11} aria-hidden="true" />
                  {t(intentPresentation.label)}
                </span>
              )}
            </span>
            <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm">
              {t(`feed.projectStatuses.${post.project.status}`)}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 sm:p-5">
            {post.project.logoUrl && (
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/25 bg-black/30 shadow-lg sm:h-14 sm:w-14">
                <Image src={post.project.logoUrl} alt="" fill sizes="56px" unoptimized className="object-cover" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-xl font-semibold tracking-tight text-white drop-shadow sm:text-2xl">
                {post.project.title}
              </span>
              {projectTeam && showProjectTeamName && (
                <span className="mt-1 block truncate text-xs font-medium text-white/75">
                  {projectTeamDisplayName}
                </span>
              )}
            </span>
            {post.isFeatured && <span className="badge-gold shrink-0 border-white/20 bg-black/40 text-[10px] backdrop-blur-sm">{t("feed.featured")}</span>}
          </div>
        </Link>
      )}

      {optionMessage && <p role="status" aria-live="polite" className="mt-3 text-xs text-emerald-300">{optionMessage}</p>}

      <div
        id={`post-content-${post.id}`}
        ref={postContentRef}
        className={cn(
          "mt-3 break-words text-sm leading-relaxed text-ink/90 sm:mt-4",
          !contentExpanded && "max-h-40 overflow-hidden",
        )}
      >
        <PostMarkdown text={post.content} />
      </div>
      {contentExpandable && (
        <button
          type="button"
          aria-expanded={contentExpanded}
          aria-controls={`post-content-${post.id}`}
          onClick={() => setContentExpanded((expanded) => !expanded)}
          className="mt-1 text-xs font-semibold text-gold-soft transition hover:text-gold-bright"
        >
          {t(contentExpanded ? "feed.codeShowLess" : "feed.codeShowMore")}
        </button>
      )}

      {post.poll && <PollCard postId={post.id} poll={post.poll} />}

      {post.codeSnippet && (
        <PaginatedCodeBlock code={post.codeSnippet} language={post.codeLang ?? undefined} className="mt-3" />
      )}

      {post.imageUrl && (
                <img src={post.imageUrl} alt={t("feed.imageAlt")} loading="lazy" className="mt-3 max-h-[32rem] w-full rounded-lg border border-midnight-border object-contain" />
      )}

      {post.attachments?.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {post.attachments.map((attachment) => {
            const baseUrl = `/api/posts/${post.id}/attachments/${attachment.id}`;
            const isInlineImage = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(attachment.mimeType);
            const isInlineVideo = ["video/mp4", "video/webm", "video/ogg"].includes(attachment.mimeType);
            return (
              <li key={attachment.id} className="min-w-0 overflow-hidden rounded-lg border border-midnight-border bg-midnight-deep/40">
                {isInlineImage && (
                                    <img
                    src={`${baseUrl}?inline=1`}
                    alt={attachment.name}
                    loading="lazy"
                    className="max-h-72 w-full border-b border-midnight-border object-contain"
                  />
                )}
                {isInlineVideo && <video src={`${baseUrl}?inline=1`} controls preload="metadata" className="max-h-96 w-full border-b border-midnight-border bg-black" />}
                <a
                  href={baseUrl}
                  download={attachment.name}
                  aria-label={`${t("feed.download")} ${attachment.name}`}
                  className="flex min-h-12 items-center gap-3 px-3 py-2.5 transition hover:bg-midnight-card/70"
                >
                  <FontAwesomeIcon icon={faFileLines} className="h-4 w-4 shrink-0 text-gold-soft" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{attachment.name}</span>
                    <span className="mt-0.5 block text-[10px] text-ink-muted">{formatAttachmentSize(attachment.size, locale)}</span>
                  </span>
                  <FontAwesomeIcon icon={faDownload} className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {visibleTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleTags.map((tag) => (
            <span key={tag} className="badge">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {showActions && (
        <footer className="-mx-3 mt-4 border-t border-midnight-border/70 px-3 pt-3 sm:mx-0 sm:px-0">
          <div className="-mx-3 flex flex-wrap items-center gap-1 overflow-visible px-3 pb-1 sm:mx-0 sm:gap-2 sm:px-0 sm:pb-0">
          <ReactionPicker
            selected={reaction}
            count={likeCount}
            reactionCounts={reactionCounts}
            showBreakdown={false}
            labels={{
              like: t("feed.reactions.like"),
              love: t("feed.reactions.love"),
              celebrate: t("feed.reactions.celebrate"),
              support: t("feed.reactions.support"),
              laugh: t("feed.reactions.laugh"),
              insightful: t("feed.reactions.insightful"),
            }}
            buttonLabel={t("feed.like")}
            pickerLabel={t("feed.moreReactions")}
            onSelect={(nextReaction) => likeMutation.mutate(nextReaction)}
            disabled={likeMutation.isPending}
          />
          {post.poll && (
            <Link href={`#post-poll-${post.id}`} className="btn-ghost shrink-0 !px-2 !py-2 sm:!px-3" aria-label={`${t("feed.poll")} ${post.poll.totalVotes}`}>
              <FontAwesomeIcon icon={faChartColumn} className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t("feed.poll")}</span>
              <span className="tabular-nums text-ink-muted">{post.poll.totalVotes}</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setCommentsOpen((open) => !open);
              onComment?.(post.id);
            }}
            aria-expanded={commentsOpen}
            className="btn-ghost shrink-0 !px-2 !py-2 sm:!px-3"
            aria-label={`${t("feed.comment")} ${commentCount}`}
          >
            <FontAwesomeIcon icon={faComment} className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("feed.comment")}</span>
            <span className="tabular-nums text-ink-muted">{commentCount}</span>
          </button>
          {post.project && (
            <button type="button" onClick={() => setReviewsOpen((open) => !open)} aria-expanded={reviewsOpen} aria-controls={reviewsOpen ? `post-reviews-${post.id}` : undefined} className="btn-ghost shrink-0 !px-2 !py-2 sm:!px-3" aria-label={`${t(reviewsOpen ? "feed.hideFeedback" : "feed.giveFeedback")} ${post.project.title}`}>
              <ReviewIcon size={16} className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t(reviewsOpen ? "feed.hideFeedback" : "feed.giveFeedback")}</span>
            </button>
          )}

          <div className="relative" ref={shareRef}>
            <button type="button" onClick={() => setShareOpen((open) => !open)} aria-haspopup="dialog" aria-expanded={shareOpen} aria-controls={`post-share-${post.id}`} className="btn-ghost shrink-0 !px-2 !py-2 sm:!px-3" aria-label={`${t("feed.share")} ${shareCount}`}>
              <FontAwesomeIcon icon={faShareNodes} className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("feed.share")}</span>
              <span className="tabular-nums text-ink-muted">{shareCount}</span>
            </button>
            {shareOpen && (
              <div id={`post-share-${post.id}`} role="dialog" aria-label={t("feed.sharePost")} className="absolute bottom-full right-0 z-40 mb-2 w-56 rounded-lg border border-midnight-border bg-midnight-card p-3 shadow-xl">
                <p className="mb-2 px-1 text-xs font-semibold text-ink">{t("feed.sharePost")}</p>
                <div className="grid gap-1">
                  <button type="button" onClick={copyPostLink} disabled={shareMutation.isPending} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-ink-muted transition hover:bg-midnight-deep hover:text-ink disabled:opacity-50">
                    <FontAwesomeIcon icon={copied ? faCheck : faLink} className="h-4 w-4" aria-hidden="true" />{t(copied ? "feed.linkCopied" : "feed.copyLink")}
                  </button>
                  <button type="button" onClick={shareOnX} disabled={shareMutation.isPending} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-ink-muted transition hover:bg-midnight-deep hover:text-ink disabled:opacity-50">
                    <FontAwesomeIcon icon={faXTwitter} className="h-4 w-4" aria-hidden="true" />{t("feed.shareOnX")}
                  </button>
                  <button type="button" onClick={shareOnFacebook} disabled={shareMutation.isPending} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-ink-muted transition hover:bg-midnight-deep hover:text-ink disabled:opacity-50">
                    <FontAwesomeIcon icon={faFacebook} className="h-4 w-4" aria-hidden="true" />{t("feed.shareOnFacebook")}
                  </button>
                  <button type="button" onClick={shareOnWhatsApp} disabled={shareMutation.isPending} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-ink-muted transition hover:bg-midnight-deep hover:text-ink disabled:opacity-50">
                    <FontAwesomeIcon icon={faWhatsapp} className="h-4 w-4" aria-hidden="true" />{t("feed.shareOnWhatsApp")}
                  </button>
                  <button type="button" onClick={shareOnDiscord} disabled={shareMutation.isPending} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-ink-muted transition hover:bg-midnight-deep hover:text-ink disabled:opacity-50">
                    <FontAwesomeIcon icon={faDiscord} className="h-4 w-4" aria-hidden="true" />{t("feed.shareOnDiscord")}
                  </button>
                  {supportsNativeShare && (
                    <button type="button" onClick={shareNatively} disabled={shareMutation.isPending} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-ink-muted transition hover:bg-midnight-deep hover:text-ink disabled:opacity-50">
                      <FontAwesomeIcon icon={faShare} className="h-4 w-4" aria-hidden="true" />{t("feed.shareNative")}
                    </button>
                  )}
                </div>
                {shareMutation.isPending && <p role="status" className="mt-2 px-1 text-[11px] text-ink-muted"><FontAwesomeIcon icon={faSpinner} className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />{t("common.loading")}</p>}
              </div>
            )}
          </div>
          </div>
          <div className="mt-3 flex w-full min-w-0 flex-wrap items-center gap-2 sm:mt-2">
          {post.project && (
            <div className="flex min-w-0 max-w-full flex-[1_1_9rem] flex-wrap items-center gap-2 rounded-lg border border-midnight-border bg-midnight-deep/30 px-3 py-2" aria-label={projectReviewsQuery.data ? t("projects.reviewsAverage", { average: projectReviewsQuery.data.summary.average.toFixed(1), count: projectReviewsQuery.data.summary.total }) : projectReviewsQuery.isError ? t("projects.reviewsLoadError") : t("projects.reviewsTitle")}>
              {projectReviewsQuery.isLoading ? <span className="skeleton h-3 w-14" aria-hidden="true" /> : <span className="shrink-0 text-xs font-semibold text-ink">{projectReviewsQuery.data ? t("projects.reviewCount", { count: projectReviewsQuery.data.summary.total }) : "—"}</span>}
              <span className="inline-flex items-center gap-0.5 text-gold-soft" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => <FontAwesomeIcon key={index} icon={faStar} className={`h-3.5 w-3.5 ${!projectReviewsQuery.isError && projectReviewsQuery.data && index < Math.round(projectReviewsQuery.data.summary.average) ? "text-gold-soft" : "text-midnight-border"}`} aria-hidden="true" />)}
              </span>
            </div>
          )}

          {postType === "PERSONAL" && showJoinAction && profileHref && post.author.id !== session?.user?.id && (
            <div className="ml-auto flex flex-col items-end gap-1">
              {associationMutation.isError && <p role="alert" className="text-xs text-rose-300">{t("feed.associationError")}</p>}
              {!associationsQuery.isLoading && !isAuthorAssociated && (
                <button type="button" disabled={Boolean(associationStatus) || associationMutation.isPending} onClick={() => { setAssociationStatus("PENDING"); associationMutation.mutate(); }} className="btn-gold !rounded-xl !px-3 !py-2">
                  <FontAwesomeIcon icon={faHandshake} className="h-4 w-4" aria-hidden="true" />
                  {associationStatus ? t("feed.associationSent") : t("feed.associate")}
                </button>
              )}
              {post.project && collaborationStatus !== "APPROVED" && (
                <button type="button" disabled={collaborationStatus !== null || joinMutation.isPending} onClick={() => { setJoinStatus("PENDING"); joinMutation.mutate(); }} className="btn-ghost !rounded-xl !px-3 !py-2">
                  <FontAwesomeIcon icon={faFolderOpen} className="h-4 w-4" aria-hidden="true" />
                  {collaborationStatus ? t("feed.joined") : t("feed.associateProject")}
                </button>
              )}
              {joinMutation.isError && <p role="alert" className="text-xs text-rose-300">{t("feed.joinError")}</p>}
            </div>
          )}

          {postType === "TEAM" && post.project && showJoinAction && collaborationStatus !== "APPROVED" && (
            <div className="ml-auto flex flex-col items-end gap-1">
              {joinMutation.isError && <p role="alert" className="text-xs text-rose-300">{t("feed.joinError")}</p>}
              <button
                type="button"
                disabled={collaborationStatus !== null || joinMutation.isPending}
                onClick={() => { setJoinStatus("PENDING"); joinMutation.mutate(); }}
                className="btn-gold !px-3 !py-2"
              >
                {collaborationStatus === "REJECTED" ? <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" /> : collaborationStatus ? <FontAwesomeIcon icon={faCheck} className="h-4 w-4" aria-hidden="true" /> : <FontAwesomeIcon icon={faUserPlus} className="h-4 w-4" aria-hidden="true" />}
                {collaborationStatus === "APPROVED"
                  ? t("feed.alreadyJoined")
                  : collaborationStatus === "REJECTED"
                    ? t("feed.requestDeclined")
                    : collaborationStatus
                      ? t("feed.joined")
                      : t("feed.joinTeam")}
              </button>
            </div>
          )}

          {postType === "PROJECT" && post.project && (
            <Link href={contextHref ?? "#"} className="btn-gold ml-auto !rounded-xl !px-3 !py-2">
              <FontAwesomeIcon icon={faFolderOpen} className="h-4 w-4" aria-hidden="true" />
              {t("feed.viewHub")}
            </Link>
          )}
          </div>
        </footer>
      )}

      {reviewsOpen && post.project && <ProjectReviews projectId={post.project.id} id={`post-reviews-${post.id}`} embedded />}

      {commentsOpen && (
        <PostComments postId={post.id} onCreated={() => setCommentCount((count) => count + 1)} />
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`post-options-title-${post.id}`}
        onCancel={() => setDialogMode(null)}
        onClose={() => setDialogMode(null)}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-midnight-border bg-midnight-card p-0 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={submitDialog}>
          <header className="flex items-start justify-between gap-4 border-b border-midnight-border px-5 py-4">
            <div>
              <h3 id={`post-options-title-${post.id}`} className="text-base font-semibold text-ink">
                {dialogMode === "edit" ? t("feed.editPost") : dialogMode === "delete" ? t("feed.deleteConfirmTitle") : t("feed.reportPost")}
              </h3>
              {dialogMode === "delete" && <p className="mt-1 text-sm text-ink-muted">{t("feed.deleteConfirmMessage")}</p>}
            </div>
            <button type="button" onClick={() => setDialogMode(null)} aria-label={t("common.close")} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-midnight-deep hover:text-ink">
              <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-4 p-5">
            {dialogMode === "edit" && (
              <label className="block text-xs font-medium text-ink-muted">
                {t("feed.postText")}
                <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={3000} rows={6} className="input mt-1.5 resize-y !rounded-lg" />
              </label>
            )}
            {dialogMode === "report" && (
              <>
                <label className="block text-xs font-medium text-ink-muted">
                  {t("feed.reportReason")}
                  <select value={reportReason} onChange={(event) => setReportReason(event.target.value as PostReportReason)} className="input mt-1.5 !rounded-lg">
                    <option value="spam">{t("feed.reportReasons.spam")}</option>
                    <option value="harassment">{t("feed.reportReasons.harassment")}</option>
                    <option value="inappropriate">{t("feed.reportReasons.inappropriate")}</option>
                    <option value="other">{t("feed.reportReasons.other")}</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-ink-muted">
                  {t("feed.reportDetails")}
                  <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={1000} rows={3} className="input mt-1.5 resize-y !rounded-lg" />
                </label>
              </>
            )}
            {dialogError && <p role="alert" className="text-xs text-rose-300">{dialogError}</p>}
          </div>

          <footer className="flex justify-end gap-2 border-t border-midnight-border px-5 py-4">
            <button type="button" onClick={() => setDialogMode(null)} className="btn-ghost !rounded-lg !px-3 !py-2 text-xs">{t("common.cancel")}</button>
            <button
              type="submit"
              disabled={editMutation.isPending || deleteMutation.isPending || reportMutation.isPending || (dialogMode === "edit" && !editContent.trim())}
              className={cn("btn-gold !rounded-lg !px-3 !py-2 text-xs", dialogMode === "delete" && "!bg-rose-500 !text-white")}
            >
              {editMutation.isPending || deleteMutation.isPending || reportMutation.isPending
                ? t("common.loading")
                : dialogMode === "edit" ? t("feed.saveChanges") : dialogMode === "delete" ? t("feed.deletePost") : t("feed.sendReport")}
            </button>
          </footer>
        </form>
      </dialog>
    </article>
  );
}

export default PostCard;
