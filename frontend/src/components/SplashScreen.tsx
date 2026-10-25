"use client";

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
        <svg
          className="splash-mark"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="80 220 1100 900"
          role="img"
          aria-label="LynoraLink"
        >
          <g className="mark-float">
            <path
              className="mark-piece piece-left"
              fill="#087b61"
              d="M247 718 L247 886 L506 1016 L597 1063 L600 1062 L600 888 L598 886 L518 846 L518 920 L515 921 L348 837 L346 835 L346 764Z"
            />
            <path
              className="mark-piece piece-right"
              fill="#087b61"
              d="M980 718 L880 764 L880 835 L877 838 L710 922 L708 921 L708 846 L703 847 L625 886 L623 888 L623 1064 L626 1064 L979 887Z"
            />
            <path
              className="mark-piece piece-north-west"
              fill="#01297f"
              d="M628 266 L622 267 L100 500 L100 584 L446 757 L449 757 L477 682 L480 670 L226 543 L224 540 L421 450 L593 374Z"
            />
            <path
              className="mark-piece piece-north"
              fill="#01297f"
              d="M670 252 L668 252 L575 510 L474 768 L474 772 L573 824 L577 823 L723 404 L760 303 L760 298Z"
            />
            <path
              className="mark-piece piece-north-east"
              fill="#01297f"
              d="M1158 489 L1148 483 L1042 433 L1035 431 L1012 419 L1005 417 L789 314 L786 314 L773 347 L755 401 L1018 531 L1031 539 L1020 546 L860 626 L650 723 L642 739 L605 836 L620 842 L852 725 L1064 622 L1066 601 L1108 601 L1157 577Z M756 314 L646 314 L606 424 L605 743 L693 490 L699 476 L709 444 L721 413 L723 404Z M613 314 L605 314 L605 338Z"
            />
            <path
              className="mark-tassel"
              fill="#01297f"
              d="M1066 590 L1066 621 L1069 619 L1070 620 L1070 726 L1066 727 L1065 730 L1046 730 L1043 734 L1043 827 L1047 832 L1051 834 L1129 834 L1133 832 L1137 827 L1137 734 L1134 730 L1113 730 L1109 726 L1108 722 L1108 601 L1112 599 L1112 590Z"
            />
            <g clipPath="url(#lynora-logo-clip)">
              <rect
                className="mark-shine"
                x="300"
                y="200"
                width="260"
                height="900"
                fill="url(#lynora-shine)"
                transform="skewX(-20)"
              />
            </g>
          </g>
          <defs>
            <clipPath id="lynora-logo-clip">
              <path d="M628 266 L622 267 L100 500 L100 584 L446 757 L449 757 L477 682 L480 670 L226 543 L224 540 L421 450 L593 374Z" />
              <path d="M670 252 L668 252 L575 510 L474 768 L474 772 L573 824 L577 823 L723 404 L760 303 L760 298Z" />
              <path d="M1158 489 L1148 483 L1042 433 L1035 431 L1012 419 L1005 417 L789 314 L786 314 L773 347 L755 401 L1018 531 L1031 539 L1020 546 L860 626 L650 723 L642 739 L605 836 L620 842 L852 725 L1064 622 L1066 601 L1108 601 L1157 577Z M756 314 L646 314 L606 424 L605 743 L693 490 L699 476 L709 444 L721 413 L723 404Z M613 314 L605 314 L605 338Z" />
              <path d="M1066 590 L1066 621 L1069 619 L1070 620 L1070 726 L1066 727 L1065 730 L1046 730 L1043 734 L1043 827 L1047 832 L1051 834 L1129 834 L1133 832 L1137 827 L1137 734 L1134 730 L1113 730 L1109 726 L1108 722 L1108 601 L1112 599 L1112 590Z" />
              <path d="M247 718 L247 886 L506 1016 L597 1063 L600 1062 L600 888 L598 886 L518 846 L518 920 L515 921 L348 837 L346 835 L346 764Z" />
              <path d="M980 718 L880 764 L880 835 L877 838 L710 922 L708 921 L708 846 L703 847 L625 886 L623 888 L623 1064 L626 1064 L979 887Z" />
            </clipPath>
            <linearGradient id="lynora-shine" x1="0" x2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="splash-wordmark" aria-label="LynoraLink">
          <span>Lynora</span>
          <span className="wordmark-link">Link</span>
        </div>
        <div className="splash-progress" aria-hidden="true">
          <span className="progress-fill" />
          <span className="progress-shine" />
        </div>
        <p className="splash-tagline">
          <span>GLOBAL</span> CO-BUILDING <span>HUB</span>
        </p>
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
          width: min(78vw, 380px);
          flex-direction: column;
          align-items: center;
          gap: 0;
        }
        .splash-mark {
          display: block;
          width: 100%;
          overflow: visible;
        }
        .mark-float {
          animation: mark-float 4s ease-in-out 2s infinite;
        }
        .mark-piece {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation: mark-up .9s cubic-bezier(.22, 1.2, .36, 1) forwards;
        }
        .piece-left { animation-delay: .15s; }
        .piece-right { animation-delay: .35s; }
        .piece-north-west { animation: mark-from-left .9s cubic-bezier(.22, 1.2, .36, 1) .6s forwards; }
        .piece-north { animation: mark-drop .9s cubic-bezier(.22, 1.2, .36, 1) .85s forwards; }
        .piece-north-east { animation: mark-from-right .9s cubic-bezier(.22, 1.2, .36, 1) 1.05s forwards; }
        .mark-tassel {
          opacity: 0;
          transform-box: view-box;
          transform-origin: 1089px 596px;
          animation: tassel-fade .3s ease 1.6s forwards, tassel-swing 3s ease-in-out 1.9s infinite;
        }
        .mark-shine {
          opacity: 0;
          animation: shine 3.2s ease-in-out 2.2s infinite;
        }
        .splash-wordmark {
          display: flex;
          margin-top: -4px;
          color: #01297f;
          font-family: Arial, sans-serif;
          font-size: clamp(2rem, 9vw, 3rem);
          font-weight: 750;
          letter-spacing: -.065em;
          line-height: 1;
          opacity: 0;
          animation: wordmark-in .7s cubic-bezier(.22, 1.2, .36, 1) 1.5s forwards, wordmark-float 4s ease-in-out 2.15s infinite;
        }
        .wordmark-link { color: #087b61; }
        .splash-progress {
          position: relative;
          width: min(68%, 220px);
          height: 4px;
          margin-top: 26px;
          overflow: hidden;
          border-radius: 999px;
          background: #e6edf5;
          opacity: 0;
          animation: fade-in .3s ease 2.4s forwards;
        }
        .progress-fill {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #01297f, #087b61);
          transform: scaleX(0);
          transform-origin: left center;
          animation: progress-grow .9s ease 2.4s forwards;
        }
        .progress-shine {
          position: absolute;
          inset: 0 auto 0 -30%;
          width: 28%;
          background: linear-gradient(90deg, transparent, #fff, transparent);
          animation: progress-sweep 3.2s ease-in-out 3.4s infinite;
        }
        .splash-tagline {
          margin: 17px 0 0;
          color: #01297f;
          font-family: Arial, sans-serif;
          font-size: clamp(.48rem, 2vw, .65rem);
          font-weight: 650;
          letter-spacing: .2em;
          opacity: 0;
          animation: fade-in .8s ease 2.9s forwards, tagline-float 4s ease-in-out 3.8s infinite;
        }
        .splash-tagline span { color: #087b61; }
        @keyframes mark-up {
          from { opacity: 0; transform: translateY(140px) scale(.85); }
          to { opacity: 1; transform: none; }
        }
        @keyframes mark-from-left {
          from { opacity: 0; transform: translateX(-220px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes mark-from-right {
          from { opacity: 0; transform: translateX(220px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes mark-drop {
          from { opacity: 0; transform: translateY(-220px) rotate(-12deg); }
          to { opacity: 1; transform: none; }
        }
        @keyframes tassel-fade { to { opacity: 1; } }
        @keyframes tassel-swing {
          0%, 100% { transform: rotate(0); }
          25% { transform: rotate(6deg); }
          75% { transform: rotate(-5deg); }
        }
        @keyframes mark-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        @keyframes shine {
          0% { transform: translateX(-700px); opacity: 0; }
          15% { opacity: .55; }
          60% { transform: translateX(700px); opacity: .55; }
          61%, 100% { transform: translateX(700px); opacity: 0; }
        }
        @keyframes wordmark-in {
          from { opacity: 0; transform: translateY(70px) scale(.8); }
          to { opacity: 1; transform: none; }
        }
        @keyframes wordmark-float {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -10px; }
        }
        @keyframes progress-grow { to { transform: scaleX(1); } }
        @keyframes progress-sweep {
          0% { transform: translateX(-200px); }
          60%, 100% { transform: translateX(720px); }
        }
        @keyframes fade-in { to { opacity: 1; } }
        @keyframes tagline-float {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -8px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lynora-splash *, .lynora-splash *::before, .lynora-splash *::after {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            translate: none !important;
          }
          .mark-shine, .progress-shine { opacity: 0 !important; }
          .progress-fill { transform: scaleX(1) !important; }
        }
      `}</style>
    </div>
  );
}

export default SplashScreen;
