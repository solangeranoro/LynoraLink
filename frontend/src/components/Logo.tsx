import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo({
  size = 44,
  className,
  withWordmark = false,
  wordmarkClassName,
  priority = false,
}: {
  size?: number;
  className?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className="relative inline-flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo_lynora.svg"
          alt={withWordmark ? "" : "Lynora"}
          aria-hidden={withWordmark}
          width={size}
          height={size}
          priority={priority}
          className="brand-logo-mark"
        />
      </span>
      {withWordmark && (
        <span className={cn("font-display text-[1.55rem] font-semibold tracking-[-0.05em] text-ink sm:text-[1.7rem]", wordmarkClassName)}>
          Lynora<span className="text-gold">Link</span>
        </span>
      )}
    </div>
  );
}

export default Logo;
