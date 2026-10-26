"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function SplashScreen({ minDuration = 4200 }: { minDuration?: number }) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    return !(window as Window & { __lynoraSplashShown?: boolean }).__lynoraSplashShown;
  });
  const [leaving, setLeaving] = useState(false);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const splashWindow = window as Window & { __lynoraSplashShown?: boolean };
    if (splashWindow.__lynoraSplashShown && !hasStartedRef.current) {
      setVisible(false);
      return;
    }
    splashWindow.__lynoraSplashShown = true;
    hasStartedRef.current = true;

    document.body.style.overflow = "hidden";
    const leaveTimer = setTimeout(() => setLeaving(true), minDuration);
    const removeTimer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = "";
    }, minDuration + 200);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(removeTimer);
      document.body.style.overflow = "";
    };
  }, [minDuration]);

  if (!visible) return null;

  return (
    <div
      className={`lynora-splash${leaving ? " is-leaving" : ""}`}
      role="status"
      aria-label="LynoraLink — Global Co-Building Hub"
      aria-live="polite"
    >
      <div className="splash-content">
        <Image
          src="/logo_lynoralink_anime.svg"
          alt="LynoraLink — Global Co-Building Hub"
          width={512}
          height={549}
          priority
          unoptimized
          className="splash-logo"
        />
      </div>

      <style>{`
        .lynora-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #fff;
          opacity: 1;
          pointer-events: auto;
          transition: opacity 180ms ease-out;
        }
        .lynora-splash.is-leaving {
          opacity: 0;
          pointer-events: none;
        }
        .splash-content {
          display: flex;
          width: min(88vw, 512px);
          align-items: center;
          justify-content: center;
        }
        .splash-logo {
          display: block;
          width: 100%;
          height: auto;
        }
        @media (prefers-reduced-motion: reduce) {
          .lynora-splash { transition: none; }
        }
      `}</style>
    </div>
  );
}

export default SplashScreen;
