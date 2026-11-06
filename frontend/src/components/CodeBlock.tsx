"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Code2, Copy } from "@/components/FontAwesomeIcons";
import { CopilotCodeEditor } from "@/components/CopilotCodeEditor";
import { CodeRenderer, inferCodeLanguage } from "@/components/CodeRenderer";

export function CodeBlock({
  code,
  language,
  isFrench,
  maxCollapsedLines = 12,
  expandLabel,
  collapseLabel,
  ariaLabel,
  editable = false,
  className = "",
}: {
  code: string;
  language: string;
  isFrench: boolean;
  maxCollapsedLines?: number;
  expandLabel?: string;
  collapseLabel?: string;
  ariaLabel?: string;
  editable?: boolean;
  className?: string;
}) {
  const displayLanguage = language.trim() || inferCodeLanguage(code) || "code";
  const [editedCode, setEditedCode] = useState(code);
  const lineCount = editedCode.split("\n").length;
  const [expanded, setExpanded] = useState(lineCount <= maxCollapsedLines);
  const editorHeight = `${Math.min(448, Math.max(160, lineCount * 22 + 16))}px`;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyResetTimerRef.current !== null) window.clearTimeout(copyResetTimerRef.current);
  }, []);

  useEffect(() => {
    setEditedCode(code);
  }, [code]);

  async function copyCode() {
    if (copyResetTimerRef.current !== null) window.clearTimeout(copyResetTimerRef.current);
    try {
      await navigator.clipboard.writeText(editedCode);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyState("idle");
      copyResetTimerRef.current = null;
    }, 1800);
  }

  const copyLabel = copyState === "copied"
    ? (isFrench ? "Code copié" : "Code copied")
    : copyState === "error"
      ? (isFrench ? "Copie impossible" : "Copy failed")
      : (isFrench ? "Copier le code" : "Copy code");
  const showMoreLabel = expandLabel ?? (isFrench ? "Déplier le code" : "Expand code");
  const showLessLabel = collapseLabel ?? (isFrench ? "Replier le code" : "Collapse code");
  const viewportClass = expanded ? "max-h-[28rem] overflow-auto" : "max-h-40 overflow-hidden";

  return (
    <section aria-label={ariaLabel ?? (isFrench ? "Bloc de code" : "Code block")} className={`min-w-0 max-w-full overflow-hidden rounded-lg border border-midnight-border bg-[#0b1020] shadow-inner ${className}`}>
      <header className="flex min-h-10 items-center justify-between gap-2 border-b border-midnight-border bg-midnight-card/80 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-rose-400/80" />
            <span className="h-2 w-2 rounded-full bg-amber-300/80" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          </span>
          <Code2 size={13} className="shrink-0 text-gold-soft" aria-hidden="true" />
          <span className="truncate text-[10px] font-semibold uppercase text-ink-muted">{displayLanguage}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-ink-muted/70">{lineCount} {isFrench ? "lignes" : "lines"}</span>
          {editable && <span className="hidden rounded-full bg-gold/10 px-2 py-0.5 text-[9px] font-medium text-gold-soft sm:inline">{isFrench ? "Éditeur" : "Editor"}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={copyCode} title={copyLabel} aria-label={copyLabel} className="grid h-7 w-7 place-items-center rounded text-ink-muted transition hover:bg-midnight-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50">
            {copyState === "copied" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          </button>
          {lineCount > maxCollapsedLines && (
            <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={expanded ? showLessLabel : showMoreLabel} title={expanded ? showLessLabel : showMoreLabel} className="inline-flex h-7 items-center gap-1 rounded px-2 text-[10px] font-medium text-ink-muted transition hover:bg-midnight-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50">
              <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              <span>{expanded ? showLessLabel : showMoreLabel}</span>
            </button>
          )}
        </div>
        <span className="sr-only" aria-live="polite">{copyState === "idle" ? "" : copyLabel}</span>
      </header>
      <div className={viewportClass}>
        {editable ? (
          <CopilotCodeEditor
            value={editedCode}
            language={displayLanguage}
            onChange={setEditedCode}
            height={expanded ? editorHeight : "10rem"}
            ariaLabel={isFrench ? `Éditeur de code ${displayLanguage}` : `${displayLanguage} code editor`}
          />
        ) : (
          <CodeRenderer code={expanded ? editedCode : editedCode.split("\n").slice(0, maxCollapsedLines).join("\n")} language={language || displayLanguage} />
        )}
      </div>
    </section>
  );
}