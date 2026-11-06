function ModerationCaseSkeleton({ showActions }: { showActions: boolean }) {
  return (
    <article className="card space-y-4 p-5" aria-hidden="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-3 w-56 max-w-full" />
          <div className="skeleton h-3 w-40 max-w-full" />
        </div>
        <div className="skeleton h-6 w-24 rounded-full" />
      </div>
      <div className="rounded-xl border border-midnight-border bg-midnight-deep/40 p-4">
        <div className="space-y-2">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-11/12" />
          <div className="skeleton h-3 w-3/5" />
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="skeleton h-3 w-64 max-w-full" />
        <div className="skeleton h-3 w-24" />
      </div>
      {showActions && (
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="skeleton h-9 w-36 rounded-lg" />
          <div className="skeleton h-9 w-36 rounded-lg" />
          <div className="skeleton h-9 w-32 rounded-lg" />
          <div className="skeleton h-9 w-20 rounded-lg" />
        </div>
      )}
    </article>
  );
}

export function AdminModerationSkeleton({ showActions }: { showActions: boolean }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement des dossiers de modération">
      {[0, 1, 2].map((item) => <ModerationCaseSkeleton key={item} showActions={showActions} />)}
    </div>
  );
}

function TesterApplicationCardSkeleton() {
  return (
    <article className="card overflow-hidden" aria-hidden="true">
      <div className="flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <div className="skeleton h-16 w-16 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="skeleton h-6 w-44 max-w-full" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
            <div className="skeleton h-3 w-60 max-w-full" />
            <div className="space-y-2 pt-1">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-4/5" />
            </div>
          </div>
          <div className="skeleton h-9 w-32 rounded-lg" />
        </div>

        <div className="rounded-xl bg-midnight-card/80 p-4">
          <div className="skeleton h-3 w-28" />
          <div className="mt-2 space-y-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        </div>

        <div className="grid gap-4 border-t border-midnight-border/70 pt-5 sm:grid-cols-2">
          {[0, 1].map((column) => (
            <section key={column} className="space-y-3">
              <div className="skeleton h-4 w-28" />
              <div className="space-y-2.5">
                {[0, 1, 2, 3, 4].slice(0, column === 0 ? 5 : 3).map((row) => (
                  <div key={row} className="flex gap-3">
                    <div className="skeleton h-3 w-16 shrink-0" />
                    <div className="skeleton h-3 w-full" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex gap-3 overflow-hidden">
          <div className="skeleton h-32 w-56 shrink-0 rounded-xl" />
          <div className="skeleton h-32 w-56 shrink-0 rounded-xl" />
          <div className="skeleton h-32 w-56 shrink-0 rounded-xl" />
        </div>

        <div className="flex flex-col gap-3 border-t border-midnight-border/70 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-3 w-36" />
            <div className="skeleton h-16 w-full rounded-lg" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-10 w-24 rounded-lg" />
            <div className="skeleton h-10 w-24 rounded-lg" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function AdminTesterApplicationsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Chargement des candidatures testeur">
      {[0, 1].map((item) => <TesterApplicationCardSkeleton key={item} />)}
    </div>
  );
}
