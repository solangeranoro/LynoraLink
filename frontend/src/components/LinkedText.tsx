import Link from "next/link";

const entityPattern = /(@[A-Za-z0-9_]{3,30}|#[A-Za-z0-9][A-Za-z0-9_-]{0,39})/g;

export function LinkedText({ text, className }: { text: string; className: string }) {
  return (
    <p className={className}>
      {text.split(entityPattern).map((part, index) => {
        if (part.startsWith("@")) {
          return <Link key={`${index}-${part}`} href={`/makers/${encodeURIComponent(part.slice(1))}`} className="font-medium text-gold-soft hover:text-gold-bright">{part}</Link>;
        }
        if (part.startsWith("#")) {
          return <Link key={`${index}-${part}`} href={`/discover?tag=${encodeURIComponent(part.slice(1))}`} className="font-medium text-sky-300 hover:text-sky-200">{part}</Link>;
        }
        return <span key={`${index}-${part}`}>{part}</span>;
      })}
    </p>
  );
}