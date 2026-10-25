import { useState } from "react";
import Image from "next/image";
import { cn, initials } from "@/lib/utils";

export function Avatar({
  src,
  name,
  size = 40,
  online,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {src && failedSrc !== src ? (
        <Image
          src={src}
          alt={name ?? "avatar"}
          width={size}
          height={size}
          onError={() => setFailedSrc(src)}
          className="h-full w-full rounded-full object-cover ring-1 ring-midnight-border"
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-full bg-gradient-to-br from-midnight to-midnight-deep text-xs font-semibold text-gold-soft ring-1 ring-midnight-border"
          style={{ width: size, height: size }}
        >
          {initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-midnight-card",
            online ? "bg-emerald-400" : "bg-ink-muted/50",
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
          aria-label={online ? "online" : "offline"}
        />
      )}
    </span>
  );
}

export default Avatar;
