"use client";

import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("markup", markup);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("typescript", typescript);

const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  bash: "bash",
  css: "css",
  html: "markup",
  javascript: "javascript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  markup: "markup",
  python: "python",
  py: "python",
  react: "javascript",
  sh: "bash",
  shell: "bash",
  sql: "sql",
  ts: "typescript",
  typescript: "typescript",
  tsx: "typescript",
  xml: "markup",
};

export function inferCodeLanguage(code: string) {
  const source = code.trim();
  if (!source) return undefined;
  if (/^(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(source)) return "html";

  try {
    JSON.parse(source);
    return "json";
  } catch {
    // Continue checking other common languages.
  }

  const hasCssSelector = /(?:^|\n)\s*(?:[.#][\w-]+|[a-z][\w-]*)[^\n{]*\{/i.test(source);
  const hasCssDeclaration = /\b(?:color|background|display|padding|margin|font-size|border|width|height|text-align)\s*:/i.test(source);
  if (hasCssSelector && hasCssDeclaration) return "css";
  if (/^(?:SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im.test(source)) return "sql";
  if (/^#!.*\b(?:bash|sh)\b/m.test(source) || /^(?:npm|pnpm|yarn|git|docker|curl|chmod|mkdir)\s/m.test(source)) return "bash";
  if (/^(?:def\s+\w+|class\s+\w+|from\s+[\w.]+\s+import\s+|print\s*\()/m.test(source)) return "python";
  if (/\b(?:interface|type)\s+\w+\s*(?:=|\{)|:\s*(?:string|number|boolean|unknown|void|Promise(?:\s*<[^>]+>)?)/m.test(source)) return "typescript";
  return "javascript";
}

export function CodeRenderer({ code, language }: { code: string; language?: string }) {
  const normalizedLanguage = language?.trim().toLowerCase();
  const highlightedLanguage = (normalizedLanguage && CODE_LANGUAGE_ALIASES[normalizedLanguage])
    || CODE_LANGUAGE_ALIASES[inferCodeLanguage(code) ?? ""];

  return (
    <SyntaxHighlighter
      language={highlightedLanguage}
      style={vscDarkPlus}
      showLineNumbers
      wrapLines={false}
      lineNumberStyle={{ color: "#78839a", borderRight: "1px solid #283247", marginRight: "0.75rem", minWidth: "2.5em", paddingRight: "0.75rem" }}
      customStyle={{ background: "transparent", margin: 0, minWidth: "100%", width: "max-content", padding: "0.75rem", fontSize: "0.75rem", lineHeight: 1.65 }}
      codeTagProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" } }}
    >
      {code}
    </SyntaxHighlighter>
  );
}