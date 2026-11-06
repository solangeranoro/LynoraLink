"use client";

import { useEffect } from "react";

export function LandingScrollEffects() {
  useEffect(() => {
    const page = document.querySelector(".landing-page");
    if (!page || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const targets = page.querySelectorAll<HTMLElement>("[data-landing-reveal]");
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          (entry.target as HTMLElement).dataset.revealVisible = String(entry.isIntersecting);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    const observedTargets = new WeakSet<HTMLElement>();
    const observeTarget = (target: HTMLElement) => {
      if (observedTargets.has(target)) return;
      observedTargets.add(target);
      observer.observe(target);
    };

    page.classList.add("landing-scroll-ready");
    targets.forEach(observeTarget);

    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches("[data-landing-reveal]")) observeTarget(node);
          node.querySelectorAll<HTMLElement>("[data-landing-reveal]").forEach(observeTarget);
        }
      }
    });
    mutations.observe(page, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      page.classList.remove("landing-scroll-ready");
    };
  }, []);

  return null;
}
