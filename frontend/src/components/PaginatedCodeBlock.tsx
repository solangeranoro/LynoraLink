"use client";

import { useTranslation } from "@/lib/i18n";
import { CodeBlock } from "@/components/CodeBlock";

const COLLAPSED_LINE_LIMIT = 12;

export function PaginatedCodeBlock({
  code,
  language,
  editable = false,
  className = "",
}: {
  code: string;
  language?: string;
  editable?: boolean;
  className?: string;
}) {
  const { t, locale } = useTranslation();

  return (
    <CodeBlock
      code={code}
      language={language ?? ""}
      isFrench={locale === "fr"}
      maxCollapsedLines={COLLAPSED_LINE_LIMIT}
      expandLabel={t("feed.codeShowMore")}
      collapseLabel={t("feed.codeShowLess")}
      ariaLabel={t("feed.codeSnippet")}
      editable={editable}
      className={className}
    />
  );
}