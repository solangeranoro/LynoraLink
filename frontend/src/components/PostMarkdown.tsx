import Link from "next/link";
import { PaginatedCodeBlock } from "@/components/PaginatedCodeBlock";

function renderInline(text: string, lineKey: string) {
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|@[A-Za-z0-9_]{3,30}|#[A-Za-z0-9][A-Za-z0-9_-]{0,39})/g;
  return text.split(tokenPattern).map((token, index) => {
    const key = `${lineKey}-${index}`;
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={key} className="font-semibold text-ink">{token.slice(2, -2)}</strong>;
    if (token.startsWith("*") && token.endsWith("*")) return <em key={key} className="italic">{token.slice(1, -1)}</em>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={key} className="rounded bg-midnight-deep px-1 py-0.5 font-mono text-xs text-gold-soft">{token.slice(1, -1)}</code>;
    if (token.startsWith("[")) {
      const match = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (match) return <a key={key} href={match[2]} target="_blank" rel="noreferrer" className="text-gold-soft underline decoration-gold/40 underline-offset-2 hover:text-gold-bright">{match[1]}</a>;
    }
    if (token.startsWith("@")) return <Link key={key} href={`/makers/${encodeURIComponent(token.slice(1))}`} className="font-medium text-gold-soft hover:text-gold-bright">{token}</Link>;
    if (token.startsWith("#")) return <Link key={key} href={`/discover?tag=${encodeURIComponent(token.slice(1))}`} className="font-medium text-sky-300 hover:text-sky-200">{token}</Link>;
    return <span key={key}>{token}</span>;
  });
}

export function PostMarkdown({
  text,
  editableCode = false,
  className = "",
}: {
  text: string;
  editableCode?: boolean;
  className?: string;
}) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<PaginatedCodeBlock key={`code-${index}`} code={code.join("\n")} language={language} editable={editableCode} className="my-3" />);
      continue;
    }

    const tableSeparator = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1] ?? "");
    if (line.includes("|") && tableSeparator) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const headers = cells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={`table-${index}`} className="my-3 max-w-full overflow-x-auto rounded-lg border border-midnight-border">
          <table className="w-full min-w-max border-collapse text-left text-xs">
            <thead className="bg-midnight-deep/70 text-ink">
              <tr>{headers.map((header, cellIndex) => <th key={cellIndex} className="border-b border-midnight-border px-3 py-2 font-semibold">{renderInline(header, `table-head-${index}-${cellIndex}`)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-midnight-border/70">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  {headers.map((_, cellIndex) => <td key={cellIndex} className="px-3 py-2 leading-5 text-ink-muted">{renderInline(row[cellIndex] ?? "", `table-${index}-${rowIndex}-${cellIndex}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Heading = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      blocks.push(
        <Heading key={`heading-${index}`} className="mb-2 mt-4 font-semibold text-ink first:mt-0">
          {renderInline(heading[2], `heading-${index}`)}
        </Heading>,
      );
      index += 1;
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(<hr key={`rule-${index}`} className="my-4 border-midnight-border" />);
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index++].replace(/^\s*>\s?/, ""));
      }
      blocks.push(
        <blockquote key={`quote-${index}`} className="my-3 border-l-2 border-gold/50 pl-4 text-ink-muted">
          {quoteLines.map((quoteLine, quoteIndex) => <p key={quoteIndex} className="my-1">{renderInline(quoteLine, `quote-${index}-${quoteIndex}`)}</p>)}
        </blockquote>,
      );
      continue;
    }

    const unordered = /^\s*[-*]\s+/.test(line);
    const ordered = /^\s*\d+\.\s+/.test(line);
    if (unordered || ordered) {
      const items: string[] = [];
      const matcher = unordered ? /^\s*[-*]\s+/ : /^\s*\d+\.\s+/;
      while (index < lines.length && matcher.test(lines[index])) items.push(lines[index++].replace(matcher, ""));
      const List = unordered ? "ul" : "ol";
      blocks.push(<List key={`list-${index}`} className={`my-2 space-y-1 pl-5 ${unordered ? "list-disc" : "list-decimal"}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `item-${index}-${itemIndex}`)}</li>)}</List>);
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }
    blocks.push(<p key={`line-${index}`} className="my-2">{renderInline(line, `line-${index}`)}</p>);
    index += 1;
  }

  return <div className={className}>{blocks}</div>;
}