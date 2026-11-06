function MakerCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-midnight-border bg-midnight-card/70 p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton h-[42px] w-[42px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton h-3.5 w-2/3" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      </div>
      <div className="min-h-14 flex-1 space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-4/5" />
        <div className="flex gap-1.5 pt-1">
          <div className="skeleton h-5 w-16 rounded-md" />
          <div className="skeleton h-5 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex gap-2 border-t border-midnight-border/70 pt-3">
        <div className="skeleton h-9 flex-1 rounded-lg" />
        <div className="skeleton h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}

function MakerGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <MakerCardSkeleton key={index} />
      ))}
    </div>
  );
}

function SectionHeadingSkeleton({ withDescription = false }: { withDescription?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-2">
        <div className="skeleton h-5 w-40" />
        {withDescription && <div className="skeleton h-3 w-64 max-w-full" />}
      </div>
      <div className="skeleton h-6 w-7 shrink-0 rounded-full" />
    </div>
  );
}

export function MakersDirectorySkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10" aria-busy="true" aria-label="Loading makers">
      <header>
        <div className="mb-3 flex h-9 items-center gap-2">
          <div className="skeleton h-4 w-4 rounded" />
          <div className="skeleton h-3 w-24" />
        </div>
        <div className="skeleton h-9 w-64 max-w-full" />
        <div className="mt-2 skeleton h-4 w-80 max-w-full" />
      </header>

      <section className="space-y-4">
        <SectionHeadingSkeleton />
        <MakerGridSkeleton count={2} />
      </section>

      <section className="space-y-5">
        <div className="skeleton h-5 w-44" />
        <div className="space-y-3">
          <SectionHeadingSkeleton />
          <MakerGridSkeleton count={3} />
        </div>
        <div className="space-y-3">
          <SectionHeadingSkeleton />
          <MakerGridSkeleton count={3} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeadingSkeleton withDescription />
        <MakerGridSkeleton count={6} />
        <div className="flex items-center justify-between gap-3">
          <div className="skeleton h-9 w-24 rounded-lg" />
          <div className="skeleton h-3 w-12" />
          <div className="skeleton h-9 w-24 rounded-lg" />
        </div>
      </section>
    </div>
  );
}
