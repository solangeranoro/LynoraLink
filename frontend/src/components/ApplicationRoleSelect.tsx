"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type RoleOption = { value: string; label: string };

type ApplicationRoleSelectProps = {
  id: string;
  label: string;
  value: string;
  options: RoleOption[];
  onChange: (value: string) => void;
};

export function ApplicationRoleSelect({ id, label, value, options, onChange }: ApplicationRoleSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, options.findIndex((option) => option.value === value)));
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOption = options.find((option) => option.value === value);

  function focusOption(index: number) {
    const nextIndex = (index + options.length) % options.length;
    setActiveIndex(nextIndex);
    containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[nextIndex]?.focus();
  }

  function selectOption(option: RoleOption) {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label id={`${id}-label`} className="mb-2 block text-sm font-medium text-ink">{label}</label>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
            requestAnimationFrame(() => focusOption(selectedIndex + (event.key === "ArrowDown" ? 1 : -1)));
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-midnight-border bg-midnight-deep/80 px-4 text-left text-sm text-ink shadow-inner shadow-black/10 transition hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-gold/20 bg-gold/10 text-xs font-semibold text-gold-soft" aria-hidden="true">
          {selectedOption?.label.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{selectedOption?.label}</span>
        <ChevronDown size={16} className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border border-midnight-border bg-midnight-card p-1.5 shadow-2xl shadow-black/40"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => selectOption(option)}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusOption(index + 1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    focusOption(index - 1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    focusOption(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    focusOption(options.length - 1);
                  } else if (event.key === "Escape") {
                    setOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
                data-active={activeIndex === index}
                className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${selected ? "bg-gold/10 text-gold-soft" : "text-ink hover:bg-white/5"} ${activeIndex === index ? "bg-white/5" : ""}`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-semibold ${selected ? "bg-gold/15 text-gold-soft" : "bg-midnight-deep text-ink-muted"}`} aria-hidden="true">
                  {option.label.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1">{option.label}</span>
                {selected && <Check size={14} className="text-gold-soft" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
