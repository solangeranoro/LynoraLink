"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import type { Extension } from "@codemirror/state";

function languageExtension(language: string): Extension[] {
  const normalized = language.trim().toLowerCase();
  if (["js", "javascript", "jsx", "ts", "tsx", "typescript"].includes(normalized)) {
    return [javascript({ jsx: true, typescript: ["ts", "tsx", "typescript"].includes(normalized) })];
  }
  if (["css", "scss", "less"].includes(normalized)) return [css()];
  if (["html", "xml", "svg"].includes(normalized)) return [html()];
  if (["json", "jsonc"].includes(normalized)) return [json()];
  if (["py", "python"].includes(normalized)) return [python()];
  if (["sql", "postgres", "postgresql"].includes(normalized)) return [sql()];
  if (["go", "golang"].includes(normalized)) return [go()];
  if (["java"].includes(normalized)) return [java()];
  if (["php"].includes(normalized)) return [php()];
  if (["rs", "rust"].includes(normalized)) return [rust()];
  return [];
}

export function CopilotCodeEditor({
  value,
  language,
  onChange,
  height,
  ariaLabel,
}: {
  value: string;
  language: string;
  onChange: (value: string) => void;
  height: string;
  ariaLabel: string;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const updateTheme = () => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={theme}
      extensions={languageExtension(language)}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
      }}
      aria-label={ariaLabel}
    />
  );
}
