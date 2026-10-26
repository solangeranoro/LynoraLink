"use client";

import { useEffect, useState } from "react";

const heroImages = [
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=2000&q=80",
];

const welcomeImages = [
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=2000&q=80",
];

export function HeroImageSlider({ variant = "landing" }: { variant?: "landing" | "welcome" }) {
  const images = variant === "welcome" ? welcomeImages : heroImages;
  const [activeIndex, setActiveIndex] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(false);

  useEffect(() => {
    if (variant !== "landing") return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateVideoPreference = () => {
      setVideoEnabled(!motionPreference.matches);
    };

    updateVideoPreference();
    motionPreference.addEventListener("change", updateVideoPreference);

    return () => {
      motionPreference.removeEventListener("change", updateVideoPreference);
    };
  }, [variant]);

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
        videoEnabled ? (
          <video
            className="absolute inset-y-0 right-0 h-full w-full object-cover md:w-[68%] landing-hero-image"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/landing/ideas-workshop.webp"
          >
            <source src="/hero_video.mp4" type="video/mp4" />
          </video>
        ) : (
          <div
            className="absolute inset-y-0 right-0 w-full bg-cover bg-[right_42%] md:w-[68%] landing-hero-image"
            style={{ backgroundImage: "url('/landing/ideas-workshop.webp')" }}
          />
        )
      ) : (
        images.map((image, index) => (
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