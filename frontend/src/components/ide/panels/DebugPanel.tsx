'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Trash2, Bug, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIdeStore } from '@/store/ide-store'
import { ideEventBus } from '@/lib/ide/event-bus'
import { flattenProjectFiles } from '@/lib/workspace-files'

type DebugLine = { id: number; kind: 'log' | 'error' | 'result'; text: string }

const runtimeDocument = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><script>
addEventListener('message', async (event) => {
  if (event.source !== parent || event.data?.type !== 'run') return;
  const send = (kind, args) => parent.postMessage({ type: 'lynora-debug-output', kind, text: args.map((item) => {
    try { return typeof item === 'string' ? item : JSON.stringify(item); }
    catch { return String(item); }
  }).join(' ') }, '*');
  const console = {
    log: (...args) => send('log', args),
    info: (...args) => send('log', args),
    warn: (...args) => send('log', args),
    error: (...args) => send('error', args),
  };
  try {
    const execute = new Function('console', '"use strict";\\n' + event.data.source + '\\n//# sourceURL=lynoracoding-user-code.js');
    const result = await execute(console);
    if (result !== undefined) send('result', [result]);
    parent.postMessage({ type: 'lynora-debug-finished' }, '*');
  } catch (error) {
    send('error', [error?.stack || error?.message || String(error)]);
    parent.postMessage({ type: 'lynora-debug-finished' }, '*');
  }
});
</script>`

export function DebugPanel() {
  const tabs = useIdeStore((state) => state.tabs)
  const activeTabId = useIdeStore((state) => state.activeTabId)
  const files = useIdeStore((state) => state.files)
  const setActivePanel = useIdeStore((state) => state.setActivePanel)
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [breakpoints, setBreakpoints] = useState<Record<string, number[]>>({})
  const [output, setOutput] = useState<DebugLine[]>([])
  const [running, setRunning] = useState(false)

  const fileByPath = useMemo(() => new Map(
    flattenProjectFiles(files).map((file) => [file.path, file]),
  ), [files])

  useEffect(() => ideEventBus.on('debug:breakpoint', ({ path, line, enabled }) => {
    setBreakpoints((current) => {
      const lines = new Set(current[path] ?? [])
      if (enabled) lines.add(line)
      else lines.delete(line)
      return { ...current, [path]: [...lines].sort((a, b) => a - b) }
    })
  }), [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || typeof event.data !== 'object' || !event.data) return
      if (event.data.type === 'lynora-debug-output') {
        const kind = event.data.kind
        if (!['log', 'error', 'result'].includes(kind) || typeof event.data.text !== 'string') return
        const line = { id: Date.now() + Math.random(), kind, text: event.data.text } as DebugLine
        setOutput((current) => [...current, line])
        ideEventBus.emit('debug:output', { kind, text: line.text })
        ideEventBus.emit('output:line', { source: 'debug', kind, text: line.text, timestamp: Date.now() })
      } else if (event.data.type === 'lynora-debug-finished') {
        clearTimeout(timeoutRef.current)
        setRunning(false)
        iframeRef.current?.removeAttribute('srcDoc')
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timeoutRef.current)
    }
  }, [])

  const run = () => {
    if (!activeTab) {
      setActivePanel('explorer')
      return
    }
    setOutput([])
    setRunning(true)
    iframeRef.current?.setAttribute('srcdoc', runtimeDocument)
    timeoutRef.current = setTimeout(() => {
      iframeRef.current?.removeAttribute('srcdoc')
      setRunning(false)
      const line = {
        id: Date.now(),
        kind: 'error' as const,
        text: 'Execution stopped after 3 seconds. Infinite loops and long-running code are terminated.',
      }
      setOutput((current) => [...current, line])
      ideEventBus.emit('debug:output', { kind: 'error', text: line.text })
      ideEventBus.emit('output:line', { source: 'debug', kind: 'error', text: line.text, timestamp: Date.now() })
    }, 3_000)
    window.setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'run', source: activeTab.content }, '*')
    }, 0)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">JavaScript Debug Console</span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            disabled={!output.length}
            onClick={() => useIdeStore.getState().queueLynoAICommand(
              `Analyze this debug output, identify the likely root cause, and suggest a fix:\n${output.slice(-40).map((line) => `[${line.kind}] ${line.text}`).join('\n').slice(0, 12_000)}`,
            )}
          >
            <Sparkles className="mr-1 h-3 w-3" /> Ask LynoAI
          </Button>
          <Button size="sm" className="h-7 text-xs" disabled={running || !activeTab} onClick={run}>
            <Play className="mr-1 h-3 w-3" /> Run active file
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOutput([])} title="Clear output">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="shrink-0 space-y-2 border-b p-3 text-[11px] text-muted-foreground">
        <p>Code runs in a short-lived, sandboxed browser frame with network access disabled.</p>
        <p>JavaScript only. Python and C# need runtime adapters that are not configured here.</p>
        <p>Click the editor gutter to record breakpoints. Pausing, stepping and variable inspection require a debugger adapter and are not simulated.</p>
      </div>
      <div className="shrink-0 border-b p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
          <Bug className="h-3.5 w-3.5 text-emerald-500" /> Breakpoints ({Object.values(breakpoints).reduce((total, lines) => total + lines.length, 0)})
        </div>
        {Object.entries(breakpoints).flatMap(([path, lines]) => lines.map((line) => (
          <button
            key={`${path}:${line}`}
            className="block w-full truncate py-0.5 text-left font-mono text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              const file = fileByPath.get(path)
              if (file) useIdeStore.getState().openFile(file)
            }}
          >
            {path}:{line}
          </button>
        )))}
        {!Object.values(breakpoints).some((lines) => lines.length) && (
          <p className="text-[11px] text-muted-foreground">Click a line’s gutter in the editor to add a breakpoint.</p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-xs" aria-live="polite">
        {output.map((line) => (
          <pre key={line.id} className={`whitespace-pre-wrap py-0.5 ${line.kind === 'error' ? 'text-destructive' : line.kind === 'result' ? 'text-emerald-500' : ''}`}>
            {line.text}
          </pre>
        ))}
        {!output.length && <p className="py-8 text-center text-muted-foreground">Run the active JavaScript file to see console output.</p>}
        {running && <p className="py-2 text-emerald-500">Running in isolated frame…</p>}
      </div>
      <iframe ref={iframeRef} title="JavaScript debug sandbox" sandbox="allow-scripts" className="hidden" />
    </div>
  )
}
