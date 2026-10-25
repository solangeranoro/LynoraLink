"use client";

import Image from "next/image";
import { useTranslation } from "@/lib/i18n";

export function CopilotLoadingScreen() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";

  return (
    <main className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-midnight-deep" aria-busy="true" aria-live="polite">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.1),transparent_56%)]" />
      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="lynoracopilot-splash-mark relative grid h-36 w-36 place-items-center sm:h-40 sm:w-40" aria-hidden="true">
          <span className="lynoracopilot-splash-halo absolute inset-3 rounded-full bg-emerald-400/15 blur-2xl" />
          <span className="lynoracopilot-splash-orbit absolute inset-1 rounded-full border border-emerald-300/15" />
          <span className="lynoracopilot-splash-orbit-dot absolute inset-1 rounded-full" />
          <Image
            src="/logo_assistant_ia.svg"
            alt=""
            width={128}
            height={128}
            priority
            className="lynoracopilot-splash-icon relative h-28 w-28 object-contain sm:h-32 sm:w-32"
          />
        </div>
        <h1 className="mt-1 flex items-center font-display text-3xl font-bold tracking-tight sm:text-4xl" aria-label="LynoAI">
          <span className="lynoracopilot-brand-lynora">Lyno</span>
          <span className="lynoracopilot-brand-ai">AI</span>
        </h1>
        <p className="mt-3 text-xs font-medium tracking-wide text-ink-muted sm:text-sm">
          {isFrench ? "Préparation de votre espace LynoAI" : "Preparing your LynoAI workspace"}
        </p>
        <span className="mt-5 flex gap-1.5" aria-hidden="true">
          <span className="lynoracopilot-loading-dot" />
          <span className="lynoracopilot-loading-dot [animation-delay:180ms]" />
          <span className="lynoracopilot-loading-dot [animation-delay:360ms]" />
        </span>
        <span className="sr-only">{isFrench ? "Chargement de LynoAI…" : "Loading LynoAI…"}</span>
      </div>
      <style>{`
        @keyframes lynoracopilot-brand-enter {
          from { opacity: 0; transform: translateY(8px); filter: blur(4px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes lynoracopilot-brand-glow {
          0%, 100% { text-shadow: 0 0 0 rgba(16,185,129,0); }
          50% { text-shadow: 0 0 18px rgba(16,185,129,.35); }
        }
        @keyframes lynoracopilot-dot-bounce {
          0%, 60%, 100% { opacity: .35; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes lynoracopilot-icon-enter {
          from { opacity: 0; transform: scale(.72) rotate(-8deg); }
          to { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes lynoracopilot-icon-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes lynoracopilot-halo-pulse {
          0%, 100% { opacity: .45; transform: scale(.86); }
          50% { opacity: .9; transform: scale(1.08); }
        }
        @keyframes lynoracopilot-orbit {
          to { transform: rotate(360deg); }
        }
        .lynoracopilot-splash-icon {
          animation: lynoracopilot-icon-enter 800ms both cubic-bezier(.2,.8,.2,1), lynoracopilot-icon-float 3.2s 800ms ease-in-out infinite;
          filter: drop-shadow(0 8px 18px rgba(16,185,129,.18));
        }
        .lynoracopilot-splash-halo { animation: lynoracopilot-halo-pulse 2.8s ease-in-out infinite; }
        .lynoracopilot-splash-orbit { animation: lynoracopilot-icon-enter 700ms both ease-out, lynoracopilot-orbit 12s 700ms linear infinite; }
        .lynoracopilot-splash-orbit-dot::before {
          position: absolute;
          top: 12%;
          left: 12%;
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #34d399;
          box-shadow: 0 0 12px rgba(52,211,153,.8);
          content: "";
        }
        .lynoracopilot-splash-orbit-dot { animation: lynoracopilot-orbit 8s linear infinite; }
        .lynoracopilot-brand-lynora, .lynoracopilot-brand-ai {
          animation: lynoracopilot-brand-enter 700ms both cubic-bezier(.2,.8,.2,1);
        }
        .lynoracopilot-brand-lynora { color: white; }
        .lynoracopilot-brand-ai {
          color: #34d399;
          animation: lynoracopilot-brand-enter 700ms 100ms both cubic-bezier(.2,.8,.2,1), lynoracopilot-brand-glow 2.4s 800ms ease-in-out infinite;
        }
        .lynoracopilot-loading-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #34d399;
          animation: lynoracopilot-dot-bounce 1.1s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .lynoracopilot-splash-icon, .lynoracopilot-splash-halo, .lynoracopilot-splash-orbit,
          .lynoracopilot-splash-orbit-dot, .lynoracopilot-brand-lynora, .lynoracopilot-brand-ai,
          .lynoracopilot-loading-dot {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
