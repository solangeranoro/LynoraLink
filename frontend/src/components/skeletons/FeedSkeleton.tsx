import { cn } from "@/lib/utils";

function PostCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="skeleton h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-40" />
          <div className="skeleton h-3 w-24" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-11/12" />
        <div className="skeleton h-3.5 w-8/12" />
      </div>
      <div className="mt-4 flex gap-3">
        <div className="skeleton h-8 w-20 rounded-full" />
        <div className="skeleton h-8 w-24 rounded-full" />
        <div className="skeleton h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true" aria-label="Loading feed">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default FeedSkeleton;
