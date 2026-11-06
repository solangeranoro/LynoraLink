"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/lib/i18n";

const slides = {
  en: [
    {
      image: "/landing/slide-1.jpg",
      alt: "Makers planning a project together with notes on a wall",
      label: "Find your collaborators",
      title: "Different strengths. One shared direction.",
      description: "Meet people who can bring a new skill, a fresh perspective, or the momentum your next step needs.",
    },
    {
      image: "/landing/slide-2.png",
      alt: "Makers collaborating at a shared workspace with laptops",
      label: "Make progress visible",
      title: "Let the work take shape in public.",
      description: "Share the decisions, experiments, and milestones that move an early idea toward something people can use.",
    },
    {
      image: "/landing/slide-3.jpg",
      alt: "A team collaborating on a digital project around a laptop",
      label: "Build something together",
      title: "Turn a good idea into shared work.",
      description: "Explore projects, start a conversation, and take the next practical step with people who want to build too.",
    },
  ],
  fr: [
    {
      image: "/landing/slide-1.jpg",
      alt: "Des makers préparent un projet ensemble à l’aide de notes",
      label: "Trouvez vos partenaires",
      title: "Des forces différentes. Une même direction.",
      description: "Rencontrez des personnes qui apportent une compétence, un nouveau regard ou l’élan nécessaire à la suite.",
    },
    {
      image: "/landing/slide-2.png",
      alt: "Des makers collaborent dans un espace de travail partagé avec des ordinateurs",
      label: "Rendez vos avancées visibles",
      title: "Faites évoluer votre projet au grand jour.",
      description: "Partagez les décisions, les essais et les étapes qui transforment une idée en quelque chose d’utile.",
    },
    {
      image: "/landing/slide-3.jpg",
      alt: "Une équipe collabore sur un projet numérique autour d’un ordinateur",
      label: "Construisez ensemble",
      title: "Transformez une idée en projet collectif.",
      description: "Explorez les projets, engagez la conversation et avancez concrètement avec des personnes qui veulent créer.",
    },
  ],
} as const;

export function LandingImageCarousel() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const content = isFrench ? slides.fr : slides.en;
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), { rootMargin: "120px" });
    observer.observe(carousel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % content.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [content.length, isInView]);

  function showSlide(index: number) {
    setActiveIndex((index + content.length) % content.length);
  }

  const activeSlide = content[activeIndex];

  return (
    <section className="landing-carousel-section text-[#10224c]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
        <div className="mb-9 flex flex-col justify-between gap-5 sm:mb-12 md:flex-row md:items-end">
          <div data-landing-reveal="left">
            <p className="landing-eyebrow mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#0878ff]">
              {isFrench ? "La création en mouvement" : "Making things, together"}
            </p>
            <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              {isFrench ? "Les idées avancent mieux à plusieurs." : "Good ideas move further together."}
            </h2>
          </div>
          <p data-landing-reveal="right" className="max-w-lg text-base leading-7 text-[#586b8c] sm:text-lg sm:leading-8">
            {isFrench
              ? "Des premières discussions aux étapes concrètes, chaque projet se construit avec des personnes qui partagent l’envie d’avancer."
              : "From first conversations to real milestones, every project moves forward with people who want to make progress."}
          </p>
        </div>

        <div
          role="region"
          ref={carouselRef}
          aria-roledescription={isFrench ? "carrousel" : "carousel"}
          aria-label={isFrench ? "Scènes de co-création" : "Co-building scenes"}
          data-landing-reveal="up"
          className="landing-carousel-frame relative isolate overflow-hidden rounded-[1.75rem] bg-[#071b56]"
        >
          <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[2.1/1]">
            {content.map((slide, index) => (
              <div
                key={slide.image}
                role="group"
                aria-roledescription={isFrench ? "diapositive" : "slide"}
                aria-label={`${index + 1} / ${content.length}`}
                aria-hidden={index !== activeIndex}
                className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${index === activeIndex ? "opacity-100" : "pointer-events-none opacity-0"}`}
              >
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 92vw, 1280px"
                  className="object-cover"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#06133d]/90 via-[#06133d]/20 to-[#06133d]/5" />
              </div>
            ))}

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-7 p-5 text-white sm:p-8 md:flex-row md:items-end md:justify-between md:p-10">
              <div className="max-w-2xl">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#35b5ff] sm:text-xs">
                  {String(activeIndex + 1).padStart(2, "0")} / {content.length} <span className="px-1.5 text-white/50">·</span> {activeSlide.label}
                </p>
                <h3 className="font-display text-2xl font-semibold leading-tight sm:text-3xl lg:text-4xl">{activeSlide.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/80 sm:text-base sm:leading-7">{activeSlide.description}</p>
              </div>

            </div>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-[#071742] px-4 py-4" aria-label={isFrench ? "Choisir une image" : "Choose a slide"}>
            {content.map((slide, index) => (
              <button
                key={slide.label}
                type="button"
                onClick={() => showSlide(index)}
                aria-label={isFrench ? `Afficher l’image ${index + 1} : ${slide.label}` : `Show image ${index + 1}: ${slide.label}`}
                aria-pressed={index === activeIndex}
                className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-8 bg-[#35b5ff]" : "w-1.5 bg-white/45 hover:bg-white/75"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}