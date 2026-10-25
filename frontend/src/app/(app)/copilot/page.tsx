"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp,
  Check,
  Clock3,
  Copy,
  FileUp,
  LoaderCircle,
  Menu,
  Moon,
  Plus,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CodeBlock } from "@/components/CodeBlock";
import { publishLynoAIQuota, type LynoAIQuota } from "@/lib/lynoai-quota";
import { useTranslation } from "@/lib/i18n";
import { useSession } from "next-auth/react";
import { readAppearancePreferences, saveAppearancePreferences } from "@/lib/appearance";

type ProposedAction = {
  action: "create_project" | "publish_post";
  payload: Record<string, unknown>;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal?: ProposedAction | null;
  feedback?: "up" | "down";
};

type SavedSession = {
  id: string;
  input: string;
  output: string;
  conversationId: string | null;
  createdAt: string;
};

type Attachment = { name: string; content: string };

const suggestions = {
  fr: [
    { title: "Définir mon idée", prompt: "Aide-moi à clarifier mon idée de produit et à identifier le problème qu’elle résout." },
    { title: "Écrire un pitch", prompt: "Aide-moi à écrire un pitch clair et convaincant pour mon projet." },
    { title: "Trouver des co-builders", prompt: "Comment trouver et choisir les bons co-builders pour mon projet ?" },
  ],
  en: [
    { title: "Shape my idea", prompt: "Help me clarify my product idea and identify the problem it solves." },
    { title: "Write a pitch", prompt: "Help me write a clear and compelling pitch for my project." },
    { title: "Find co-builders", prompt: "How can I find and choose the right co-builders for my project?" },
  ],
};

const attachmentTypes = new Set([
  "text/plain", "text/markdown", "text/csv", "application/json", "text/javascript",
  "application/typescript", "text/x-python", "text/html", "text/css", "application/xml",
]);
const attachmentExtensions = /\.(txt|md|csv|json|js|ts|tsx|jsx|py|html|css|sql|xml|ya?ml|log|sh)$/i;

function MarkdownPre({ children, isFrench, isLightTheme }: { children?: ReactNode; isFrench: boolean; isLightTheme: boolean }) {
  if (isValidElement<{ children?: ReactNode; className?: string }>(children)) {
    const codeElement = children as ReactElement<{ children?: ReactNode; className?: string }>;
    const code = String(codeElement.props.children ?? "").replace(/\n$/, "");
    const language = codeElement.props.className?.match(/language-([\w+-]+)/)?.[1] ?? "";
    return <CodeBlock code={code} language={language} isFrench={isFrench} maxCollapsedLines={14} className="my-4" />;
  }
  return <pre className={`my-4 overflow-x-auto rounded-xl border border-midnight-border p-4 text-sm ${isLightTheme ? "bg-white text-slate-800" : "bg-[#0b1020] text-ink"}`}>{children}</pre>;
}

function AssistantAnswer({ content, isFrench, isLightTheme }: { content: string; isFrench: boolean; isLightTheme: boolean }) {
  return (
    <div className="copilot-answer min-w-0 text-[15px] leading-7 text-ink/95 [&_a]:text-gold-soft [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-gold/50 [&_blockquote]:pl-4 [&_blockquote]:text-ink-muted [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:my-3">
      <ReactMarkdown
        components={{
          pre: ({ children }) => <MarkdownPre isFrench={isFrench} isLightTheme={isLightTheme}>{children}</MarkdownPre>,
          code: ({ children, className }) => className
            ? <code className={className}>{children}</code>
            : <code className="rounded bg-midnight-card px-1.5 py-0.5 font-mono text-[0.88em] text-gold-soft">{children}</code>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function CopilotPage() {
  const { locale, setLocale } = useTranslation();
  const { data: session } = useSession();
  const isFrench = locale === "fr";
  const [isLightTheme, setIsLightTheme] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsLightTheme(root.dataset.theme === "light");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function toggleTheme() {
    const current = readAppearancePreferences();
    saveAppearancePreferences({ ...current, theme: isLightTheme ? "dark" : "light" });
  }

  const conversations = useMemo(() => {
    const grouped = new Map<string, SavedSession[]>();
    for (const item of savedSessions) {
      const key = item.conversationId ?? item.id;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return [...grouped.entries()].map(([id, items]) => ({
      id,
      sessions: items,
      title: items[0]?.input.slice(0, 54) || (isFrench ? "Nouvelle conversation" : "New conversation"),
      createdAt: items.at(-1)?.createdAt ?? "",
    })).reverse();
  }, [isFrench, savedSessions]);

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/sessions")
      .then(async (response) => {
        const result = await response.json() as { error?: string; sessions?: SavedSession[] };
        if (!response.ok) throw new Error(result.error ?? `HTTP_${response.status}`);
        if (!Array.isArray(result.sessions)) throw new Error("INVALID_RESPONSE");
        if (active) setSavedSessions(result.sessions);
      })
      .catch(() => {
        if (active) setHistoryError(isFrench
          ? "L’historique des conversations n’a pas pu être chargé."
          : "Conversation history could not be loaded.");
      });
    return () => { active = false; };
  }, [isFrench]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();
    if ((!message && attachments.length === 0) || pending) return;
    const history = messages;
    const currentAttachments = attachments;
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: "user",
      content: [message, ...currentAttachments.map(({ name }) => `📎 ${name}`)].filter(Boolean).join("\n"),
    }]);
    setInput("");
    setAttachments([]);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          attachments: currentAttachments,
          conversationId,
          locale,
          context: history.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 2000) })),
        }),
      });
      const result = await response.json() as { error?: string; session?: SavedSession & { output?: string }; proposal?: ProposedAction | null; quota?: LynoAIQuota };
      if (result.quota) publishLynoAIQuota(result.quota);
      if (!response.ok) throw new Error(result.error ?? `HTTP_${response.status}`);
      const assistantReply = result.session?.output;
      if (typeof assistantReply !== "string") throw new Error("INVALID_RESPONSE");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantReply,
        proposal: result.proposal,
      }]);
      if (result.session) setSavedSessions((current) => [...current, result.session!].slice(-200));
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setError(code === "AI_NOT_CONFIGURED"
        ? (isFrench ? "Le service LynoAI n’est pas configuré." : "LynoAI is not configured.")
        : code === "AI_PROVIDER_UNAVAILABLE"
          ? (isFrench ? "LynoAI ne répond pas pour le moment. Réessayez." : "LynoAI is temporarily unavailable. Please try again.")
          : code === "UNAUTHORIZED"
            ? (isFrench ? "Votre session a expiré. Reconnectez-vous." : "Your session expired. Please sign in again.")
            : code === "LYNOAI_QUOTA_EXCEEDED"
              ? (isFrench ? "Votre quota mensuel est atteint. Il sera réinitialisé au prochain cycle." : "Your monthly quota is exhausted. It will reset at the next cycle.")
            : (isFrench ? "Impossible d’envoyer le message. Réessayez." : "Could not send your message. Please try again."));
      setInput(message);
      setAttachments(currentAttachments);
    } finally {
      setPending(false);
    }
  }

  async function confirmAction(messageId: string, proposal: ProposedAction) {
    setError("");
    try {
      const response = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...proposal, conversationId, locale }),
      });
      const result = await response.json() as { error?: string; summary?: string };
      if (!response.ok) throw new Error(result.error ?? `HTTP_${response.status}`);
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, content: result.summary ?? message.content, proposal: null }
        : message));
    } catch {
      setError(isFrench
        ? "L’action n’a pas pu être exécutée. Vérifiez les informations et réessayez."
        : "The action could not be completed. Check the details and try again.");
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = [...attachments];
    for (const file of Array.from(files)) {
      if (!attachmentTypes.has(file.type) && !attachmentExtensions.test(file.name)) {
        setError(isFrench ? `${file.name} n’est pas un fichier texte pris en charge.` : `${file.name} is not a supported text file.`);
        continue;
      }
      if (file.size > 32 * 1024 || next.length >= 5 || next.reduce((size, item) => size + new TextEncoder().encode(item.content).byteLength, 0) + file.size > 80 * 1024) {
        setError(isFrench ? "Limite de pièces jointes : 5 fichiers, 32 Ko chacun et 80 Ko au total." : "Attachment limit: 5 files, 32 KB each and 80 KB total.");
        continue;
      }
      next.push({ name: file.name, content: await file.text() });
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function newConversation() {
    setMessages([]);
    setInput("");
    setAttachments([]);
    setError("");
    setConversationId(crypto.randomUUID());
    setMobileHistoryOpen(false);
    textareaRef.current?.focus();
  }

  function openConversation(id: string, items: SavedSession[]) {
    setConversationId(id);
    setMessages(items.flatMap((item) => [
      { id: `${item.id}-user`, role: "user" as const, content: item.input },
      { id: `${item.id}-assistant`, role: "assistant" as const, content: item.output },
    ]));
    setInput("");
    setAttachments([]);
    setError("");
    setMobileHistoryOpen(false);
  }

  async function deleteConversation(id: string) {
    const response = await fetch(`/api/ai/sessions?conversationId=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      setHistoryError(isFrench ? "Impossible de supprimer cette conversation." : "Could not delete this conversation.");
      return;
    }
    setSavedSessions((current) => current.filter((item) => (item.conversationId ?? item.id) !== id));
    if (conversationId === id) newConversation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  async function copyAnswer(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessage(id);
      window.setTimeout(() => setCopiedMessage(""), 1800);
    } catch {
      setError(isFrench ? "Impossible de copier cette réponse." : "Could not copy this response.");
    }
  }

  const dateLabel = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));

  return (
    <main className="copilot-layout fixed inset-0 flex min-h-0 overflow-hidden bg-midnight-deep text-ink">
      {mobileHistoryOpen && <button type="button" aria-label={isFrench ? "Fermer le menu" : "Close menu"} onClick={() => setMobileHistoryOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(19rem,86vw)] flex-col border-r border-midnight-border bg-midnight-deep transition-transform md:static md:z-auto md:w-[17rem] md:translate-x-0 ${mobileHistoryOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-midnight-border px-4">
          <Link href="/copilot" aria-label="LynoAI" className="flex min-w-0 items-center gap-2.5">
            <Image src="/logo_assistant_ia.svg" alt="" width={38} height={38} priority className="h-9 w-9 shrink-0 object-contain" />
            <span className="truncate font-display text-xl font-semibold tracking-tight text-ink">Lyno<span className="text-gold-soft">AI</span></span>
          </Link>
          <button type="button" onClick={() => setMobileHistoryOpen(false)} aria-label={isFrench ? "Fermer" : "Close"} className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-midnight-card md:hidden"><X size={18} /></button>
        </div>
        <div className="p-3">
          <button type="button" onClick={newConversation} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-midnight-border px-3 text-sm font-medium text-ink transition hover:border-gold/40 hover:bg-midnight-card">
            <Plus size={17} className="text-gold-soft" aria-hidden="true" />
            {isFrench ? "Nouvelle conversation" : "New conversation"}
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
          <div className="flex items-center gap-2 px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-muted">
            <Clock3 size={13} aria-hidden="true" />
            {isFrench ? "Récents" : "Recent"}
          </div>
          {historyError && <p role="alert" className="px-2 py-2 text-xs text-rose-200">{historyError}</p>}
          <nav aria-label={isFrench ? "Historique des conversations" : "Conversation history"} className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {conversations.map((conversation) => (
              <div key={conversation.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1 ${conversation.id === conversationId ? "bg-midnight-card text-ink" : "text-ink-muted hover:bg-midnight-card/70 hover:text-ink"}`}>
                <button type="button" onClick={() => openConversation(conversation.id, conversation.sessions)} className="min-w-0 flex-1 py-1.5 text-left text-sm">
                  <span className="block truncate">{conversation.title}</span>
                  <span className="mt-0.5 block text-[10px] opacity-60">{conversation.createdAt ? dateLabel(conversation.createdAt) : ""}</span>
                </button>
                <button type="button" onClick={() => void deleteConversation(conversation.id)} aria-label={`${isFrench ? "Supprimer" : "Delete"} ${conversation.title}`} title={isFrench ? "Supprimer" : "Delete"} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-muted opacity-100 transition hover:bg-rose-400/10 hover:text-rose-300 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            {!conversations.length && !historyError && <p className="px-2 py-2 text-xs leading-5 text-ink-muted">{isFrench ? "Vos conversations s’afficheront ici." : "Your conversations will appear here."}</p>}
          </nav>
        </div>
        <Link href="/dashboard" className="flex shrink-0 items-center gap-3 border-t border-midnight-border px-4 py-3 transition hover:bg-midnight-card/70">
          <Avatar src={session?.user?.image} name={session?.user?.name} size={34} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{session?.user?.name ?? (isFrench ? "Votre compte" : "Your account")}</span>
            <span className="block truncate text-xs text-ink-muted">{isFrench ? "Retour au tableau de bord" : "Back to dashboard"}</span>
          </span>
        </Link>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-midnight-border/80 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setMobileHistoryOpen(true)} aria-label={isFrench ? "Ouvrir l’historique" : "Open history"} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-ink md:hidden">
              <Menu size={19} aria-hidden="true" />
            </button>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft"><Sparkles size={17} aria-hidden="true" /></div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-ink">{isFrench ? "LynoAI · Assistant LynoraLink" : "LynoAI · LynoraLink Assistant"}</h1>
              <p className="truncate text-[11px] text-ink-muted">{isFrench ? "Votre partenaire de co-building" : "Your co-building partner"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/copilot/usage?platform=lynoralink"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition sm:px-3 ${isLightTheme ? "border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-300 hover:bg-violet-100" : "border-violet-400/25 bg-violet-400/[0.07] text-violet-200 hover:border-violet-300/40 hover:bg-violet-400/[0.12]"}`}
            >
              <Sparkles size={14} aria-hidden="true" />
              <span className="hidden sm:inline">{isFrench ? "Suivi d’usage" : "Usage analytics"}</span>
              <span className="sm:hidden">{isFrench ? "Usage" : "Usage"}</span>
            </Link>
            <span className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[11px] text-emerald-200 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {isFrench ? "Prêt à vous aider" : "Ready to help"}
            </span>
            <div className="flex h-9 items-center rounded-lg border border-midnight-border bg-midnight-card/60 p-0.5" role="group" aria-label={isFrench ? "Langue" : "Language"}>
              {(["fr", "en"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLocale(option)}
                  aria-pressed={locale === option}
                  className={`h-8 min-w-9 rounded-md px-2 text-[11px] font-semibold uppercase transition ${locale === option ? "bg-gold/15 text-gold-soft shadow-sm" : "text-ink-muted hover:text-ink"}`}
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isLightTheme ? (isFrench ? "Activer le thème sombre" : "Switch to dark theme") : (isFrench ? "Activer le thème clair" : "Switch to light theme")}
              title={isLightTheme ? (isFrench ? "Thème sombre" : "Dark theme") : (isFrench ? "Thème clair" : "Light theme")}
              className="grid h-9 w-9 place-items-center rounded-lg border border-midnight-border bg-midnight-card/60 text-ink-muted transition hover:bg-midnight-card hover:text-ink"
            >
              {isLightTheme ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={messagesContainerRef} className="copilot-scroll-area min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center px-5 py-10 sm:px-8">
                <div className="mb-6 grid h-16 w-16 place-items-center rounded-[22px] border border-gold/25 bg-gradient-to-br from-gold/15 to-emerald-400/5 text-gold-soft shadow-[0_12px_60px_rgba(8,111,88,0.16)]">
                  <Sparkles size={28} aria-hidden="true" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-soft">LynoraLink</p>
                <h2 className="mt-3 text-center font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  {isFrench ? "Construisons la suite ensemble." : "Let’s build what’s next."}
                </h2>
                <p className="mt-3 max-w-xl text-center text-sm leading-6 text-ink-muted sm:text-base">
                  {isFrench ? "Posez vos questions, développez votre idée et faites avancer votre projet avec LynoAI." : "Ask questions, develop your idea, and move your project forward with LynoAI."}
                </p>
                <div className="mt-9 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
                  {suggestions[locale].map((suggestion) => (
                    <button key={suggestion.title} type="button" onClick={() => void sendMessage(suggestion.prompt)} className="group min-h-24 rounded-2xl border border-midnight-border bg-midnight-deep/50 p-4 text-left transition hover:-translate-y-0.5 hover:border-gold/40 hover:bg-midnight-card/70">
                      <span className="flex items-center justify-between gap-2 text-sm font-medium text-ink">{suggestion.title}<ArrowUp size={14} className="rotate-45 text-ink-muted transition group-hover:text-gold-soft" /></span>
                      <span className="mt-2 block text-xs leading-5 text-ink-muted">{suggestion.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-7 sm:px-8 sm:py-10">
                {messages.map((message) => message.role === "user" ? (
                  <article key={message.id} className="flex justify-end gap-3">
                    <div className="max-w-[88%] rounded-2xl rounded-br-md border border-gold/20 bg-gold/10 px-4 py-3 text-sm leading-6 text-ink sm:max-w-[78%]">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <Avatar src={session?.user?.image} name={session?.user?.name} size={32} />
                  </article>
                ) : (
                  <article key={message.id} className="flex items-start gap-3 sm:gap-4">
                    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 p-1.5"><Image src="/logo_assistant_ia.svg" alt="" width={24} height={24} className="h-full w-full object-contain" aria-hidden="true" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink">{isFrench ? "LynoAI" : "LynoAI"}</span>
                        <span className="text-[10px] text-ink-muted">{isFrench ? "Assistant LynoraLink" : "LynoraLink assistant"}</span>
                      </div>
                      <AssistantAnswer content={message.content} isFrench={isFrench} isLightTheme={isLightTheme} />
                      {message.proposal && (
                        <div className="mt-4 rounded-xl border border-gold/25 bg-gold/5 p-4">
                          <p className="text-sm font-medium text-ink">
                            {isFrench ? "Action proposée" : "Proposed action"}: {message.proposal.action === "create_project"
                              ? (isFrench ? "Créer un projet" : "Create a project")
                              : (isFrench ? "Publier une publication" : "Publish a post")}
                          </p>
                          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-midnight-deep/70 p-3 text-xs text-ink-muted">{JSON.stringify(message.proposal.payload, null, 2)}</pre>
                          <button type="button" onClick={() => void confirmAction(message.id, message.proposal!)} className="btn-gold mt-3 px-4 py-2 text-sm">
                            {isFrench ? "Confirmer l’action" : "Confirm action"}
                          </button>
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-1 text-ink-muted">
                        <button type="button" onClick={() => void copyAnswer(message.id, message.content)} aria-label={copiedMessage === message.id ? (isFrench ? "Réponse copiée" : "Answer copied") : (isFrench ? "Copier la réponse" : "Copy answer")} title={copiedMessage === message.id ? (isFrench ? "Copié" : "Copied") : (isFrench ? "Copier" : "Copy")} className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-midnight-card hover:text-ink">{copiedMessage === message.id ? <Check size={14} /> : <Copy size={14} />}</button>
                        <button type="button" onClick={() => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, feedback: item.feedback === "up" ? undefined : "up" } : item))} aria-label={isFrench ? "Réponse utile" : "Helpful answer"} aria-pressed={message.feedback === "up"} className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-midnight-card hover:text-ink ${message.feedback === "up" ? "text-emerald-300" : ""}`}><ThumbsUp size={14} /></button>
                        <button type="button" onClick={() => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, feedback: item.feedback === "down" ? undefined : "down" } : item))} aria-label={isFrench ? "Réponse à améliorer" : "Unhelpful answer"} aria-pressed={message.feedback === "down"} className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-midnight-card hover:text-ink ${message.feedback === "down" ? "text-rose-300" : ""}`}><ThumbsDown size={14} /></button>
                      </div>
                    </div>
                  </article>
                ))}
                {pending && (
                  <div className="flex items-start gap-3 sm:gap-4" role="status" aria-live="polite">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 p-1.5"><Image src="/logo_assistant_ia.svg" alt="" width={24} height={24} className="h-full w-full object-contain" aria-hidden="true" /></div>
                    <div className="flex items-center gap-2 pt-1 text-sm text-ink-muted"><LoaderCircle size={15} className="animate-spin" />{isFrench ? "LynoAI prépare une réponse…" : "LynoAI is preparing a response…"}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 bg-midnight-deep/95 px-3 pb-3 pt-3 sm:px-6 sm:pb-5">
            <div className="mx-auto max-w-4xl">
              {error && <p role="alert" className="mb-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((file) => <span key={file.name} className="inline-flex items-center gap-2 rounded-lg border border-midnight-border bg-midnight-card px-2.5 py-1.5 text-xs text-ink-muted">{file.name}<button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.name !== file.name))} aria-label={`${isFrench ? "Retirer" : "Remove"} ${file.name}`}><X size={13} /></button></span>)}
                </div>
              )}
              <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void sendMessage(input); }} className="rounded-2xl border border-midnight-border bg-midnight-card shadow-[0_12px_36px_rgba(0,0,0,0.12)] transition focus-within:border-gold/40">
                <label htmlFor="copilot-message" className="sr-only">{isFrench ? "Votre message à LynoAI" : "Your message to LynoAI"}</label>
                <textarea
                  ref={textareaRef}
                  id="copilot-message"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={4000}
                  rows={2}
                  placeholder={isFrench ? "Écrivez votre message à LynoAI…" : "Message LynoAI…"}
                  className="max-h-40 min-h-[58px] w-full resize-y bg-transparent px-4 pt-4 text-sm leading-6 text-ink outline-none placeholder:text-ink-muted sm:px-5"
                  disabled={pending}
                />
                <div className="flex items-center justify-between gap-2 px-2 pb-2 sm:px-3">
                  <div className="flex items-center gap-1">
                    <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.sql,.xml,.yaml,.yml,.log,.sh,text/plain,text/markdown,text/csv,application/json" onChange={(event) => void addFiles(event.target.files)} className="sr-only" aria-label={isFrench ? "Joindre des fichiers texte" : "Attach text files"} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={pending} aria-label={isFrench ? "Joindre un fichier" : "Attach a file"} title={isFrench ? "Joindre un fichier texte" : "Attach a text file"} className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-ink disabled:opacity-40"><FileUp size={17} /></button>
                    <span className="hidden text-[11px] text-ink-muted sm:inline">{isFrench ? "LynoAI peut faire des erreurs. Vérifiez les informations importantes." : "LynoAI can make mistakes. Check important information."}</span>
                  </div>
                  <button type="submit" disabled={pending || (!input.trim() && attachments.length === 0)} aria-label={isFrench ? "Envoyer le message" : "Send message"} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold text-[#08121e] transition hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-40">
                    {pending ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}
                  </button>
                </div>
              </form>
              <p className="mt-2 text-center text-[10px] text-ink-muted">{isFrench ? "Entrée pour envoyer · Maj + Entrée pour un saut de ligne" : "Enter to send · Shift + Enter for a new line"}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
