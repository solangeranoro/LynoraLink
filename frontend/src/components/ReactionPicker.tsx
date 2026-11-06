"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ThumbsUp } from "@/components/FontAwesomeIcons";
import { cn } from "@/lib/utils";

export const POST_REACTIONS = ["like", "love", "celebrate", "support", "laugh", "insightful"] as const;
export type ReactionType = (typeof POST_REACTIONS)[number];

const reactionColors: Record<ReactionType, { background: string; foreground: string }> = {
  like: { background: "#dceeff", foreground: "#2878c7" },
  love: { background: "#ffe3e8", foreground: "#e34f70" },
  celebrate: { background: "#fff0c2", foreground: "#c78112" },
  support: { background: "#dff5e9", foreground: "#26865b" },
  laugh: { background: "#fff1c9", foreground: "#b87912" },
  insightful: { background: "#e5e8ff", foreground: "#5f69ba" },
};

export function ReactionArtwork({ reaction, size = 30 }: { reaction: ReactionType; size?: number }) {
  const colors = reactionColors[reaction];
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="18" cy="18" r="17" fill={colors.background} />
      {reaction === "like" && <path d="M12.5 17.2 17 10c.7-1.1 2.4-.5 2.3.8l-.4 4.2h5.2c1.7 0 2.8 1.7 2.1 3.2l-3.2 7a2.6 2.6 0 0 1-2.4 1.5h-8.1V17.2Zm-4.1-.8h3.1v10.3H8.4z" fill={colors.foreground} />}
      {reaction === "love" && <path d="M18 27.3 8.8 18a6 6 0 0 1 8.5-8.5l.7.8.7-.8a6 6 0 0 1 8.5 8.5L18 27.3Z" fill={colors.foreground} />}
      {reaction === "celebrate" && <>
        <path d="m13 12 4.5-8 5.2 8" fill="#e96a83" stroke="#a83c57" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="17.5" cy="4.3" r="1.6" fill="#fff0c2" stroke="#c78112" strokeWidth="1" />
        <path d="M12.1 12c-3 3.1-3 8.2.1 11.5 1.6 1.8 3.7 2.7 5.8 2.7s4.2-.9 5.8-2.7c3.1-3.3 3.1-8.4.1-11.5Z" fill="#ffd75e" stroke="#c78112" strokeWidth="1.3" />
        <path d="m14.1 17.3 1.4 1.1 1.1-1.7m2.6.1c.9-1.1 1.9-1.1 2.8 0" stroke="#563c33" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.9 21c.7 2.3 2 3.5 3.6 3.5s2.9-1.2 3.6-3.5c-2.4.7-4.8.7-7.2 0Z" fill="#563c33" />
        <path d="M7 14 5.5 12m24 2 1.5-2M9 7 7.5 5.5m19 1.5L28 5.5" stroke={colors.foreground} strokeWidth="1.6" strokeLinecap="round" />
      </>}
      {reaction === "support" && <>
        <path d="m18 21.8-4.5-4.2a3.2 3.2 0 0 1 4.5-4.5l.5.6.5-.6a3.2 3.2 0 0 1 4.5 4.5L18 21.8Z" fill={colors.foreground} />
        <path d="M7 23.3c2.3-1.4 4.4-.8 6.3.6l2.1 1.5h5l3-2.5c1-.8 2.2-.7 3 .1L21 28h-7.3l-5.6-3c-1-.6-1.4-1.2-1.1-1.7Z" fill={colors.background} stroke={colors.foreground} strokeWidth="1.7" strokeLinejoin="round" />
      </>}
      {reaction === "laugh" && <>
        <path d="M10.5 15.2c1.2-1.5 2.7-1.5 4 0m7 0c1.2-1.5 2.7-1.5 4 0" stroke={colors.foreground} strokeWidth="2" strokeLinecap="round" />
        <path d="M10.2 18.8c.4 5 3.1 7.8 7.8 7.8s7.4-2.8 7.8-7.8H10.2Z" fill={colors.foreground} />
        <path d="M13.3 20.7h9.4" stroke={colors.background} strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17 24.6c.5-.7 1.5-.7 2 0" stroke={colors.background} strokeWidth="1.4" strokeLinecap="round" />
      </>}
      {reaction === "insightful" && <>
        <path d="M12 15a6 6 0 1 1 12 0c0 2.2-1.2 3.6-2.3 4.9-.7.8-1.2 1.5-1.2 2.6h-5c0-1.1-.5-1.8-1.2-2.6C13.2 18.6 12 17.2 12 15Z" fill="#ffd75e" stroke="#c78112" strokeWidth="1.5" />
        <path d="M16 24.5h4m-3.3 2h2.6m-1.3-15.1v4.8m-2-1.8 2 1.8 2-1.8" stroke="#8b5b17" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 6V4m-7 5-1.5-1.5M25 9l1.5-1.5" stroke={colors.foreground} strokeWidth="1.7" strokeLinecap="round" />
      </>}
    </svg>
  );
}

export function ReactionPicker({
  selected,
  count,
  reactionCounts,
  labels,
  buttonLabel,
  pickerLabel,
  onSelect,
  disabled = false,
  align = "left",
  showBreakdown = true,
}: {
  selected: ReactionType | null;
  count: number;
  reactionCounts?: Partial<Record<ReactionType, number>>;
  labels: Record<ReactionType, string>;
  buttonLabel: string;
  pickerLabel: string;
  onSelect: (reaction: ReactionType) => void;
  disabled?: boolean;
  align?: "left" | "right";
  showBreakdown?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primaryReaction = selected ?? "like";
  const displayedCount = showBreakdown
    ? reactionCounts?.[primaryReaction] ?? (reactionCounts ? 0 : count)
    : count;

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, 250);
  }

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      className="relative inline-flex shrink-0 items-center gap-1"
      ref={rootRef}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          clearCloseTimer();
          setOpen(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") scheduleClose();
      }}
    >
      {open && (
        <div
          role="group"
          aria-label={buttonLabel}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") clearCloseTimer();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") scheduleClose();
          }}
          className={cn("absolute bottom-11 z-30 flex items-center gap-1 rounded-xl border border-midnight-border bg-midnight-card p-1.5 shadow-xl", align === "right" ? "right-0" : "left-0")}
        >
          {POST_REACTIONS.map((reaction) => (
            <button
              key={reaction}
              type="button"
              title={labels[reaction]}
              aria-label={labels[reaction]}
              aria-pressed={selected === reaction}
              disabled={disabled}
              onClick={() => {
                clearCloseTimer();
                onSelect(reaction);
                setOpen(false);
              }}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-lg transition hover:scale-110 hover:bg-midnight-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                selected === reaction && "bg-midnight-deep ring-1 ring-gold/60",
              )}
            >
              <ReactionArtwork reaction={reaction} />
            </button>
          ))}
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          clearCloseTimer();
          setOpen(false);
          onSelect("like");
        }}
        className={cn("btn-ghost !transition-none !px-2 !py-2 sm:!px-3", selected && "!border-gold/60 !bg-gold/20 !text-gold-soft")}
        aria-label={`${selected ? labels[selected] : buttonLabel}${displayedCount > 0 ? ` ${displayedCount}` : ""}`}
        aria-pressed={selected !== null}
      >
        {selected ? <ReactionArtwork reaction={selected} size={20} /> : <ThumbsUp className="h-4 w-4 text-ink-muted" aria-hidden="true" />}
        {displayedCount > 0 ? displayedCount : <span className="hidden sm:inline">{buttonLabel}</span>}
      </button>
      {showBreakdown && POST_REACTIONS.filter((reaction) => reaction !== primaryReaction && (reactionCounts?.[reaction] ?? 0) > 0).map((reaction) => {
        const reactionCount = reactionCounts?.[reaction] ?? 0;
        return (
          <span
            key={reaction}
            role="img"
            title={`${labels[reaction]}: ${reactionCount}`}
            aria-label={`${labels[reaction]}: ${reactionCount}`}
            className="inline-flex items-center gap-0.5 rounded-md border border-midnight-border/70 bg-midnight-deep/60 px-1 py-0.5 text-[10px] tabular-nums text-ink-muted"
          >
            <ReactionArtwork reaction={reaction} size={16} />
            {reactionCount}
          </span>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        title={pickerLabel}
        onClick={() => {
          clearCloseTimer();
          setOpen(true);
        }}
        className="btn-ghost shrink-0 !px-1.5 !py-2"
        aria-label={pickerLabel}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}