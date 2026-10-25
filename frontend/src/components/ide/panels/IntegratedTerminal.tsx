'use client'

import { useEffect, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon as FitAddonInstance } from '@xterm/addon-fit'
import { useIdeStore } from '@/store/ide-store'
import {
  ChevronDown, Circle, Columns2, Eraser, ExternalLink, Folder, LoaderCircle, Maximize2,
  Minimize2, Plus, RefreshCw, Search, Settings2, ShieldCheck, Square, Terminal as TerminalIcon, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProblemsPanel } from './ProblemsPanel'
import { OutputPanel } from './OutputPanel'
import { DebugPanel } from './DebugPanel'
import { BadgeNotification } from '../BadgeNotification'
import { loadWorkspaceTerminalPorts } from '@/lib/workspace-api'
import type { CodingTerminalPort, TerminalSession } from '@/types/ide'
import {
  pollWorkspaceTerminalSession,
  resizeWorkspaceTerminal,
  writeWorkspaceTerminalInput,
} from '@/lib/workspace-api'

function terminalTheme(theme: 'light' | 'dark') {
  if (theme === 'light') {
    return {
      background: '#ffffff',
      foreground: '#1f2937',
      cursor: '#059669',
      cursorAccent: '#ffffff',
      selectionBackground: '#a7f3d0',
      black: '#1f2937',
      red: '#dc2626',
      green: '#059669',
      yellow: '#b45309',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#f3f4f6',
      brightBlack: '#6b7280',
      brightRed: '#b91c1c',
      brightGreen: '#047857',
      brightYellow: '#92400e',
      brightBlue: '#1d4ed8',
      brightMagenta: '#7e22ce',
      brightCyan: '#0e7490',
      brightWhite: '#111827',
    }
  }
  return {
    background: '#101114',
    foreground: '#d7dae0',
    cursor: '#6ee7b7',
    cursorAccent: '#101114',
    selectionBackground: '#285c50',
    black: '#17181c',
    red: '#fb7185',
    green: '#6ee7b7',
    yellow: '#facc15',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#67e8f9',
    white: '#d7dae0',
    brightBlack: '#777d87',
    brightRed: '#fda4af',
    brightGreen: '#a7f3d0',
    brightYellow: '#fde68a',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#a5f3fc',
    brightWhite: '#ffffff',
  }
}

function TerminalSurface({
  terminalId,
  cwd,
  clearVersion,
  searchRequest,
}: {
  terminalId: string
  cwd: string
  clearVersion: number
  searchRequest: { query: string; id: number } | null
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const [commandRunning, setCommandRunning] = useState(false)
  const theme = useIdeStore((state) => state.theme)

  useEffect(() => {
    terminalRef.current?.clear()
  }, [clearVersion])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal || !searchRequest?.query) return
    const buffer = terminal.buffer.active
    for (let row = 0; row < buffer.length; row += 1) {
      const line = buffer.getLine(row)?.translateToString() ?? ''
      const index = line.indexOf(searchRequest.query)
      if (index < 0) continue
      terminal.select(index, row, searchRequest.query.length)
      return
    }
  }, [searchRequest])

  useEffect(() => {
    const terminal = terminalRef.current
    if (terminal) terminal.options.theme = terminalTheme(theme)
  }, [theme])

  useEffect(() => {
    let mounted = true
    let sessionId: string | null = useIdeStore.getState().terminals
      .find((item) => item.id === terminalId)?.connectionId ?? null
    let sessionRunning = false
    let cursor = 0
    let pendingInput = ''
    let inputQueue = Promise.resolve()
    let terminal: Terminal | null = null
    let fitAddon: FitAddonInstance | null = null
    let resizeObserver: ResizeObserver | null = null
    let inputDisposable: { dispose: () => void } | null = null
    let pollController: AbortController | null = null
    let lastSize = ''

    const reportError = (message: string) => {
      if (mounted && terminal) terminal.write(`\r\n\x1b[31m${message}\x1b[0m\r\n`)
    }

    const sendInput = (data: string) => {
      if (!data) return
      if (!sessionId) {
        pendingInput += data
        return
      }
      const inputSessionId = sessionId
      inputQueue = inputQueue
        .then(() => writeWorkspaceTerminalInput(inputSessionId, data))
        .catch((error: unknown) => reportError(
          error instanceof Error ? error.message : 'Could not send input to the terminal.',
        ))
    }

    const fitAndResize = () => {
      const host = hostRef.current
      if (!host || !terminal || !fitAddon || !host.clientWidth || !host.clientHeight) return
      try {
        fitAddon.fit()
      } catch (error) {
        console.error('Unable to fit the interactive terminal to its panel:', error)
        return
      }
      const cols = Math.max(20, Math.min(300, terminal.cols))
      const rows = Math.max(5, Math.min(100, terminal.rows))
      if (cols !== terminal.cols || rows !== terminal.rows) terminal.resize(cols, rows)
      const size = `${terminal.cols}x${terminal.rows}`
      if (!sessionId || !sessionRunning || size === lastSize) return
      lastSize = size
      void resizeWorkspaceTerminal(sessionId, terminal.cols, terminal.rows).catch((error: unknown) => {
        reportError(error instanceof Error ? error.message : 'Could not resize the terminal.')
      })
    }

    const connect = async () => {
      try {
        const [{ Terminal: Xterm }, { FitAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
        ])
        if (!mounted || !hostRef.current) return

        terminal = new Xterm({
          allowProposedApi: true,
          convertEol: false,
          cursorBlink: true,
          fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
          fontSize: 13,
          lineHeight: 1.35,
          scrollback: 5_000,
          theme: terminalTheme(useIdeStore.getState().theme),
        })
        fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)
        terminal.open(hostRef.current)
        terminal.focus()
        terminalRef.current = terminal
        terminal.parser.registerOscHandler(777, (data) => {
          if (data === 'lynora-ready') setCommandRunning(false)
          return true
        })
        fitAndResize()

        inputDisposable = terminal.onData((data) => {
          if (data.includes('\r') || data.includes('\n')) setCommandRunning(true)
          sendInput(data)
        })
        resizeObserver = new ResizeObserver(fitAndResize)
        resizeObserver.observe(hostRef.current)

        if (!sessionId) {
          sessionId = await useIdeStore.getState().startTerminalSession(
            terminalId,
            terminal.cols,
            terminal.rows,
          )
        }
        if (!mounted) return
        if (pendingInput) {
          const input = pendingInput
          pendingInput = ''
          sendInput(input)
        }
        fitAndResize()

        while (mounted && sessionId) {
          pollController = new AbortController()
          const snapshot = await pollWorkspaceTerminalSession(sessionId, cursor, pollController.signal)
          if (!mounted) break
          if (snapshot.output) terminal.write(snapshot.output)
          cursor = snapshot.cursor
          sessionRunning = snapshot.running
          useIdeStore.getState().setTerminalStatus(terminalId, snapshot.running)
          if (!snapshot.running) {
            setCommandRunning(false)
            if (snapshot.syncError) {
              reportError(`Workspace synchronization failed: ${snapshot.syncError}`)
            }
            terminal.writeln(`\r\n\x1b[90m[Process exited with code ${snapshot.exitCode ?? 1}]\x1b[0m`)
            await useIdeStore.getState().finishTerminalSession(terminalId)
            break
          }
          fitAndResize()
        }
      } catch (error) {
        if (!mounted || (error instanceof DOMException && error.name === 'AbortError')) return
        setCommandRunning(false)
        const message = error instanceof Error ? error.message : 'Unable to start the interactive terminal.'
        reportError(message)
        useIdeStore.getState().setTerminalStatus(terminalId, false, false)
      }
    }

    void connect()

    return () => {
      mounted = false
      pollController?.abort()
      resizeObserver?.disconnect()
      inputDisposable?.dispose()
      if (terminal) {
        terminalRef.current = null
        terminal.dispose()
      }
    }
  }, [cwd, terminalId])

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {commandRunning && (
        <div
          className="h-0.5 shrink-0 overflow-hidden bg-emerald-500/15"
          role="progressbar"
          aria-label="Command is running"
        >
          <div className="lynoracoding-terminal-progress h-full w-1/3 bg-emerald-500" />
        </div>
      )}
      <div ref={hostRef} className="min-h-0 flex-1 px-3 py-2" aria-label="Interactive project terminal" />
    </div>
  )
}

export function IntegratedTerminal() {
  const {
    terminals, activeTerminalId, bottomPanel, projectName,
    addTerminal, closeTerminal, setActiveTerminal,
    clearTerminal, setBottomPanel, bottomPanelHeight, setBottomPanelHeight,
  } = useIdeStore()
  const problemsByPath = useIdeStore((state) => state.problemsByPath)
  const ideOutput = useIdeStore((state) => state.ideOutput)
  const [ports, setPorts] = useState<(CodingTerminalPort & { terminalName: string })[]>([])
  const [portsError, setPortsError] = useState<string | null>(null)
  const [portsRefreshCount, setPortsRefreshCount] = useState(0)
  const [splitTerminalId, setSplitTerminalId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchRequest, setSearchRequest] = useState<{ query: string; id: number } | null>(null)
  const [panelExpanded, setPanelExpanded] = useState(false)
  const previousPanelHeight = useRef<number | null>(null)
  const problemCount = Object.values(problemsByPath).reduce((count, problems) => count + problems.length, 0)
  const outputErrorCount = ideOutput.filter((entry) => entry.kind === 'error').length
  const debugErrorCount = ideOutput.filter((entry) => entry.source === 'debug' && entry.kind === 'error').length
  const runningTerminalCount = terminals.filter((terminal) => terminal.running || terminal.connecting).length
  const terminalCount = runningTerminalCount > 1 ? runningTerminalCount : 0
  const portSessionKey = terminals
    .filter((terminal) => terminal.connectionId && terminal.running)
    .map((terminal) => `${terminal.id}:${terminal.connectionId}:${terminal.name}`)
    .join('|')

  useEffect(() => {
    if (bottomPanel !== 'ports') return
    let mounted = true
    const controller = new AbortController()
    const refresh = async () => {
      const portSessions = useIdeStore.getState().terminals.filter(
        (terminal): terminal is TerminalSession & { connectionId: string } =>
          Boolean(terminal.connectionId && terminal.running),
      )
      if (!portSessions.length) {
        setPorts([])
        setPortsError(null)
        return
      }
      try {
        const results = await Promise.all(portSessions.map(async (terminal) => ({
          terminalName: terminal.name,
          ports: await loadWorkspaceTerminalPorts(terminal.connectionId, controller.signal),
        })))
        if (mounted) {
          setPorts(results.flatMap(({ terminalName, ports: terminalPorts }) =>
            terminalPorts.map((port) => ({ ...port, terminalName })),
          ))
          setPortsError(null)
        }
      } catch (error) {
        if (!mounted || (error instanceof DOMException && error.name === 'AbortError')) return
        setPortsError(error instanceof Error ? error.message : 'Could not load forwarded ports.')
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => {
      mounted = false
      controller.abort()
      window.clearInterval(timer)
    }
  }, [bottomPanel, portSessionKey, portsRefreshCount])

  const active = terminals.find((terminal) => terminal.id === activeTerminalId) ?? terminals[0]
  const splitPeer = splitTerminalId
    ? terminals.find((terminal) => terminal.id === splitTerminalId && terminal.id !== active?.id)
      ?? terminals.find((terminal) => terminal.id !== active?.id)
    : null
  const panels = [
    { key: 'terminal', label: 'Terminal', count: terminalCount },
    { key: 'problems', label: 'Problems', count: problemCount },
    { key: 'output', label: 'Output', count: outputErrorCount },
    { key: 'debug-console', label: 'Debug Console', count: debugErrorCount },
    { key: 'ports', label: 'Ports', count: ports.length },
  ] as const

  return (
    <section className="flex h-full flex-col overflow-hidden border-t border-border bg-background text-foreground">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
        <nav className="flex h-full min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Bottom panel">
          {panels.map((panel) => (
            <button
              key={panel.key}
              type="button"
              className={cn(
                'h-full shrink-0 border-b-2 px-3 text-[11px] font-medium uppercase tracking-wide transition-colors',
                bottomPanel === panel.key
                  ? 'border-sky-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setBottomPanel(panel.key)}
              aria-current={bottomPanel === panel.key ? 'page' : undefined}
            >
              <span className="flex items-center gap-1.5">
                {panel.label}
                {panel.count > 0 && (
                  <BadgeNotification
                    count={panel.count}
                    tone={panel.key === 'problems' || panel.key === 'output' || panel.key === 'debug-console' ? 'error' : 'info'}
                    label={panel.label}
                  />
                )}
              </span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => setBottomPanel(null)}
            title="Close bottom panel"
            aria-label="Close bottom panel"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {bottomPanel === 'terminal' && active && (
        <>
          <div className="flex min-h-0 flex-1 flex-col bg-[#0d1117]">
            <div className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-white/[0.08] bg-[#10141a] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Terminal sessions">
              {terminals.map((terminal) => (
                <div
                  key={terminal.id}
                  className={cn(
                    'group relative flex h-full shrink-0 items-center gap-2 border-r border-white/[0.06] px-3 text-[11px] transition-colors',
                    activeTerminalId === terminal.id
                      ? 'bg-[#0d1117] text-slate-100'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                  )}
                >
                  {activeTerminalId === terminal.id && (
                    <span className="absolute inset-x-0 top-0 h-0.5 bg-sky-500" />
                  )}
                  <button
                    type="button"
                    className="flex h-full items-center gap-2"
                    onClick={() => setActiveTerminal(terminal.id)}
                    role="tab"
                    aria-selected={activeTerminalId === terminal.id}
                    aria-label={`Select ${terminal.name}`}
                  >
                    {terminal.connecting
                      ? <LoaderCircle className="h-3 w-3 animate-spin text-amber-400" />
                      : <Circle className={cn('h-2 w-2 fill-current', terminal.running ? 'text-emerald-400' : 'text-slate-600')} />}
                    <TerminalIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span className="font-medium">{terminal.name}</span>
                  </button>
                  {terminals.length > 1 && (
                    <button
                      type="button"
                      className="rounded p-1 text-slate-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100 focus:opacity-100"
                      onClick={() => {
                        closeTerminal(terminal.id)
                        if (terminal.id === splitTerminalId) setSplitTerminalId(null)
                      }}
                      title={`Close ${terminal.name}`}
                      aria-label={`Close ${terminal.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}

              <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-[10px] text-slate-400">
                <Folder className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate" title={`${projectName} · ${active.cwd}`}>{active.cwd}</span>
                <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] sm:inline-flex">
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    active.connecting ? 'animate-pulse bg-amber-400' :
                      active.mode === 'simulated' ? 'bg-amber-400' :
                        active.running ? 'bg-emerald-400' : 'bg-slate-600',
                  )} />
                  {active.connecting
                    ? 'Connecting'
                    : active.mode === 'simulated'
                      ? 'Limited simulation'
                      : active.running
                        ? 'Docker · Ready'
                        : 'Stopped'}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 px-1">
                <button
                  type="button"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                  onClick={addTerminal}
                  title="New terminal"
                  aria-label="New terminal"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded p-1.5 transition-colors hover:bg-white/[0.08]',
                    splitPeer ? 'text-emerald-300' : 'text-slate-400 hover:text-slate-100',
                  )}
                  onClick={() => {
                    if (splitTerminalId) {
                      setSplitTerminalId(null)
                      return
                    }
                    const primaryId = active.id
                    addTerminal()
                    const secondaryId = useIdeStore.getState().activeTerminalId
                    if (!secondaryId) return
                    setSplitTerminalId(secondaryId)
                    setActiveTerminal(primaryId)
                  }}
                  title={splitPeer ? 'Close split terminal' : 'Split terminal'}
                  aria-label={splitPeer ? 'Close split terminal' : 'Split terminal'}
                  aria-pressed={Boolean(splitPeer)}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-rose-300"
                  onClick={() => {
                    closeTerminal(active.id)
                    if (active.id === splitTerminalId) setSplitTerminalId(null)
                  }}
                  title="Kill terminal"
                  aria-label="Kill terminal"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                  onClick={() => clearTerminal(active.id)}
                  title="Clear terminal"
                  aria-label="Clear terminal"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                  onClick={() => setSearchOpen((open) => !open)}
                  title="Search terminal"
                  aria-label="Search terminal"
                  aria-pressed={searchOpen}
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
                {searchOpen && (
                  <input
                    autoFocus
                    value={searchText}
                    onChange={(event) => {
                      const query = event.target.value
                      setSearchText(query)
                      setSearchRequest(query ? { query, id: Date.now() } : null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && searchText) {
                        setSearchRequest({ query: searchText, id: Date.now() })
                      }
                      if (event.key === 'Escape') setSearchOpen(false)
                    }}
                    className="h-7 w-32 rounded border border-white/10 bg-black/20 px-2 text-[11px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500/60"
                    placeholder="Find in output"
                    aria-label="Search terminal output"
                  />
                )}
                <button
                  type="button"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                  onClick={() => useIdeStore.getState().toggleTheme()}
                  title="Terminal settings · toggle theme"
                  aria-label="Terminal settings"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                  onClick={() => {
                    if (panelExpanded) {
                      setBottomPanelHeight(previousPanelHeight.current ?? 240)
                      previousPanelHeight.current = null
                      setPanelExpanded(false)
                      return
                    }
                    previousPanelHeight.current = bottomPanelHeight
                    setBottomPanelHeight(520)
                    setPanelExpanded(true)
                  }}
                  title={panelExpanded ? 'Restore panel size' : 'Maximize panel'}
                  aria-label={panelExpanded ? 'Restore panel size' : 'Maximize panel'}
                >
                  {panelExpanded
                    ? <Minimize2 className="h-3.5 w-3.5" />
                    : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className={cn('flex min-h-0 flex-1', splitPeer ? 'flex-row' : 'flex-col')}>
              <div className="min-h-0 min-w-0 flex-1">
                <TerminalSurface
                  key={active.id}
                  terminalId={active.id}
                  cwd={active.cwd}
                  clearVersion={active.clearVersion}
                  searchRequest={searchRequest}
                />
              </div>
              {splitPeer && (
                <div className="min-h-0 min-w-0 flex-1 border-l border-border">
                  <TerminalSurface
                    key={splitPeer.id}
                    terminalId={splitPeer.id}
                    cwd={splitPeer.cwd}
                    clearVersion={splitPeer.clearVersion}
                    searchRequest={searchRequest}
                  />
                </div>
              )}
            </div>
          </div>

          <footer className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/[0.08] bg-[#10141a] px-3 py-1.5 text-[10px] font-sans text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className={cn('h-3 w-3', active.mode === 'simulated' ? 'text-amber-400' : 'text-emerald-400')} />
              Bash · {active.mode === 'simulated' ? 'limited simulation' : 'isolated Docker container'}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span><kbd className="text-foreground">Ctrl+C</kbd> to stop</span>
              <span><kbd className="text-foreground">Ctrl+L</kbd> clear</span>
              <span><kbd className="text-foreground">↑</kbd><kbd className="text-foreground">↓</kbd> history</span>
              <span><kbd className="text-foreground">Tab</kbd> complete</span>
              <span>Node: v22 · Python: 3.11 · {active.architecture ?? 'x64'}</span>
            </span>
          </footer>
        </>
      )}
      {bottomPanel === 'problems' && (
        <div className="min-h-0 flex-1 overflow-hidden [&_*]:border-white/[0.08]">
          <ProblemsPanel />
        </div>
      )}
      {bottomPanel === 'output' && (
        <OutputPanel />
      )}
      {bottomPanel === 'debug-console' && (
        <div className="min-h-0 flex-1 overflow-hidden [&>div]:h-full">
          <DebugPanel />
        </div>
      )}
      {bottomPanel === 'ports' && (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span>Services listening on forwarded development ports</span>
            <button
              type="button"
              className="rounded p-1 hover:bg-accent hover:text-foreground"
              onClick={() => setPortsRefreshCount((count) => count + 1)}
              title="Refresh forwarded ports"
              aria-label="Refresh forwarded ports"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </header>
          {portsError && (
            <p role="alert" className="m-3 rounded border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
              {portsError}
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {!ports.length && !portsError ? (
              <p className="p-3 text-xs text-muted-foreground">
                No listening service detected. Start a server on a forwarded development port (3000, 3001, 4000, 4173, 4200, 4321, 5000, 5173, 8000, 8080, 8081, 8888, or 9000). Ports are exposed only on this machine. Existing terminal sessions must be restarted to enable forwarding.
              </p>
            ) : ports.map((port) => (
              <a
                key={`${port.terminalName}:${port.containerPort}`}
                href={`http://127.0.0.1:${port.hostPort}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded px-3 py-2 text-xs hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <Circle className="h-2 w-2 fill-current text-emerald-400" />
                  <span className="font-mono">:{port.containerPort}</span>
                  <span className="text-muted-foreground">→ localhost:{port.hostPort}</span>
                  <span className="text-muted-foreground">{port.terminalName}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-[#969ba5]" />
              </a>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}
