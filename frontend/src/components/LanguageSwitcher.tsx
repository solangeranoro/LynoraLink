"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Languages } from "@/components/FontAwesomeIcons";

export function LanguageSwitcher({
  className,
  compact = false,
  variant = "default",
}: {
  className?: string;
  compact?: boolean;
  variant?: "default" | "landing";
}) {
  const { locale, setLocale } = useTranslation();
  const isLanding = variant === "landing";

  const options: { value: "en" | "fr"; label: string; flag: string }[] = [
    { value: "en", label: "EN", flag: "🇬🇧" },
    { value: "fr", label: "FR", flag: "🇫🇷" },
  ];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-midnight-border bg-midnight-deep/60 p-1",
        isLanding && "gap-0.5 rounded-lg border-white/25 bg-white/10 p-0.5 sm:gap-1.5 sm:p-1",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {isLanding && <Languages size={14} className="hidden text-white/65 sm:ml-1 sm:block" aria-hidden="true" />}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setLocale(opt.value)}
          aria-label={opt.value === "en" ? "English" : "Français"}
          title={opt.value === "en" ? "English" : "Français"}
          aria-pressed={locale === opt.value}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
            isLanding && "h-7 min-w-8 justify-center rounded-md px-1.5 text-[10px] tracking-wide sm:h-8 sm:min-w-9 sm:px-2 sm:text-[11px]",
            locale === opt.value
              ? isLanding
                ? "bg-[#22b8a0] text-[#071827] shadow-sm"
                : "bg-gold/15 text-gold-soft shadow-[inset_0_0_0_1px_rgba(8,111,88,0.35)]"
              : isLanding
                ? "text-white/75 hover:bg-white/10 hover:text-white"
                : "text-ink-muted hover:text-ink",
          )}
        >
          {!isLanding && !compact && <span aria-hidden>{opt.flag}</span>}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
