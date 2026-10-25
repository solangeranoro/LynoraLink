function ProjectCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="skeleton h-3.5 w-36 max-w-full" />
          <div className="skeleton h-2.5 w-24" />
        </div>
        <div className="skeleton h-5 w-16 shrink-0 rounded-full" />
      </div>
      <div className="skeleton aspect-[16/6] w-full rounded-none" />
      <div className="space-y-3.5 p-3.5">
        <div className="space-y-2">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-4/5" />
        </div>
        <div className="flex gap-1.5">
          <div className="skeleton h-5 w-14 rounded-full" />
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-5 w-12 rounded-full" />
        </div>
        <div className="flex items-center justify-between border-t border-midnight-border pt-3">
          <div className="skeleton h-3 w-28 max-w-[55%]" />
          <div className="skeleton h-7 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ProjectsListSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading projects">
      {Array.from({ length: 6 }).map((_, index) => <ProjectCardSkeleton key={index} />)}
    </div>
  );
}

function TaskColumnSkeleton() {
  return (
    <div className="min-w-0 border-t-2 border-midnight-border pt-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-3 w-5" />
      </div>
      <div className="space-y-2">
        <div className="rounded-lg border border-midnight-border bg-midnight-card/45 p-3">
          <div className="skeleton h-3.5 w-full" />
          <div className="mt-2 skeleton h-3.5 w-3/5" />
          <div className="mt-4 skeleton h-7 w-full rounded-md" />
        </div>
        <div className="rounded-lg border border-midnight-border bg-midnight-card/45 p-3">
          <div className="skeleton h-3.5 w-4/5" />
        </div>
      </div>
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10" aria-busy="true" aria-label="Loading project">
      <div className="flex h-9 items-center gap-2">
        <div className="skeleton h-4 w-4 rounded" />
        <div className="skeleton h-3 w-24" />
      </div>

      <header className="flex min-h-[300px] flex-col justify-between overflow-hidden rounded-2xl border border-midnight-border p-5 sm:min-h-[350px] sm:p-8">
        <div className="flex items-center justify-between">
          <div className="skeleton h-6 w-24 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="skeleton h-16 w-16 shrink-0 rounded-xl sm:h-20 sm:w-20" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-8 w-64 max-w-full" />
              <div className="skeleton h-4 w-80 max-w-full" />
            </div>
            <div className="skeleton hidden h-10 w-32 rounded-lg sm:block" />
          </div>
          <div className="flex items-center gap-2 border-t border-midnight-border pt-4">
            <div className="skeleton h-7 w-7 rounded-full" />
            <div className="skeleton h-3 w-40" />
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-6">
          <section className="card space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="skeleton h-4 w-36" />
              <div className="skeleton h-6 w-24 rounded-full" />
            </div>
            <div className="grid grid-cols-3 border-y border-midnight-border">
              {[0, 1, 2].map((step) => (
                <div key={step} className={`flex items-center gap-2 py-3 ${step ? "border-l border-midnight-border pl-3 sm:pl-5" : "pr-3"}`}>
                  <div className="skeleton h-5 w-5 shrink-0 rounded-full" />
                  <div className="skeleton h-3 w-full max-w-24" />
                </div>
              ))}
            </div>
          </section>

          <section className="card space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="skeleton h-5 w-36" />
                <div className="skeleton h-3 w-64 max-w-full" />
              </div>
              <div className="skeleton h-3 w-20" />
            </div>
            <div className="skeleton h-10 w-full rounded-lg" />
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((column) => <TaskColumnSkeleton key={column} />)}
            </div>
          </section>

          <section className="card space-y-4 p-4 sm:p-5">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-28 rounded-xl" />
            <div className="skeleton h-40 rounded-xl" />
          </section>
          <section className="card space-y-4 p-4 sm:p-5">
            <div className="skeleton h-5 w-36" />
            <div className="skeleton h-16 rounded-lg" />
            <div className="skeleton h-28 rounded-xl" />
          </section>
          <section className="card space-y-4 p-4 sm:p-5">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton h-40 rounded-xl" />
            <div className="skeleton h-40 rounded-xl" />
          </section>
        </main>
        <aside className="space-y-4">
          <div className="card space-y-3 p-4">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-16 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((stat) => <div key={stat} className="skeleton h-14 rounded-lg" />)}
            </div>
          </div>
          <div className="card space-y-3 p-4">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-12 rounded-lg" />
            <div className="skeleton h-12 rounded-lg" />
          </div>
          <div className="card space-y-3 p-4">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-10 rounded-lg" />
            <div className="skeleton h-10 rounded-lg" />
          </div>
        </aside>
      </div>
    </div>
  );
}
