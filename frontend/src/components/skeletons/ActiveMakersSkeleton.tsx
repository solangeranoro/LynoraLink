import { cn } from "@/lib/utils";

export function ActiveMakersSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("card p-5", className)} aria-busy="true" aria-label="Loading active makers">
      <div className="mb-4 flex items-center justify-between">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-5 w-12 rounded-full" />
      </div>
      <ul className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i} className="flex items-center gap-3">
            <div className="relative">
              <div className="skeleton h-9 w-9 rounded-full" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-midnight-card bg-midnight-border" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-2.5 w-20" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ActiveMakersSkeleton;
