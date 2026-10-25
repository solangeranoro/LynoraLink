'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle, AlertTriangle, ArrowUpRight, Check, Clipboard, Info,
  Lightbulb, Search, Sparkles,
} from 'lucide-react'
import { useIdeStore } from '@/store/ide-store'
import { flattenProjectFiles } from '@/lib/workspace-files'
import type { ProblemDiagnostic } from '@/types/ide'
import { cn } from '@/lib/utils'

type Severity = ProblemDiagnostic['severity']
type ProblemEntry = { key: string; problem: ProblemDiagnostic }
type Filter = Severity | 'all'

const severityMeta: Record<Severity, { label: string; icon: typeof AlertCircle; color: string }> = {
  error: { label: 'Errors', icon: AlertCircle, color: 'text-rose-400' },
  warning: { label: 'Warnings', icon: AlertTriangle, color: 'text-amber-400' },
  info: { label: 'Info', icon: Info, color: 'text-sky-400' },
  hint: { label: 'Hints', icon: Lightbulb, color: 'text-violet-400' },
}

const filterOrder: Filter[] = ['all', 'error', 'warning', 'info', 'hint']

function problemKey(problem: ProblemDiagnostic, index: number) {
  return `${problem.path}:${problem.line}:${problem.column}:${problem.code ?? ''}:${problem.message}:${index}`
}

function problemText(problem: ProblemDiagnostic) {
  return [
    `${problem.path}:${problem.line}:${problem.column}`,
    `[${problem.severity.toUpperCase()}]${problem.code ? ` ${problem.code}` : ''}${problem.source ? ` (${problem.source})` : ''}`,
    problem.message,
    ...(problem.relatedInformation ?? []).map((related) =>
      `Related: ${related.path ? `${related.path}${related.line ? `:${related.line}:${related.column ?? 1}` : ''} — ` : ''}${related.message}`),
  ].join('\n')
}

export function ProblemsPanel() {
  const problemsByPath = useIdeStore((state) => state.problemsByPath)
  const files = useIdeStore((state) => state.files)
  const tabs = useIdeStore((state) => state.tabs)
  const openFile = useIdeStore((state) => state.openFile)
  const setActiveTab = useIdeStore((state) => state.setActiveTab)
  const revealProblemLocation = useIdeStore((state) => state.revealProblemLocation)
  const queueLynoAICommand = useIdeStore((state) => state.queueLynoAICommand)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const allEntries = useMemo(() => Object.values(problemsByPath).flat()
    .map((problem, index) => ({ key: problemKey(problem, index), problem }))
    .sort((a, b) =>
      filterOrder.indexOf(a.problem.severity) - filterOrder.indexOf(b.problem.severity) ||
      a.problem.path.localeCompare(b.problem.path) ||
      a.problem.line - b.problem.line ||
      a.problem.column - b.problem.column,
    ), [problemsByPath])
  const counts = useMemo(() => allEntries.reduce((result, { problem }) => {
    result.all += 1
    result[problem.severity] += 1
    return result
  }, { all: 0, error: 0, warning: 0, info: 0, hint: 0 }), [allEntries])
  const entries = allEntries.filter(({ problem }) =>
    (filter === 'all' || problem.severity === filter) &&
    (!query.trim() || `${problem.path} ${problem.message} ${problem.code ?? ''} ${problem.source ?? ''}`
      .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
  )
  const selectedEntry = entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? null
  const selected = selectedEntry?.problem ?? null
  const flatFiles = useMemo(() => flattenProjectFiles(files), [files])
  const selectedFile = selected
    ? flatFiles.find((file) => !file.isDirectory && file.path === selected.path)
    : undefined
  const selectedTab = selected ? tabs.find((tab) => tab.path === selected.path) : undefined
  const sourceLines = (selectedTab?.content ?? selectedFile?.content ?? '').split('\n')
  const excerptStart = selected ? Math.max(1, selected.line - 2) : 1
  const excerptEnd = selected ? Math.min(sourceLines.length, (selected.endLine ?? selected.line) + 2) : 0

  const openProblem = (problem: ProblemDiagnostic) => {
    const tab = useIdeStore.getState().tabs.find((item) => item.path === problem.path)
    if (tab) setActiveTab(tab.id)
    else {
      const file = flattenProjectFiles(useIdeStore.getState().files)
        .find((item) => !item.isDirectory && item.path === problem.path)
      if (!file) {
        toast.error(`Could not find ${problem.path} in the workspace.`)
        return
      }
      openFile(file)
    }
    revealProblemLocation(problem.path, problem.line, problem.column)
  }

  const requestFix = (problem: ProblemDiagnostic) => {
    openProblem(problem)
    queueLynoAICommand(
      `/fix ${problem.path}:${problem.line}:${problem.column} [${problem.severity}]${problem.code ? ` ${problem.code}` : ''}${problem.source ? ` (${problem.source})` : ''}: ${problem.message}`,
    )
  }

  const copyProblem = async (problem: ProblemDiagnostic) => {
    try {
      await navigator.clipboard.writeText(problemText(problem))
      toast.success('Problem details copied.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not copy problem details.')
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider">Problems</h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {counts.error} errors · {counts.warning} warnings · {counts.info + counts.hint} suggestions
          </p>
        </div>
        <label className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter problems"
            aria-label="Filter problems"
            className="h-7 w-40 rounded border bg-background pl-7 pr-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
      </header>

      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1" aria-label="Filter by severity">
        {filterOrder.map((severity) => {
          const label = severity === 'all' ? 'All' : severityMeta[severity].label
          const count = counts[severity]
          return (
            <button
              key={severity}
              type="button"
              aria-pressed={filter === severity}
              onClick={() => setFilter(severity)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors',
                filter === severity ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60',
              )}
            >
              {label}
              <span className="rounded bg-background/70 px-1 tabular-nums">{count}</span>
            </button>
          )
        })}
      </nav>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto border-r p-1">
          {!entries.length ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {allEntries.length === 0 ? 'No problems detected.' : 'No problems match these filters.'}
            </p>
          ) : entries.map(({ key, problem }) => {
            const meta = severityMeta[problem.severity]
            const Icon = meta.icon
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selectedEntry?.key === key}
                className={cn(
                  'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors',
                  selectedEntry?.key === key ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                )}
                onClick={() => setSelectedKey(key)}
                onDoubleClick={() => openProblem(problem)}
              >
                <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', meta.color)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{problem.message}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                    {problem.path} · {problem.line}:{problem.column}
                    {problem.code && ` · ${problem.code}`}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <article className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {!selected ? (
            <p className="m-auto p-4 text-center text-xs text-muted-foreground">
              Select a problem to inspect its details and available actions.
            </p>
          ) : (
            <>
              <div className="space-y-2 border-b p-3">
                <div className="flex items-start gap-2">
                  {(() => {
                    const Icon = severityMeta[selected.severity].icon
                    return <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', severityMeta[selected.severity].color)} />
                  })()}
                  <div className="min-w-0">
                    <h3 className="break-words text-xs font-semibold">{selected.message}</h3>
                    <p className="mt-1 break-all text-[10px] text-muted-foreground">
                      {selected.path}:{selected.line}:{selected.column}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
                  <dt className="text-muted-foreground">Severity</dt>
                  <dd className={severityMeta[selected.severity].color}>{selected.severity}</dd>
                  {selected.source && <><dt className="text-muted-foreground">Source</dt><dd>{selected.source}</dd></>}
                  {selected.code && <><dt className="text-muted-foreground">Code</dt><dd className="font-mono">{selected.code}</dd></>}
                  {selected.endLine && <><dt className="text-muted-foreground">Range</dt><dd>{selected.line}:{selected.column}–{selected.endLine}:{selected.endColumn}</dd></>}
                </dl>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700"
                    onClick={() => requestFix(selected)}
                    title="Ask LynoAI to propose a fix for this problem"
                  >
                    <Sparkles className="h-3 w-3" /> Fix with LynoAI
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-accent"
                    onClick={() => openProblem(selected)}
                  >
                    <ArrowUpRight className="h-3 w-3" /> Open location
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-accent"
                    onClick={() => void copyProblem(selected)}
                  >
                    <Clipboard className="h-3 w-3" /> Copy details
                  </button>
                </div>
              </div>

              {sourceLines.length > 1 && (
                <section className="border-b p-3">
                  <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Source context
                  </h4>
                  <pre className="overflow-x-auto rounded bg-muted/60 p-2 font-mono text-[10px] leading-relaxed">
                    {sourceLines.slice(excerptStart - 1, excerptEnd).map((line, index) => {
                      const lineNumber = excerptStart + index
                      const isProblemLine = lineNumber >= selected.line && lineNumber <= (selected.endLine ?? selected.line)
                      return (
                        <div key={lineNumber} className={cn(isProblemLine && 'bg-amber-500/10 text-foreground')}>
                          <span className="mr-3 inline-block w-6 select-none text-right text-muted-foreground">{lineNumber}</span>
                          {line || ' '}
                        </div>
                      )
                    })}
                  </pre>
                </section>
              )}

              {(selected.relatedInformation?.length ?? 0) > 0 && (
                <section className="p-3">
                  <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Related information
                  </h4>
                  <ul className="space-y-1 text-[10px]">
                    {selected.relatedInformation?.map((related, index) => (
                      <li key={`${related.path}:${related.line}:${index}`} className="flex gap-1.5">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="break-words">
                          {related.path && <span className="font-mono">{related.path}{related.line ? `:${related.line}:${related.column ?? 1}` : ''} — </span>}
                          {related.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  )
}
