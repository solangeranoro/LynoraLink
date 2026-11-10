"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

export type EditorialInfoSection = {
  id: string;
  title: string;
  body: string | readonly string[];
};

type Props = {
  sections: readonly EditorialInfoSection[];
  contentsLabel: string;
  notice?: string;
  updatedAt?: string;
  questionLabel?: string;
  contactPrompt?: string;
  contactLabel?: string;
};

function EditorialInfoContents({
  sections,
  contentsLabel,
}: {
  sections: readonly EditorialInfoSection[];
  contentsLabel: string;
}) {
  const { locale } = useTranslation();
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    const updateActiveSection = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const elements = sections
          .map(({ id }) => document.getElementById(id))
          .filter((element): element is HTMLElement => element !== null);
        const passed = elements.filter((element) => element.getBoundingClientRect().top <= 220);
        const current = passed[passed.length - 1];
        const atPageEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        setActiveSection(atPageEnd ? elements[elements.length - 1]?.id ?? "" : current?.id ?? elements[0]?.id ?? "");
      });
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [sections]);

  return (
    <aside className="documentation-toc">
      <div className="documentation-toc-heading">
        <span className="documentation-toc-kicker">{locale === "fr" ? "Ressource" : "Resource"}</span>
        <h2>{contentsLabel}</h2>
      </div>
      <nav aria-label={contentsLabel}>
        <ol>
          {sections.map(({ id, title }, index) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={activeSection === id ? "location" : undefined}
                onClick={() => setActiveSection(id)}
              >
                <span className="documentation-toc-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="documentation-help">
        <p>{locale === "fr" ? "Besoin d’aide ?" : "Need help?"}</p>
        <Link href="/contact" className="documentation-help-link">
          {locale === "fr" ? "Contacter l’équipe" : "Contact the team"}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
}

export function EditorialInfoLayout({
  sections,
  contentsLabel,
  notice,
  updatedAt,
  questionLabel,
  contactPrompt,
  contactLabel,
}: Props) {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const isFaq = Boolean(questionLabel);

  const article = (
    <article className={`documentation-article editorial-info-article${isFaq ? " editorial-faq-content" : ""}`}>
        {notice && (
          <aside className="editorial-info-notice">
            <span>{isFrench ? "À noter" : "Please note"}</span>
            <p>{notice}</p>
          </aside>
        )}
        {sections.map(({ id, title, body }, index) => (
          <section
            key={id}
            id={id}
            className={`${isFaq ? "editorial-faq-item" : "documentation-chapter editorial-info-chapter"} scroll-mt-28`}
          >
            {!isFaq && <div className="documentation-chapter-number">{String(index + 1).padStart(2, "0")}</div>}
            <div className={isFaq ? "editorial-faq-question-content" : "documentation-chapter-content"}>
              {questionLabel ? (
                <details className="editorial-info-question" open={index === 0}>
                  <summary>
                    <h2>{title}</h2>
                    <ChevronDown size={18} className="editorial-info-chevron" aria-hidden="true" />
                  </summary>
                  {(typeof body === "string" ? [body] : body).map((paragraph) => (
                    <p key={paragraph} className="documentation-chapter-intro">{paragraph}</p>
                  ))}
                </details>
              ) : (
                <>
                  <h2>{title}</h2>
                  {(typeof body === "string" ? [body] : body).map((paragraph) => (
                    <p key={paragraph} className="documentation-chapter-intro">{paragraph}</p>
                  ))}
                </>
              )}
            </div>
          </section>
        ))}
        {updatedAt && <p className="editorial-info-updated">{updatedAt}</p>}
        {contactPrompt && contactLabel && (
          <footer className="documentation-article-footer">
            <div>
              <span>{questionLabel ?? (isFrench ? "UNE QUESTION ?" : "HAVE A QUESTION?")}</span>
              <p>{contactPrompt}</p>
            </div>
            <Link href="/contact">{contactLabel}<span aria-hidden="true">→</span></Link>
          </footer>
        )}
      </article>
  );

  if (isFaq) return article;

  return (
    <div className="documentation-layout">
      <EditorialInfoContents sections={sections} contentsLabel={contentsLabel} />
      {article}
    </div>
  );
}
