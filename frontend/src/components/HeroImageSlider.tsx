"use client";

import { useEffect, useState } from "react";

const welcomeImages = [
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=2000&q=80",
];

export function HeroImageSlider({ variant = "landing" }: { variant?: "landing" | "welcome" }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (variant !== "welcome" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % welcomeImages.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [variant]);

  return (
    <div aria-hidden="true" className="absolute inset-0 -z-20 overflow-hidden bg-[#081827]">
      {variant === "landing" ? (
        <div
          className="landing-hero-image absolute inset-0 bg-cover bg-[center_42%]"
          style={{ backgroundImage: "url('/landing/hero.png')" }}
        />
      ) : (
        welcomeImages.map((image, index) => (
          <div
            key={image}
            className={`absolute inset-0 bg-[center_42%] bg-cover transition-opacity duration-1000 motion-reduce:transition-none ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
            style={{ backgroundImage: `url('${image}')` }}
          />
        ))
      )}
    </div>
  );
}