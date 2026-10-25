"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check, ChevronDown, Code2, CornerDownRight, FileText, LoaderCircle, MessageCircle, MessagesSquare, MoreHorizontal, Paperclip, Plus, Search, Send, Trash2, X } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { CodeBlock } from "@/components/CodeBlock";
import { POST_REACTIONS, ReactionArtwork, type ReactionType } from "@/components/ReactionPicker";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils";
type ConversationPerson = {
  id: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  isOnline: boolean;
};

type ConversationMessage = {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; name: string | null; image: string | null };
  replyTo?: { id: string; content: string; sender: { id: string; name: string | null; image: string | null } } | null;
  attachments?: ConversationAttachment[];
  reactionByMe?: ReactionType | null;
  reactionCounts?: Partial<Record<ReactionType, number>>;
};

type ConversationAttachment = { id: string; name: string; mimeType: string; size: number };

type ConversationItem = {
  id: string;
  title: string | null;
  isGroup: boolean;
  updatedAt: string;
  participants: ConversationPerson[];
  lastMessage: ConversationMessage | null;
};

type ConversationThread = ConversationItem & { messages: ConversationMessage[] };
type TypingUser = Pick<ConversationPerson, "id" | "name" | "image">;
type Maker = ConversationPerson;
type MessageTimeFilter = "all" | "today" | "yesterday" | "last7Days" | "older";
type MessageDayGroup = { key: string; label: string; messages: ConversationMessage[] };
type SendMessageVariables = {
  conversationId: string;
  content: string;
  attachments: File[];
  replyToId?: string;
  replyToMessage: ConversationMessage | null;
  temporaryId: string;
};
type MessageDeleteScope = "me" | "everyone";

function displayName(person?: { name: string | null; handle?: string | null }) {
  return person?.name ?? (person?.handle ? `@${person.handle}` : "Maker");
}

function messageTime(date: string, locale: "en" | "fr") {
  return new Date(date).toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHAT_ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  ".avif": "image/avif",
  ".c": "text/x-c",
  ".cc": "text/x-c",
  ".cpp": "text/x-c++",
  ".cs": "text/plain",
  ".css": "text/css",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".go": "text/x-go",
  ".h": "text/x-c",
  ".hpp": "text/x-c++",
  ".html": "text/html",
  ".java": "text/x-java",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jsx": "text/javascript",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".php": "text/x-php",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".py": "text/x-python",
  ".rb": "text/x-ruby",
  ".rs": "text/x-rust",
  ".sh": "text/x-shellscript",
  ".sql": "application/sql",
  ".toml": "application/toml",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".zip": "application/zip",
};
const MAX_CHAT_ATTACHMENT_COUNT = 5;
const MAX_CHAT_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function chatAttachmentMimeType(file: File) {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const expectedType = CHAT_ATTACHMENT_MIME_BY_EXTENSION[extension];
  const declaredType = file.type.toLowerCase();
  if (!expectedType) return null;
  if (!declaredType || declaredType === "application/octet-stream" || declaredType === expectedType
    || (expectedType.startsWith("text/") && declaredType.startsWith("text/"))) return expectedType;
  return extension === ".zip" && declaredType === "application/x-zip-compressed" ? expectedType : null;
}

function formatMessageFileSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.ceil(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function renderMessageContent(content: string, isFrench: boolean) {
  const parts: ReactNode[] = [];
  const codeBlockPattern = /```([^\r\n`]*)\r?\n([\s\S]*?)```/g;
  let cursor = 0;
  let blockIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockPattern.exec(content)) !== null) {
    if (match.index > cursor) {
      parts.push(<span key={`text-${blockIndex}`} className="whitespace-pre-wrap break-words">{content.slice(cursor, match.index)}</span>);
    }
    const language = match[1].trim();
    const code = match[2].replace(/\r?\n$/, "");
    parts.push(<CodeBlock key={`code-${blockIndex}`} code={code} language={language} isFrench={isFrench} />);
    cursor = codeBlockPattern.lastIndex;
    blockIndex += 1;
  }

  if (cursor < content.length) {
    parts.push(<span key={`text-${blockIndex}`} className="whitespace-pre-wrap break-words">{content.slice(cursor)}</span>);
  }

  return <div className="min-w-0 break-words text-sm leading-relaxed">{parts.length ? parts : content}</div>;
}

function renderConversationPreview(message: ConversationMessage, currentUserId: string | undefined, isFrench: boolean) {
  const codeBlockPattern = /```([^\r\n`]*)\r?\n([\s\S]*?)```/g;
  const codeBlocks = [...message.content.matchAll(codeBlockPattern)];
  const plainText = message.content
    .replace(codeBlockPattern, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const firstCodeBlock = codeBlocks[0];
  const language = firstCodeBlock?.[1].trim();
  const codeLines = firstCodeBlock?.[2].replace(/\r?\n$/, "").split(/\r?\n/).length ?? 0;
  const codeLabel = firstCodeBlock
    ? `${isFrench ? "Bloc de code" : "Code block"}${language ? ` · ${language}` : ""}${codeLines > 1 ? ` · ${codeLines} ${isFrench ? "lignes" : "lines"}` : ""}`
    : "";
  const additionalBlocks = codeBlocks.length > 1
    ? `+${codeBlocks.length - 1} ${isFrench ? "autres blocs" : "more blocks"}`
    : "";
  const preview = [plainText, codeLabel, additionalBlocks].filter(Boolean).join(" · ");

  return (
    <>
      {message.sender.id === currentUserId && <span className="shrink-0 font-medium">{isFrench ? "Vous :" : "You:"}</span>}
      {firstCodeBlock && <Code2 size={12} className="shrink-0 text-gold-soft" aria-hidden="true" />}
      <span className="min-w-0 truncate">{preview}</span>
    </>
  );
}

function matchesConversationTimeFilter(dateValue: string, filter: MessageTimeFilter) {
  if (filter === "all") return true;
  const timestamp = new Date(dateValue).getTime();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfLastSevenDays = new Date(startOfToday);
  startOfLastSevenDays.setDate(startOfLastSevenDays.getDate() - 7);

  if (filter === "today") return timestamp >= startOfToday.getTime();
  if (filter === "yesterday") return timestamp >= startOfYesterday.getTime() && timestamp < startOfToday.getTime();
  if (filter === "last7Days") return timestamp >= startOfLastSevenDays.getTime();
  return timestamp < startOfLastSevenDays.getTime();
}

function sameLocalDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function groupMessagesByDay(
  messages: ConversationMessage[],
  locale: "en" | "fr",
  todayLabel: string,
  yesterdayLabel: string,
): MessageDayGroup[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups: MessageDayGroup[] = [];

  for (const message of messages) {
    const date = new Date(message.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const label = sameLocalDay(date, today)
      ? todayLabel
      : sameLocalDay(date, yesterday)
        ? yesterdayLabel
        : date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
        });
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.key === key) lastGroup.messages.push(message);
    else groups.push({ key, label, messages: [message] });
  }

  return groups;
}

export default function MessageCenter() {
  const { locale, t } = useTranslation();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversationFilter, setConversationFilter] = useState("");
  const [conversationTimeFilter, setConversationTimeFilter] = useState<MessageTimeFilter>("all");
  const [makerFilter, setMakerFilter] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ConversationMessage | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<ConversationMessage | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [openMessageReactionId, setOpenMessageReactionId] = useState<string | null>(null);
  const [deleteScope, setDeleteScope] = useState<MessageDeleteScope>("me");
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const deleteCancelButtonRef = useRef<HTMLButtonElement>(null);
  const [conversationTimeMenuOpen, setConversationTimeMenuOpen] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const lastTypingPingRef = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const conversationTimeMenuRef = useRef<HTMLDivElement>(null);
  const conversationTimeTriggerRef = useRef<HTMLButtonElement>(null);
  const isFrench = locale === "fr";

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const response = await fetch("/api/conversations");
      if (!response.ok) throw new Error("conversations_load_failed");
      const result = await response.json();
      return result.conversations as ConversationItem[];
    },
    refetchInterval: 15000,
  });

  const makersQuery = useQuery({
    queryKey: ["makers", "all"],
    queryFn: async () => {
      const response = await fetch("/api/makers?all=1");
      if (!response.ok) throw new Error("makers_load_failed");
      const result = await response.json();
      return result.makers as Maker[];
    },
    enabled: composeOpen,
  });

  useEffect(() => {
    if (!conversationTimeMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!conversationTimeMenuRef.current?.contains(event.target as Node)) setConversationTimeMenuOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setConversationTimeMenuOpen(false);
        conversationTimeTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [conversationTimeMenuOpen]);

  useEffect(() => {
    if (composeOpen) return;
    const conversations = conversationsQuery.data ?? [];
    const requestedId = new URLSearchParams(window.location.search).get("conversationId");
    if (requestedId && conversations.some((conversation) => conversation.id === requestedId)) {
      if (selectedId !== requestedId) setSelectedId(requestedId);
      return;
    }
    if (selectedId && conversations.some((conversation) => conversation.id === selectedId)) return;
    if (window.matchMedia("(max-width: 767px)").matches) return;
    setSelectedId(conversations[0]?.id ?? null);
  }, [conversationsQuery.data, selectedId, composeOpen]);

  const conversationQuery = useQuery({
    queryKey: ["conversation", selectedId],
    enabled: Boolean(selectedId) && !composeOpen,
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${selectedId}`);
      if (!response.ok) throw new Error("conversation_load_failed");
      const result = await response.json();
      return result.conversation as ConversationThread;
    },
    refetchInterval: selectedId && !composeOpen ? 8000 : false,
  });

  const typingStatusQuery = useQuery({
    queryKey: ["conversation-typing", selectedId],
    enabled: Boolean(selectedId) && !composeOpen,
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${selectedId}/typing`, { cache: "no-store" });
      if (!response.ok) throw new Error("typing_status_load_failed");
      const result = await response.json();
      return result.typingUsers as TypingUser[];
    },
    refetchInterval: selectedId && !composeOpen ? 2000 : false,
  });

  useEffect(() => {
    lastTypingPingRef.current = 0;
  }, [selectedId]);

  const createConversationMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "conversation_create_failed");
      return result as { id: string; created: boolean };
    },
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedId(id);
      setComposeOpen(false);
      setMakerFilter("");
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content, replyToId, attachments }: SendMessageVariables) => {
      const requestOptions: RequestInit = attachments.length
        ? (() => {
          const formData = new FormData();
          formData.set("content", content);
          if (replyToId) formData.set("replyToId", replyToId);
          attachments.forEach((file) => formData.append("attachments", file, file.name));
          return { method: "POST", body: formData };
        })()
        : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, replyToId }),
        };
      const response = await fetch(`/api/conversations/${conversationId}/messages`, requestOptions);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "message_send_failed");
      return result.message as ConversationMessage;
    },
    onMutate: async (variables) => {
      const queryKey = ["conversation", variables.conversationId] as const;
      await queryClient.cancelQueries({ queryKey });
      if (variables.attachments.length > 0) return;
      const senderId = session?.user?.id ?? "pending";
      const optimisticMessage: ConversationMessage = {
        id: variables.temporaryId,
        content: variables.content,
        senderId,
        createdAt: new Date().toISOString(),
        sender: { id: senderId, name: session?.user?.name ?? null, image: session?.user?.image ?? null },
        replyTo: variables.replyToMessage ? {
          id: variables.replyToMessage.id,
          content: variables.replyToMessage.content,
          sender: variables.replyToMessage.sender,
        } : null,
        reactionByMe: null,
        reactionCounts: {},
      };
      queryClient.setQueryData<ConversationThread>(queryKey, (current) => current && ({
        ...current,
        messages: [...current.messages, optimisticMessage],
      }));
    },
    onError: (_error, variables) => {
      queryClient.setQueryData<ConversationThread>(["conversation", variables.conversationId], (current) => current && ({
        ...current,
        messages: current.messages.filter((message) => message.id !== variables.temporaryId),
      }));
      setDraft((current) => current || variables.content);
      if (variables.attachments.length > 0) setSelectedFiles((current) => current.length ? current : variables.attachments);
      setReplyingTo((current) => current ?? variables.replyToMessage);
    },
    onSuccess: (message, variables) => {
      queryClient.setQueryData<ConversationThread>(["conversation", variables.conversationId], (current) => current && ({
        ...current,
        messages: [...current.messages.filter((item) => item.id !== variables.temporaryId && item.id !== message.id), message],
      }));
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation", variables.conversationId] });
    },
  });

  const reactToMessageMutation = useMutation({
    mutationFn: async ({ conversationId, messageId, reaction }: { conversationId: string; messageId: string; reaction: ReactionType }) => {
      const response = await fetch(`/api/conversations/${conversationId}/messages/${messageId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "message_reaction_failed");
      return result as { reaction: ReactionType | null; reactionCounts: Partial<Record<ReactionType, number>> };
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<ConversationThread>(["conversation", variables.conversationId], (current) => current && ({
        ...current,
        messages: current.messages.map((message) => message.id === variables.messageId
          ? { ...message, reactionByMe: result.reaction, reactionCounts: result.reactionCounts }
          : message),
      }));
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ conversationId, messageId, scope }: { conversationId: string; messageId: string; scope: MessageDeleteScope }) => {
      const response = await fetch(`/api/conversations/${conversationId}/messages/${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!response.ok) throw new Error("message_delete_failed");
      return { conversationId, messageId };
    },
    onSuccess: async ({ conversationId, messageId }) => {
      queryClient.setQueryData<ConversationThread>(["conversation", conversationId], (current) => current && ({
        ...current,
        messages: current.messages.filter((message) => message.id !== messageId).map((message) => (
          message.replyTo?.id === messageId ? { ...message, replyTo: null } : message
        )),
      }));
      setReplyingTo((current) => current?.id === messageId ? null : current);
      setMessageToDelete(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] }),
      ]);
    },
  });

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (messageToDelete && !dialog.open) {
      dialog.showModal();
      deleteCancelButtonRef.current?.focus({ preventScroll: true });
    }
    if (!messageToDelete && dialog.open) dialog.close();
  }, [messageToDelete]);

  useEffect(() => {
    if (!openMessageMenuId) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-message-actions]")) {
        setOpenMessageMenuId(null);
        setOpenMessageReactionId(null);
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMessageMenuId(null);
        setOpenMessageReactionId(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMessageMenuId]);

  const conversations = conversationsQuery.data ?? [];
  const activeConversation = conversations.find((conversation) => conversation.id === selectedId);
  const thread = conversationQuery.data;
  const participant = thread?.participants[0] ?? activeConversation?.participants[0];
  const filteredConversations = conversations.filter((conversation) => {
    const person = conversation.participants[0];
    const searchable = `${conversation.title ?? ""} ${person?.name ?? ""} ${person?.handle ?? ""} ${conversation.lastMessage?.content ?? ""}`.toLocaleLowerCase(locale);
    const lastActivity = conversation.lastMessage?.createdAt ?? conversation.updatedAt;
    return searchable.includes(conversationFilter.trim().toLocaleLowerCase(locale))
      && matchesConversationTimeFilter(lastActivity, conversationTimeFilter);
  });
  const filteredMakers = (makersQuery.data ?? []).filter((maker) => {
    if (maker.id === session?.user?.id) return false;
    const searchable = `${maker.name ?? ""} ${maker.handle ?? ""} ${maker.headline ?? ""}`.toLocaleLowerCase(locale);
    return searchable.includes(makerFilter.trim().toLocaleLowerCase(locale));
  });
  const messageDayGroups = groupMessagesByDay(
    thread?.messages ?? [],
    locale,
    t("chat.timeFilters.today"),
    t("chat.timeFilters.yesterday"),
  );

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) messageList.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" });
  }, [thread?.messages.length, selectedId]);

  function onAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!incomingFiles.length) return;

    const nextFiles = [...selectedFiles, ...incomingFiles];
    if (nextFiles.length > MAX_CHAT_ATTACHMENT_COUNT) {
      setAttachmentError(isFrench ? "Maximum 5 fichiers par message." : "Maximum 5 files per message.");
      return;
    }
    if (nextFiles.reduce((total, file) => total + file.size, 0) > MAX_CHAT_ATTACHMENT_BYTES) {
      setAttachmentError(isFrench ? "La taille totale ne peut pas dépasser 25 Mo." : "The total size cannot exceed 25 MB.");
      return;
    }
    if (incomingFiles.some((file) => !chatAttachmentMimeType(file))) {
      setAttachmentError(isFrench ? "Formats acceptés : images, PDF et ZIP." : "Supported formats: images, PDF, and ZIP.");
      return;
    }

    setSelectedFiles(nextFiles);
    setAttachmentError(null);
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if ((!content && selectedFiles.length === 0) || !selectedId || sendMessageMutation.isPending) return;
    const attachments = selectedFiles;
    lastTypingPingRef.current = 0;
    publishTypingStatus(selectedId, false);
    const replyToMessage = replyingTo;
    setDraft("");
    setSelectedFiles([]);
    setAttachmentError(null);
    setReplyingTo(null);
    sendMessageMutation.mutate({
      conversationId: selectedId,
      content,
      attachments,
      replyToId: replyToMessage?.id,
      replyToMessage,
      temporaryId: `pending-${crypto.randomUUID()}`,
    });
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function startCompose() {
    setComposeOpen(true);
    setMakerFilter("");
  }

  function confirmDeleteMessage() {
    if (!selectedId || !messageToDelete) return;
    deleteMessageMutation.mutate({ conversationId: selectedId, messageId: messageToDelete.id, scope: deleteScope });
  }

  const personName = activeConversation?.isGroup
    ? activeConversation.title ?? (isFrench ? "Conversation de groupe" : "Group conversation")
    : displayName(participant);
  const conversationTimeOptions: { value: MessageTimeFilter; label: string }[] = [
    { value: "all", label: t("chat.timeFilters.all") },
    { value: "today", label: t("chat.timeFilters.today") },
    { value: "yesterday", label: t("chat.timeFilters.yesterday") },
    { value: "last7Days", label: t("chat.timeFilters.last7Days") },
    { value: "older", label: t("chat.timeFilters.older") },
  ];
  const selectedConversationTimeLabel = conversationTimeOptions.find((option) => option.value === conversationTimeFilter)?.label ?? t("chat.timeFilters.all");
  const typingUsers = typingStatusQuery.data ?? [];
  const typingName = typingUsers[0]?.name ?? "Maker";
  const typingLabel = typingUsers.length === 1
    ? (isFrench ? `${typingName} écrit…` : `${typingName} is typing…`)
    : typingUsers.length > 1
      ? (isFrench
        ? `${typingName} et ${typingUsers.length - 1} autre${typingUsers.length > 2 ? "s" : ""} écrivent…`
        : `${typingName} and ${typingUsers.length - 1} other${typingUsers.length > 2 ? "s" : ""} are typing…`)
      : "";

  function publishTypingStatus(conversationId: string, isTyping: boolean) {
    void fetch(`/api/conversations/${conversationId}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTyping }),
    }).catch(() => undefined);
  }

  function updateDraft(value: string) {
    setDraft(value);
    if (!selectedId) return;
    if (!value.trim()) {
      lastTypingPingRef.current = 0;
      publishTypingStatus(selectedId, false);
      return;
    }

    const now = Date.now();
    if (now - lastTypingPingRef.current >= 2000) {
      lastTypingPingRef.current = now;
      publishTypingStatus(selectedId, true);
    }
  }

  return (
    <div className="md:space-y-5">
      <header className="hidden items-end justify-between gap-4 border-b border-midnight-border pb-5 md:flex">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{isFrench ? "Messagerie" : "Messages"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            {isFrench
              ? "Retrouvez vos conversations privées et échangez avec votre réseau."
              : "Manage your private conversations and stay in touch with your network."}
          </p>
        </div>
        <button type="button" onClick={startCompose} className="btn-gold !rounded-lg">
          {isFrench ? "Nouvelle conversation" : "New conversation"}
        </button>
      </header>

      <section className="card mobile-edge-card grid h-[calc(100dvh-4.125rem)] min-h-[16rem] max-h-none grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden md:h-[min(74vh,800px)] md:max-h-[52rem] md:min-h-[520px] md:grid-cols-[280px_minmax(0,1fr)]" aria-label={isFrench ? "Messagerie" : "Messaging"}>
        <aside className={`min-w-0 flex-col border-b border-midnight-border md:border-b-0 md:border-r ${selectedId && !composeOpen ? "hidden md:flex" : "flex"}`}>
          <div className="flex h-14 items-center justify-between border-b border-midnight-border px-4">
            <h2 className="text-sm font-semibold text-ink">{composeOpen ? (isFrench ? "Nouveau message" : "New message") : (isFrench ? "Conversations" : "Conversations")}</h2>
            {!composeOpen && <button type="button" onClick={startCompose} aria-label={isFrench ? "Nouveau message" : "New message"} title={isFrench ? "Nouveau message" : "New message"} className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-midnight-card hover:text-gold-soft md:hidden"><Plus size={17} aria-hidden="true" /></button>}
            {composeOpen && <button type="button" onClick={() => setComposeOpen(false)} aria-label={isFrench ? "Fermer" : "Close"} className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-midnight-card hover:text-ink"><ArrowLeft size={17} aria-hidden="true" /></button>}
          </div>

          {composeOpen ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="p-3"><label className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" /><input type="search" value={makerFilter} onChange={(event) => setMakerFilter(event.target.value)} placeholder={isFrench ? "Rechercher un maker" : "Search makers"} className="input !py-2 !pl-9 !text-xs" aria-label={isFrench ? "Rechercher un maker" : "Search makers"} /></label></div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {makersQuery.isLoading ? <div className="space-y-2 p-2"><div className="skeleton h-12" /><div className="skeleton h-12" /></div> : makersQuery.isError ? <p className="p-3 text-xs text-ink-muted">{isFrench ? "Impossible de charger les makers." : "Couldn't load makers."}</p> : filteredMakers.length ? (
                  <ul className="space-y-1">{filteredMakers.map((maker) => <li key={maker.id}><button type="button" disabled={createConversationMutation.isPending} onClick={() => createConversationMutation.mutate(maker.id)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-midnight-card/70 disabled:opacity-60"><Avatar src={maker.image} name={maker.name} online={maker.isOnline} size={36} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink">{displayName(maker)}</span><span className="mt-0.5 block truncate text-xs text-ink-muted">{maker.headline ?? (maker.handle ? `@${maker.handle}` : "")}</span></span><MessageCircle size={15} className="text-ink-muted" aria-hidden="true" /></button></li>)}</ul>
                ) : <p className="p-3 text-xs leading-relaxed text-ink-muted">{isFrench ? "Aucun maker trouvé." : "No makers found."}</p>}
                {createConversationMutation.isError && <p role="alert" className="p-3 text-xs text-rose-300">{isFrench ? "Impossible de démarrer cette conversation." : "Couldn't start this conversation."}</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 p-3">
                <label className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" /><input type="search" value={conversationFilter} onChange={(event) => setConversationFilter(event.target.value)} placeholder={isFrench ? "Rechercher" : "Search"} className="input !py-2 !pl-9 !text-xs" aria-label={isFrench ? "Rechercher les conversations" : "Search conversations"} /></label>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="conversation-time-filter" className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                      <CalendarDays size={14} className="text-gold-soft" aria-hidden="true" />{t("chat.period")}
                    </label>
                    <span aria-live="polite" className="rounded-full border border-midnight-border/70 bg-midnight-card px-2 py-0.5 text-[10px] font-medium tabular-nums text-ink-muted">
                      {filteredConversations.length}
                    </span>
                  </div>
                  <div ref={conversationTimeMenuRef} className="relative">
                    <button
                      ref={conversationTimeTriggerRef}
                      id="conversation-time-filter"
                      type="button"
                      aria-label={t("chat.filterByDate")}
                      aria-haspopup="menu"
                      aria-expanded={conversationTimeMenuOpen}
                      aria-controls="conversation-time-menu"
                      onClick={() => setConversationTimeMenuOpen((open) => !open)}
                      className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-midnight-border bg-midnight-deep/70 px-3 py-2 text-left text-xs font-medium text-ink transition hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
                    >
                      <span className="truncate">{selectedConversationTimeLabel}</span>
                      <ChevronDown size={13} className={`shrink-0 text-ink-muted transition-transform ${conversationTimeMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {conversationTimeMenuOpen && (
                      <div id="conversation-time-menu" role="menu" aria-label={t("chat.filterByDate")} className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-midnight-border bg-midnight-card p-1 shadow-xl">
                        {conversationTimeOptions.map((option) => {
                          const selected = conversationTimeFilter === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="menuitemradio"
                              aria-checked={selected}
                              onClick={() => { setConversationTimeFilter(option.value); setConversationTimeMenuOpen(false); }}
                              className={`flex min-h-10 w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-xs transition ${selected ? "bg-gold/10 font-semibold text-gold-soft" : "text-ink-muted hover:bg-midnight-deep hover:text-ink"}`}
                            >
                              <span>{option.label}</span>
                              {selected && <Check size={13} aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {conversationsQuery.isLoading ? <div className="space-y-2 p-2"><div className="skeleton h-16" /><div className="skeleton h-16" /></div> : conversationsQuery.isError ? <p className="p-3 text-xs text-ink-muted">{isFrench ? "Impossible de charger les conversations." : "Couldn't load conversations."}</p> : filteredConversations.length ? (
                  <ul className="space-y-1">{filteredConversations.map((conversation) => { const person = conversation.participants[0]; const selected = conversation.id === selectedId; return <li key={conversation.id}><button type="button" onClick={() => { setSelectedId(conversation.id); setComposeOpen(false); }} aria-current={selected ? "true" : undefined} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition ${selected ? "bg-gold/10 ring-1 ring-inset ring-gold/20" : "hover:bg-midnight-card/70"}`}><Avatar src={person?.image} name={person?.name} online={person?.isOnline} size={38} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-ink">{conversation.isGroup ? conversation.title : displayName(person)}</span>{conversation.lastMessage && <span className="shrink-0 text-[10px] text-ink-muted">{timeAgo(conversation.lastMessage.createdAt, locale)}</span>}</span><span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">{conversation.lastMessage ? renderConversationPreview(conversation.lastMessage, session?.user?.id, isFrench) : (isFrench ? "Commencez la conversation" : "Start the conversation")}</span></span></button></li>; })}</ul>
                ) : conversations.length ? <p className="p-3 text-xs text-ink-muted">{isFrench ? "Aucun résultat." : "No matches found."}</p> : <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center"><MessagesSquare size={25} className="text-gold-soft" aria-hidden="true" /><p className="mt-3 text-sm font-medium text-ink">{isFrench ? "Pas encore de conversation" : "No conversations yet"}</p><p className="mt-1 text-xs leading-relaxed text-ink-muted">{isFrench ? "Envoyez un message à un maker pour commencer." : "Message a maker to get started."}</p><button type="button" onClick={startCompose} className="mt-3 text-xs font-semibold text-gold-soft hover:text-gold-bright">{isFrench ? "Trouver un maker" : "Find a maker"}</button></div>}
              </div>
            </>
          )}
        </aside>

        <main className={`min-h-0 min-w-0 flex-col ${selectedId && !composeOpen ? "flex" : "hidden md:flex"}`}>
          {selectedId && !composeOpen ? (
            <>
              <header className="flex h-14 shrink-0 items-center gap-3 border-b border-midnight-border px-4">
                <button type="button" onClick={() => setSelectedId(null)} aria-label={isFrench ? "Retour aux conversations" : "Back to conversations"} className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-midnight-card md:hidden"><ArrowLeft size={17} aria-hidden="true" /></button>
                {participant ? <Link href={`/makers/${encodeURIComponent(participant.handle ?? participant.id)}`} className="group flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"><Avatar src={participant.image} name={participant.name} online={participant.isOnline} size={36} /><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-ink group-hover:text-gold-soft">{personName}</h2><p className="truncate text-xs text-ink-muted">{participant.isOnline ? (isFrench ? "En ligne" : "Online") : (participant.headline ?? (isFrench ? "Conversation privée" : "Private conversation"))}</p></div></Link> : <div className="min-w-0"><h2 className="text-sm font-semibold text-ink">{personName}</h2></div>}
              </header>
              <div ref={messageListRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-midnight-deep/20 px-4 py-5 sm:px-6">
                {conversationQuery.isLoading ? <div className="space-y-3"><div className="skeleton h-12 w-2/3" /><div className="skeleton ml-auto h-12 w-1/2" /></div> : conversationQuery.isError ? <p className="m-auto text-sm text-ink-muted">{isFrench ? "Impossible de charger les messages." : "Couldn't load messages."}</p> : thread?.messages.length ? (
                  <div className="space-y-5">
                    {messageDayGroups.map((group) => (
                      <div key={group.key} className="space-y-3">
                        <div role="separator" className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-midnight-border/70" /><span className="text-[10px] font-medium text-ink-muted">{group.label}</span><span className="h-px flex-1 bg-midnight-border/70" /></div>
                        {group.messages.map((message) => {
                          const mine = message.senderId === session?.user?.id;
                          const authorName = message.sender.name ?? "Maker";
                          const authorAvatar = (
                            <Link
                              href={`/makers/${encodeURIComponent(message.sender.id)}`}
                              aria-label={t("feed.viewProfile", { name: authorName })}
                              className="mt-1 shrink-0 rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                            >
                              <Avatar src={message.sender.image} name={authorName} size={30} />
                            </Link>
                          );
                          return (
                            <div key={message.id} className={`flex w-full items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                              {!mine && authorAvatar}
                              <div className={`flex min-w-0 max-w-[85%] flex-col gap-1.5 sm:max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
                                {mine && <span className="px-2 text-[10px] font-medium text-ink-muted">{isFrench ? "Vous" : "You"}</span>}
                                <div className={`w-fit max-w-full rounded-2xl px-3.5 py-2.5 ${mine ? "rounded-br-md bg-gold/15 text-ink" : "rounded-bl-md border border-midnight-border bg-midnight-card text-ink"}`}>
                                  {message.replyTo && <div className="mb-2 max-w-full border-l-2 border-gold/50 pl-2"><p className="text-[10px] font-medium text-gold-soft">{t("chat.replyTo", { name: message.replyTo.sender.name ?? "Maker" })}</p><p className="line-clamp-2 break-words text-xs text-ink-muted">{message.replyTo.content}</p></div>}
                                  {message.content && renderMessageContent(message.content, isFrench)}
                                  {message.attachments?.map((attachment) => {
                                    const attachmentUrl = `/api/conversations/${selectedId}/messages/${message.id}/attachments/${attachment.id}`;
                                    const isImage = attachment.mimeType.startsWith("image/");
                                    return (
                                      <div key={attachment.id} className="mt-2 min-w-0 overflow-hidden rounded-lg border border-midnight-border/70 bg-midnight-deep/40">
                                        {isImage && (
                                                                                    <img src={`${attachmentUrl}?inline=1`} alt={attachment.name} loading="lazy" className="max-h-72 w-full object-contain" />
                                        )}
                                        <a href={attachmentUrl} download={attachment.name} className="flex min-h-10 items-center gap-2 px-3 py-2 text-xs transition hover:bg-midnight-card/70">
                                          <FileText size={14} className="shrink-0 text-gold-soft" aria-hidden="true" />
                                          <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                                          <span className="shrink-0 text-[10px] text-ink-muted">{formatMessageFileSize(attachment.size)}</span>
                                        </a>
                                      </div>
                                    );
                                  })}
                                  <p className={`mt-1 text-right text-[10px] ${mine ? "text-gold-soft/80" : "text-ink-muted"}`}>{messageTime(message.createdAt, locale)}</p>
                                </div>
                                <div data-message-actions className={`relative flex ${mine ? "justify-end" : "justify-start"}`}>
                                  <button
                                    type="button"
                                    aria-label={isFrench ? "Options du message" : "Message options"}
                                    aria-expanded={openMessageMenuId === message.id}
                                    aria-controls={`message-actions-${message.id}`}
                                    onClick={() => {
                                      setOpenMessageMenuId((current) => current === message.id ? null : message.id);
                                      setOpenMessageReactionId(null);
                                    }}
                                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                                  >
                                    <MoreHorizontal size={17} aria-hidden="true" />
                                  </button>
                                  {openMessageMenuId === message.id && (
                                    <div id={`message-actions-${message.id}`} className={`absolute bottom-full z-30 mb-1 w-52 rounded-lg border border-midnight-border bg-midnight-card p-1.5 shadow-xl ${mine ? "right-0" : "left-0"}`}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReplyingTo(message);
                                          setOpenMessageMenuId(null);
                                          composerRef.current?.focus();
                                        }}
                                        className="flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-muted transition hover:bg-midnight-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                                      >
                                        <CornerDownRight size={15} aria-hidden="true" />{t("feed.reply")}
                                      </button>
                                      <button
                                        type="button"
                                        aria-expanded={openMessageReactionId === message.id}
                                        onClick={() => setOpenMessageReactionId((current) => current === message.id ? null : message.id)}
                                        className="flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-muted transition hover:bg-midnight-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                                      >
                                        <MessageCircle size={15} aria-hidden="true" />{t("chat.react")}
                                      </button>
                                      {openMessageReactionId === message.id && (
                                        <div role="group" aria-label={t("chat.chooseReaction")} className="grid grid-cols-3 gap-1 border-y border-midnight-border px-1 py-2">
                                          {POST_REACTIONS.map((reaction) => (
                                            <button
                                              key={reaction}
                                              type="button"
                                              title={t(`feed.reactions.${reaction}`)}
                                              aria-label={t(`feed.reactions.${reaction}`)}
                                              aria-pressed={message.reactionByMe === reaction}
                                              disabled={reactToMessageMutation.isPending}
                                              onClick={() => {
                                                if (selectedId) reactToMessageMutation.mutate({ conversationId: selectedId, messageId: message.id, reaction });
                                                setOpenMessageMenuId(null);
                                                setOpenMessageReactionId(null);
                                              }}
                                              className={`grid h-10 w-full place-items-center rounded-md transition hover:bg-midnight-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${message.reactionByMe === reaction ? "bg-midnight-deep ring-1 ring-gold/60" : ""}`}
                                            >
                                              <ReactionArtwork reaction={reaction} size={25} />
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          deleteMessageMutation.reset();
                                          setDeleteScope("me");
                                          setMessageToDelete(message);
                                          setOpenMessageMenuId(null);
                                        }}
                                        className="flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
                                      >
                                        <Trash2 size={15} aria-hidden="true" />{t("chat.deleteMessage")}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="m-auto max-w-xs text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold-soft"><MessageCircle size={20} aria-hidden="true" /></span><p className="mt-3 text-sm font-medium text-ink">{isFrench ? "Votre conversation commence ici" : "Your conversation starts here"}</p><p className="mt-1 text-xs text-ink-muted">{isFrench ? `Envoyez un premier message à ${personName}.` : `Send ${personName} a first message.`}</p></div>
                )}
              </div>
              <form onSubmit={submitMessage} className="shrink-0 border-t border-midnight-border p-3 sm:p-4">
                {replyingTo && <div className="mb-3 flex items-center gap-3 rounded-lg border-l-2 border-gold bg-midnight-card/70 px-3 py-2"><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-gold-soft">{t("chat.replyTo", { name: replyingTo.sender.name ?? "Maker" })}</p><p className="mt-0.5 truncate text-xs text-ink-muted">{replyingTo.content}</p></div><button type="button" onClick={() => setReplyingTo(null)} aria-label={t("chat.cancelReply")} title={t("chat.cancelReply")} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-midnight-deep hover:text-ink"><X size={14} aria-hidden="true" /></button></div>}
                {selectedFiles.length > 0 && (
                  <ul className="mb-3 space-y-1.5" aria-label={isFrench ? "Fichiers joints" : "Attached files"}>
                    {selectedFiles.map((file, index) => (
                      <li key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-2 rounded-md border border-midnight-border bg-midnight-card/60 px-2.5 py-1.5 text-xs">
                        <FileText size={13} className="shrink-0 text-gold-soft" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                        <span className="shrink-0 text-[10px] text-ink-muted">{formatMessageFileSize(file.size)}</span>
                        <button type="button" onClick={() => { setSelectedFiles((files) => files.filter((_, fileIndex) => fileIndex !== index)); setAttachmentError(null); }} aria-label={`${isFrench ? "Supprimer" : "Remove"} ${file.name}`} className="grid h-7 w-7 shrink-0 place-items-center rounded text-ink-muted hover:bg-midnight-deep hover:text-rose-300"><X size={13} aria-hidden="true" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                {attachmentError && <p role="alert" className="mb-2 px-1 text-xs text-rose-300">{attachmentError}</p>}
                {typingUsers.length > 0 && <p aria-live="polite" className="mb-2 flex items-center gap-2 px-1 text-xs text-ink-muted"><span className="flex items-center gap-1" aria-hidden="true"><span className="h-1 w-1 animate-pulse rounded-full bg-gold-soft" /><span className="h-1 w-1 animate-pulse rounded-full bg-gold-soft [animation-delay:150ms]" /><span className="h-1 w-1 animate-pulse rounded-full bg-gold-soft [animation-delay:300ms]" /></span>{typingLabel}</p>}
                {reactToMessageMutation.isError && <p role="alert" className="mb-2 px-1 text-xs text-rose-300">{t("chat.reactionError")}</p>}
                {sendMessageMutation.isError && <p role="alert" className="mb-2 px-1 text-xs text-rose-300">{t("chat.sendError")}</p>}
                <div className="flex items-end gap-2">
                  <input ref={attachmentInputRef} type="file" multiple accept=".avif,.gif,.jpeg,.jpg,.png,.webp,.c,.cc,.cpp,.cs,.css,.csv,.doc,.docx,.go,.h,.hpp,.html,.java,.js,.json,.jsx,.md,.pdf,.php,.ppt,.pptx,.py,.rb,.rs,.sh,.sql,.toml,.ts,.tsx,.txt,.xls,.xlsx,.xml,.yaml,.yml,.zip" onChange={onAttachmentChange} className="sr-only" aria-label={isFrench ? "Choisir des fichiers à joindre" : "Choose files to attach"} />
                  <button type="button" onClick={() => attachmentInputRef.current?.click()} disabled={sendMessageMutation.isPending || selectedFiles.length >= MAX_CHAT_ATTACHMENT_COUNT} title={isFrench ? "Joindre un fichier" : "Attach a file"} aria-label={isFrench ? "Joindre un fichier" : "Attach a file"} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-gold-soft disabled:opacity-50"><Paperclip size={17} aria-hidden="true" /></button>
                  <textarea ref={composerRef} value={draft} onChange={(event) => updateDraft(event.target.value)} onBlur={() => { if (selectedId) { lastTypingPingRef.current = 0; publishTypingStatus(selectedId, false); } }} onKeyDown={onComposerKeyDown} maxLength={5000} rows={1} placeholder={isFrench ? "Écrire un message…" : "Write a message…"} aria-label={isFrench ? "Écrire un message" : "Write a message"} className="input max-h-32 min-h-11 resize-y !py-3" />
                  <button type="submit" disabled={(!draft.trim() && selectedFiles.length === 0) || sendMessageMutation.isPending} aria-busy={sendMessageMutation.isPending} aria-label={isFrench ? "Envoyer le message" : "Send message"} title={isFrench ? "Envoyer" : "Send"} className="btn-gold !h-11 !w-11 shrink-0 !rounded-lg !p-0"><Send size={17} aria-hidden="true" /></button>
                </div>
                <p className="mt-1.5 px-1 text-[10px] text-ink-muted">{isFrench ? "Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne" : "Enter to send · Shift + Enter for a new line"}</p>
              </form>
            </>
          ) : (
            <div className="m-auto hidden max-w-sm px-6 text-center md:block"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/10 text-gold-soft"><MessagesSquare size={26} aria-hidden="true" /></span><h2 className="mt-4 text-base font-semibold text-ink">{isFrench ? "Votre espace de messages" : "Your message space"}</h2><p className="mt-2 text-sm leading-relaxed text-ink-muted">{isFrench ? "Choisissez une conversation ou démarrez un nouvel échange avec un maker." : "Choose a conversation or start a new one with a maker."}</p><button type="button" onClick={startCompose} className="btn-outline mt-4 !rounded-lg"><Plus size={16} aria-hidden="true" />{isFrench ? "Nouveau message" : "New message"}</button></div>
          )}
        </main>
      </section>

      <dialog
        ref={deleteDialogRef}
        aria-labelledby="delete-message-title"
        aria-describedby="delete-message-confirm"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (deleteMessageMutation.isPending) {
            event.preventDefault();
            return;
          }
          setMessageToDelete(null);
        }}
        onCancel={(event) => {
          if (deleteMessageMutation.isPending) {
            event.preventDefault();
            return;
          }
          setMessageToDelete(null);
        }}
        onClose={() => {
          if (messageToDelete) setMessageToDelete(null);
        }}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
          if (outside && !deleteMessageMutation.isPending) event.currentTarget.close();
        }}
        className={`m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md flex-col overflow-hidden rounded-xl border border-midnight-border bg-midnight-card p-0 text-ink shadow-2xl outline-none sm:max-h-[calc(100dvh-3rem)] [&::backdrop]:bg-black/70 [&::backdrop]:backdrop-blur-sm ${messageToDelete ? "flex" : "hidden"}`}
      >
        {messageToDelete && (
          <>
            <header className="shrink-0 border-b border-midnight-border px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-400/10 text-rose-300">
                  <Trash2 size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="delete-message-title" className="text-base font-semibold text-ink">{t("chat.deleteMessageTitle")}</h2>
                  <p id="delete-message-confirm" className="mt-1 text-sm leading-5 text-ink-muted">{t("chat.deleteMessageConfirm")}</p>
                </div>
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              {messageToDelete.content && (
                <div className="flex min-w-0 items-center gap-2 rounded-lg border border-midnight-border bg-midnight-deep/60 px-3 py-3 text-sm text-ink-muted">
                  {renderConversationPreview(messageToDelete, session?.user?.id, isFrench)}
                </div>
              )}
              <fieldset className="space-y-2">
                <legend className="sr-only">{t("chat.deleteMessageConfirm")}</legend>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-midnight-border p-3 transition hover:bg-midnight-deep/60 has-[:checked]:border-gold/60 has-[:checked]:bg-gold/5">
                  <input type="radio" name="delete-message-scope" value="me" checked={deleteScope === "me"} onChange={() => setDeleteScope("me")} className="mt-1 h-4 w-4 shrink-0 accent-gold" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{t("chat.deleteMessageForMe")}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{t("chat.deleteMessageForMeDescription")}</span>
                  </span>
                </label>
                {messageToDelete.senderId === session?.user?.id && (
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-midnight-border p-3 transition hover:bg-midnight-deep/60 has-[:checked]:border-rose-400/60 has-[:checked]:bg-rose-400/5">
                    <input type="radio" name="delete-message-scope" value="everyone" checked={deleteScope === "everyone"} onChange={() => setDeleteScope("everyone")} className="mt-1 h-4 w-4 shrink-0 accent-rose-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{t("chat.deleteMessageForEveryone")}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{t("chat.deleteMessageForEveryoneDescription")}</span>
                    </span>
                  </label>
                )}
              </fieldset>
              {deleteMessageMutation.isError && <p role="alert" className="text-sm text-rose-300">{t("chat.deleteMessageError")}</p>}
            </div>
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-midnight-border px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
              <button ref={deleteCancelButtonRef} type="button" disabled={deleteMessageMutation.isPending} onClick={() => setMessageToDelete(null)} className="btn-ghost min-h-11 w-full !rounded-lg !px-4 !py-2 text-sm sm:w-auto">{t("common.cancel")}</button>
              <button type="button" disabled={deleteMessageMutation.isPending} onClick={confirmDeleteMessage} className="btn min-h-11 w-full !rounded-lg !bg-rose-500 !px-4 !py-2 text-sm !text-white hover:!bg-rose-400 sm:w-auto">
                {deleteMessageMutation.isPending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
                {t("chat.deleteMessage")}
              </button>
            </footer>
          </>
        )}
      </dialog>
    </div>
  );
}
