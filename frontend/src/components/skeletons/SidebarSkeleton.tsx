import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

export function SidebarSkeleton({ className }: { className?: string }) {
  return (
    <aside
      className={cn("flex h-full w-72 flex-col gap-6 border-r border-midnight-border bg-midnight-deep/60 p-5", className)}
      aria-busy="true"
      aria-label="Loading navigation"
    >
      <div className="flex items-center gap-3">
        <Logo size={40} withWordmark />
      </div>

      {/* CTA doré */}
      <div className="skeleton h-11 w-full rounded-xl" />

      {/* Nav items */}
      <nav className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="skeleton h-5 w-5 rounded-md" />
            <div className="skeleton h-3.5 flex-1" />
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="skeleton h-10 w-full rounded-xl" />
        <div className="flex items-center gap-3">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-2.5 w-16" />
          </div>
        </div>
      </div>
    </aside>
  );
}

export default SidebarSkeleton;
