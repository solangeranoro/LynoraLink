"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Code2, CornerDownRight, ExternalLink, Image as ImageIcon, MessageCircle, Send } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { LinkedText } from "@/components/LinkedText";
import { ReactionPicker, type ReactionType } from "@/components/ReactionPicker";
import { useTranslation } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils";
import { useSession } from "next-auth/react";

type PostComment = {
  id: string;
  content: string;
  codeSnippet: string | null;
  imageUrl: string | null;
  githubUrl: string | null;
  parentId: string | null;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null; handle: string | null };
  replies: PostComment[];
  reactionByMe: ReactionType | null;
  reactionCounts?: Partial<Record<ReactionType, number>>;
  _count: { reactions: number; replies: number };
};

async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const response = await fetch(`/api/posts/${postId}/comments`);
  if (!response.ok) throw new Error("comments_load_failed");
  const data = await response.json() as { comments: PostComment[] };
  return data.comments;
}

function addComment(comments: PostComment[], comment: PostComment): PostComment[] {
  if (!comment.parentId) return [...comments, comment];
  return comments.map((item) => item.id === comment.parentId
    ? { ...item, replies: [...item.replies, comment], _count: { ...item._count, replies: item._count.replies + 1 } }
    : { ...item, replies: addComment(item.replies, comment) });
}

function replaceComment(comments: PostComment[], commentId: string, replacement: PostComment): [PostComment[], boolean] {
  let replaced = false;
  const updated = comments.map((item) => {
    if (item.id === commentId) {
      replaced = true;
      return replacement;
    }
    const [replies, replyReplaced] = replaceComment(item.replies, commentId, replacement);
    if (replyReplaced) replaced = true;
    return replyReplaced ? { ...item, replies } : item;
  });
  return [updated, replaced];
}

function removeComment(comments: PostComment[], commentId: string): PostComment[] {
  const updated: PostComment[] = [];
  for (const item of comments) {
    if (item.id === commentId) continue;
    const directReplyRemoved = item.replies.some((reply) => reply.id === commentId);
    const replies = removeComment(item.replies, commentId);
    updated.push(replies.length !== item.replies.length || replies.some((reply, index) => reply !== item.replies[index])
      ? {
        ...item,
        replies,
        _count: { ...item._count, replies: Math.max(0, item._count.replies - (directReplyRemoved ? 1 : 0)) },
      }
      : item);
  }
  return updated;
}

export function PostComments({ postId, onCreated }: { postId: string; onCreated: () => void }) {
  const { t, locale } = useTranslation();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const commentDraftRef = useRef({ content: "", codeSnippet: "", imageUrl: "", githubUrl: "" });
  const replyContentRef = useRef("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const commentsQuery = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => fetchPostComments(postId),
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const createComment = useMutation({
    mutationFn: async (input: { content: string; parentId?: string; codeSnippet?: string; imageUrl?: string; githubUrl?: string }) => {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("comment_create_failed");
      return response.json() as Promise<{ comment: PostComment }>;
    },
    onMutate: async (input) => {
      const queryKey = ["post-comments", postId];
      await queryClient.cancelQueries({ queryKey });
      if (!session?.user) return { optimisticComment: null };

      const optimisticComment: PostComment = {
        id: `pending-${crypto.randomUUID()}`,
        content: input.content,
        codeSnippet: input.codeSnippet ?? null,
        imageUrl: input.imageUrl ?? null,
        githubUrl: input.githubUrl ?? null,
        parentId: input.parentId ?? null,
        createdAt: new Date().toISOString(),
        author: {
          id: session.user.id,
          name: session.user.name ?? null,
          image: session.user.image ?? null,
          handle: session.user.handle ?? null,
        },
        replies: [],
        reactionByMe: null,
        reactionCounts: {},
        _count: { reactions: 0, replies: 0 },
      };
      queryClient.setQueryData<PostComment[]>(queryKey, (current) => addComment(current ?? [], optimisticComment));
      return { optimisticComment };
    },
    onError: (_error, _input, context) => {
      if (context?.optimisticComment) {
        queryClient.setQueryData<PostComment[]>(["post-comments", postId], (current) =>
          current ? removeComment(current, context.optimisticComment.id) : current,
        );
      }
    },
    onSuccess: (data, input, context) => {
      const queryKey = ["post-comments", postId];
      queryClient.setQueryData<PostComment[]>(queryKey, (current) => {
        const comments = current ?? [];
        if (context?.optimisticComment) {
          const [replaced, didReplace] = replaceComment(comments, context.optimisticComment.id, data.comment);
          if (didReplace) return replaced;
        }
        return addComment(comments, data.comment);
      });
      if (input.parentId) {
        if (replyContentRef.current === input.content) {
          replyContentRef.current = "";
          setReplyContent("");
          setReplyToId(null);
        }
        setExpandedReplies((current) => ({ ...current, [input.parentId as string]: true }));
      } else {
        const draft = commentDraftRef.current;
        if (draft.content === input.content) {
          commentDraftRef.current = { ...commentDraftRef.current, content: "" };
          setContent("");
        }
        if (draft.codeSnippet === (input.codeSnippet ?? "")) {
          commentDraftRef.current = { ...commentDraftRef.current, codeSnippet: "" };
          setCodeSnippet("");
        }
        if (draft.imageUrl === (input.imageUrl ?? "")) {
          commentDraftRef.current = { ...commentDraftRef.current, imageUrl: "" };
          setImageUrl("");
        }
        if (draft.githubUrl === (input.githubUrl ?? "")) {
          commentDraftRef.current = { ...commentDraftRef.current, githubUrl: "" };
          setGithubUrl("");
        }
        if (
          draft.codeSnippet === (input.codeSnippet ?? "") &&
          draft.imageUrl === (input.imageUrl ?? "") &&
          draft.githubUrl === (input.githubUrl ?? "")
        ) {
          setDetailsOpen(false);
        }
      }
      onCreated();
      void queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ commentId, reaction }: { commentId: string; reaction: ReactionType }) => {
      const response = await fetch(`/api/posts/${postId}/comments/${commentId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (!response.ok) throw new Error("comment_reaction_failed");
      return response.json() as Promise<{
        reaction: ReactionType | null;
        count: number;
        reactionCounts: Partial<Record<ReactionType, number>>;
      }>;
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<PostComment[]>(["post-comments", postId], (current) => current?.map((comment) => {
        const update = (item: PostComment): PostComment => item.id === variables.commentId
          ? {
            ...item,
            reactionByMe: result.reaction,
            reactionCounts: result.reactionCounts,
            _count: { ...item._count, reactions: result.count },
          }
          : { ...item, replies: item.replies.map(update) };
        return update(comment);
      }));
    },
  });

  const comments = commentsQuery.data ?? [];
  function countComments(items: PostComment[]): number {
    return items.reduce((count, comment) => count + 1 + countComments(comment.replies), 0);
  }
  const totalComments = countComments(comments);

  function renderComment(comment: PostComment) {
    const repliesExpanded = expandedReplies[comment.id] ?? false;
    const replyIsOpen = replyToId === comment.id;
    const replyCount = comment.replies.length;

    return (
      <li key={comment.id} className="flex items-start gap-2.5">
        <Avatar src={comment.author.image} name={comment.author.name} size={comment.parentId ? 30 : 34} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold text-ink">{comment.author.name ?? comment.author.handle ?? "Maker"}</span>
            {comment.author.handle && <span className="text-[11px] text-ink-muted">@{comment.author.handle}</span>}
            <time dateTime={comment.createdAt} className="text-[10px] text-ink-muted">{timeAgo(comment.createdAt, locale)}</time>
          </div>
          <LinkedText text={comment.content} className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-midnight-border/70 bg-midnight-deep/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink/90" />
          {comment.codeSnippet && <pre className="mt-2 overflow-x-auto rounded-lg border border-midnight-border bg-midnight-deep p-3 text-xs text-gold-soft"><code>{comment.codeSnippet}</code></pre>}
          {comment.imageUrl && <a href={comment.imageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-gold-soft hover:text-gold-bright"><ImageIcon size={14} aria-hidden="true" />{t("feed.commentImage")}</a>}
          {comment.githubUrl && <a href={comment.githubUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-gold-soft hover:text-gold-bright">GitHub<ExternalLink size={13} aria-hidden="true" /></a>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {session?.user && (
              <ReactionPicker
                selected={comment.reactionByMe}
                count={comment._count.reactions}
                reactionCounts={comment.reactionCounts}
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
                onSelect={(nextReaction) => toggleReaction.mutate({ commentId: comment.id, reaction: nextReaction })}
                disabled={toggleReaction.isPending}
              />
            )}
            <button
              type="button"
              onClick={() => {
                setReplyToId(replyIsOpen ? null : comment.id);
                replyContentRef.current = "";
                setReplyContent("");
              }}
              className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-ink-muted transition hover:bg-midnight-deep hover:text-ink"
            >
              <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
              {t("feed.reply")}
            </button>
            {replyCount > 0 && (
              <button
                type="button"
                aria-expanded={repliesExpanded}
                onClick={() => setExpandedReplies((current) => ({ ...current, [comment.id]: !repliesExpanded }))}
                className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-gold-soft transition hover:bg-gold/10"
              >
                {repliesExpanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                {repliesExpanded
                  ? t("feed.hideReplies")
                  : t(replyCount === 1 ? "feed.showOneReply" : "feed.showReplies", { count: replyCount })}
              </button>
            )}
          </div>

          {replyIsOpen && session?.user && (
            <form
              className="mt-3 flex items-start gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (replyContentRef.current.trim()) createComment.mutate({ content: replyContentRef.current, parentId: comment.id });
              }}
            >
              <Avatar src={session.user.image} name={session.user.name} size={28} className="mt-1" />
              <label className="sr-only" htmlFor={`reply-${comment.id}`}>{t("feed.replyPlaceholder")}</label>
              <div className="min-w-0 flex-1">
                <textarea
                  id={`reply-${comment.id}`}
                  value={replyContent}
                  onChange={(event) => {
                    replyContentRef.current = event.target.value;
                    setReplyContent(event.target.value);
                  }}
                  maxLength={2000}
                  rows={2}
                  placeholder={t("feed.replyPlaceholder")}
                  className="input min-h-14 resize-none !rounded-lg !bg-midnight-deep/50 !px-3 !py-2 text-xs"
                />
                <div className="mt-1.5 flex justify-end gap-2">
                  <button type="button" onClick={() => setReplyToId(null)} className="btn-ghost !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[11px]">{t("common.cancel")}</button>
                  <button type="submit" disabled={!replyContent.trim() || createComment.isPending} className="btn-gold inline-flex !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[11px]">
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("feed.replySubmit")}
                  </button>
                </div>
              </div>
            </form>
          )}

          {repliesExpanded && replyCount > 0 && (
            <ul className="mt-3 space-y-3 border-l border-midnight-border/70 pl-3 sm:ml-2 sm:pl-4">
              {comment.replies.map((reply) => renderComment(reply))}
            </ul>
          )}
        </div>
      </li>
    );
  }

  return (
    <section aria-label={t("feed.commentsTitle")} className="mt-4 border-t border-midnight-border/70 pt-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MessageCircle className="h-4 w-4 text-gold-soft" aria-hidden="true" />
          {t("feed.commentsTitle")}
        </h3>
        <span className="rounded-full border border-midnight-border px-2 py-0.5 text-[11px] tabular-nums text-ink-muted">
          {totalComments} {t(totalComments === 1 ? "feed.commentCountSingular" : "feed.commentCountPlural")}
        </span>
      </header>

      {commentsQuery.isLoading ? (
        <div className="space-y-4 py-5" role="status" aria-busy="true" aria-label={t("feed.commentsLoading")}>
          <span className="sr-only">{t("feed.commentsLoading")}</span>
          {[0, 1].map((item) => (
            <div key={item} className="flex items-start gap-2.5" aria-hidden="true">
              <div className="skeleton h-[34px] w-[34px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton h-2.5 w-12" />
                </div>
                <div className="space-y-1.5 rounded-2xl border border-midnight-border/70 bg-midnight-deep/60 px-3.5 py-3">
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-2/3" />
                </div>
                <div className="skeleton h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : commentsQuery.isError ? (
        <div className="py-4">
          <p role="alert" className="text-xs text-rose-300">{t("feed.commentsError")}</p>
          <button type="button" onClick={() => commentsQuery.refetch()} className="mt-2 text-xs font-semibold text-gold-soft hover:text-gold-bright">
            {t("feed.retryComments")}
          </button>
        </div>
      ) : comments.length === 0 ? (
        <p className="py-4 text-xs text-ink-muted">{t("feed.noComments")}</p>
      ) : (
        <ul role="log" aria-live="polite" aria-relevant="additions" className="mt-4 space-y-3">
          {comments.map((comment) => renderComment(comment))}
        </ul>
      )}

      {session?.user ? (
        <form
          className="mt-5 flex items-start gap-3 border-t border-midnight-border/50 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            const draft = commentDraftRef.current;
            if (draft.content.trim()) {
              createComment.mutate({
                content: draft.content,
                codeSnippet: draft.codeSnippet || undefined,
                imageUrl: draft.imageUrl || undefined,
                githubUrl: draft.githubUrl || undefined,
              });
            }
          }}
        >
          <Avatar src={session.user.image} name={session.user.name} size={36} className="mt-1" />
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={`comment-${postId}`}>{t("feed.commentPlaceholder")}</label>
            <textarea
              id={`comment-${postId}`}
              value={content}
              onChange={(event) => {
                commentDraftRef.current = { ...commentDraftRef.current, content: event.target.value };
                setContent(event.target.value);
              }}
              maxLength={2000}
              rows={2}
              placeholder={t("feed.commentPlaceholder")}
              className="input min-h-16 resize-none !rounded-lg !bg-midnight-deep/50 !px-3 !py-2.5 text-sm leading-relaxed"
            />
            <button type="button" onClick={() => setDetailsOpen((open) => !open)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition hover:text-gold-soft">
              <Code2 size={14} aria-hidden="true" />{detailsOpen ? t("feed.hideCommentDetails") : t("feed.addCommentDetails")}
            </button>
            {detailsOpen && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="sr-only">{t("feed.commentCode")}</span>
                  <textarea value={codeSnippet} onChange={(event) => {
                    commentDraftRef.current = { ...commentDraftRef.current, codeSnippet: event.target.value };
                    setCodeSnippet(event.target.value);
                  }} maxLength={20_000} rows={3} className="input resize-y font-mono text-xs" placeholder={t("feed.commentCode")} />
                </label>
                <label>
                  <span className="sr-only">{t("feed.commentImageUrl")}</span>
                  <input type="url" value={imageUrl} onChange={(event) => {
                    commentDraftRef.current = { ...commentDraftRef.current, imageUrl: event.target.value };
                    setImageUrl(event.target.value);
                  }} maxLength={3000} className="input" placeholder={t("feed.commentImageUrl")} />
                </label>
                <label>
                  <span className="sr-only">GitHub URL</span>
                  <input type="url" value={githubUrl} onChange={(event) => {
                    commentDraftRef.current = { ...commentDraftRef.current, githubUrl: event.target.value };
                    setGithubUrl(event.target.value);
                  }} maxLength={300} className="input" placeholder="https://github.com/..." />
                </label>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[10px] tabular-nums text-ink-muted">{content.length}/2000</span>
              <button
                type="submit"
                disabled={!content.trim() || createComment.isPending}
                aria-label={createComment.isPending ? t("feed.commentSending") : t("feed.commentSubmit")}
                title={createComment.isPending ? t("feed.commentSending") : t("feed.commentSubmit")}
                className="btn-gold flex min-h-9 shrink-0 items-center justify-center gap-2 !rounded-lg !px-3 !py-2 text-xs disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{createComment.isPending ? t("feed.commentSending") : t("feed.commentSubmit")}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-xs text-ink-muted">{t("feed.signInToComment")}</p>
      )}
      {toggleReaction.isError && <p role="alert" className="mt-2 text-xs text-rose-300">{t("feed.commentReactionError")}</p>}
      {createComment.isError && <p role="alert" className="mt-2 text-xs text-rose-300">{t("feed.commentCreateError")}</p>}
    </section>
  );
}