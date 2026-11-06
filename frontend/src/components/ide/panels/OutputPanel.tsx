'use client'

import { Trash2 } from 'lucide-react'
import { useIdeStore } from '@/store/ide-store'

export function OutputPanel() {
  const entries = useIdeStore((state) => state.ideOutput)
  const clearOutput = useIdeStore((state) => state.clearIdeOutput)

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#101114] text-[#d7dae0]">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.08] px-3">
        <span className="text-xs font-medium text-[#aeb3bd]">Workspace output</span>
        <button
          type="button"
          className="rounded p-1 text-[#969ba5] hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
          onClick={clearOutput}
          disabled={!entries.length}
          title="Clear output"
          aria-label="Clear output"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-xs" aria-live="polite">
        {!entries.length ? (
          <p className="p-3 text-center text-[#8d929c]">
            Debug runs and extension logs will appear here.
          </p>
        ) : entries.map((entry) => (
          <div key={entry.id} className="flex gap-2 whitespace-pre-wrap break-all py-0.5">
            <time className="shrink-0 text-[#777d87]">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </time>
            <span className="shrink-0 text-[#969ba5]">[{entry.source}]</span>
            <span className={
              entry.kind === 'error' ? 'text-rose-400'
                : entry.kind === 'warning' ? 'text-amber-300'
                  : entry.kind === 'result' ? 'text-emerald-400' : ''
            }>
              {entry.text}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
