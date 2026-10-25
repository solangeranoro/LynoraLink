'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Blocks, Download, Play, Plus, RefreshCw, Shield, Sparkles, Trash2, Upload, X } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ideEventBus, type IdeEventMap } from '@/lib/ide/event-bus'
import {
  addExtension,
  installMarketplaceExtension,
  loadExtensions,
  removeExtension,
  updateExtension,
  type CodingExtension,
} from '@/lib/workspace-api'
import { useIdeStore } from '@/store/ide-store'
import { loadLynoaAIExtensionInstalled, saveLynoaAIExtensionInstalled } from '@/lib/ide/lynoai-settings'

const permissionChoices = [
  ['files.read', 'Read the active editor file'],
  ['files.write', 'Modify the active editor file'],
  ['workspace.events', 'Subscribe to workspace events'],
  ['ui.notify', 'Show IDE notifications'],
] as const

const supportedEvents: (keyof IdeEventMap)[] = [
  'workspace:loaded',
  'file:created',
  'file:saved',
  'file:deleted',
  'editor:active-file-changed',
  'git:status',
]

const frameDocument = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src 'none'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'"><script>
(() => {
  const callbacks = new Map();
  const eventCallbacks = new Map();
  let nextId = 0;
  const post = (message) => parent.postMessage({ channel: 'lynora-extension', ...message }, '*');
  const rpc = (method, payload = {}) => new Promise((resolve, reject) => {
    const id = String(++nextId);
    callbacks.set(id, { resolve, reject });
    post({ type: 'rpc', id, method, payload });
  });
  const api = Object.freeze({
    getActiveFile: () => rpc('files.read'),
    replaceActiveFile: (content) => rpc('files.write', { content }),
    notify: (message) => post({ type: 'notify', message: String(message).slice(0, 300) }),
    on: (event, callback) => {
      if (typeof callback !== 'function') throw new TypeError('Event callback must be a function');
      const listeners = eventCallbacks.get(event) || new Set();
      listeners.add(callback);
      eventCallbacks.set(event, listeners);
      post({ type: 'subscribe', event });
    },
    registerCommand: (name, callback) => {
      if (typeof callback !== 'function') throw new TypeError('Command callback must be a function');
      const id = String(++nextId);
      callbacks.set('command:' + id, { callback });
      post({ type: 'command-register', id, name: String(name).slice(0, 60) });
    },
  });
  addEventListener('message', (event) => {
    const message = event.data;
    if (!message || message.channel !== 'lynora-extension') return;
    if (message.type === 'rpc-result') {
      const pending = callbacks.get(message.id);
      if (!pending || !pending.resolve) return;
      callbacks.delete(message.id);
      message.error ? pending.reject(new Error(message.error)) : pending.resolve(message.result);
    } else if (message.type === 'event') {
      for (const callback of eventCallbacks.get(message.event) || []) {
        try { callback(message.payload); } catch (error) { console.error(error); }
      }
    } else if (message.type === 'command') {
      const callback = callbacks.get('command:' + message.id);
      if (callback) {
        try { Promise.resolve(callback.callback()).catch(console.error); } catch (error) { console.error(error); }
      }
    }
  });
  for (const method of ['log', 'info', 'warn', 'error']) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
      post({ type: 'console', kind: method, text: args.map((arg) => {
        try { return typeof arg === 'string' ? arg : JSON.stringify(arg); }
        catch { return String(arg); }
      }).join(' ').slice(0, 1000) });
      original(...args);
    };
  }
  addEventListener('error', (event) => post({ type: 'console', kind: 'error', text: event.message }));
  addEventListener('unhandledrejection', (event) => post({ type: 'console', kind: 'error', text: String(event.reason) }));
  addEventListener('message', (event) => {
    const init = event.data;
    if (event.source !== parent || !init || init.channel !== 'lynora-extension-init') return;
    try {
      const run = new Function('api', '"use strict";\\n' + init.source);
      Promise.resolve(run(api)).catch((error) => console.error(error));
    } catch (error) { console.error(error); }
  });
  post({ type: 'ready' });
})();
</script>`

interface ExtensionDraft {
  name: string
  description: string
  version: string
  source: string
  permissions: string[]
  published: boolean
}

const emptyDraft: ExtensionDraft = {
  name: '',
  description: '',
  version: '1.0.0',
  source: '',
  permissions: [],
  published: false,
}

interface ExtensionConsoleLine {
  id: number
  kind: string
  text: string
}

export function ExtensionsPanel() {
  const [extensions, setExtensions] = useState<CodingExtension[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<ExtensionDraft>(emptyDraft)
  const [showCreate, setShowCreate] = useState(false)
  const [activeExtension, setActiveExtension] = useState<CodingExtension | null>(null)
  const [executionId, setExecutionId] = useState(0)
  const [commands, setCommands] = useState<{ id: string; name: string }[]>([])
  const [consoleLines, setConsoleLines] = useState<ExtensionConsoleLine[]>([])
  const [lynoaiInstalled, setLynoaiInstalled] = useState(true)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const activeExtensionRef = useRef<CodingExtension | null>(null)
  const commandCallbacks = useRef(new Map<string, string>())
  const eventSubscriptions = useRef(new Map<string, () => void>())
  const { activeTabId, tabs } = useIdeStore()
  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setExtensions(await loadExtensions())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load extensions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => setLynoaiInstalled(loadLynoaAIExtensionInstalled()), [])

  const toggleLynoAIInstallation = () => {
    const installed = !lynoaiInstalled
    if (!installed && !window.confirm('Uninstall LynoAI from this workspace?')) return
    try {
      saveLynoaAIExtensionInstalled(installed)
      setLynoaiInstalled(installed)
      const settings = useIdeStore.getState().lynoAISettings
      if (settings.enabled !== installed) {
        useIdeStore.getState().updateLynoAISettings({ ...settings, enabled: installed })
      }
      toast.success(installed ? 'LynoAI installed.' : 'LynoAI uninstalled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update LynoAI installation.')
    }
  }

  const stopExtension = useCallback(() => {
    activeExtensionRef.current = null
    setActiveExtension(null)
    setCommands([])
    commandCallbacks.current.clear()
    eventSubscriptions.current.forEach((unsubscribe) => unsubscribe())
    eventSubscriptions.current.clear()
  }, [])

  useEffect(() => {
    if (!activeExtension) return
    const timeout = window.setTimeout(() => {
      toast.error('Extension stopped: execution exceeded 5 seconds.')
      stopExtension()
    }, 5000)
    return () => window.clearTimeout(timeout)
  }, [activeExtension, executionId, stopExtension])

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!frameRef.current?.contentWindow || event.source !== frameRef.current.contentWindow) return
      if (!event.data || typeof event.data !== 'object') return
      const message = event.data as Record<string, unknown>
      if (message.channel !== 'lynora-extension' || typeof message.type !== 'string') return
      const extension = activeExtensionRef.current
      if (!extension) return

      if (message.type === 'ready') {
        const safeSource = JSON.stringify(extension.source).replace(/</g, '\\u003c')
        frameRef.current.contentWindow.postMessage({
          channel: 'lynora-extension-init',
          source: JSON.parse(safeSource) as string,
        }, '*')
      } else if (message.type === 'console') {
        const line = {
          id: Date.now() + Math.random(),
          kind: typeof message.kind === 'string' ? message.kind : 'log',
          text: typeof message.text === 'string' ? message.text.slice(0, 1000) : '',
        }
        setConsoleLines((lines) => [...lines.slice(-79), line])
        ideEventBus.emit('output:line', {
          source: 'extension',
          kind: line.kind === 'error' ? 'error' : line.kind === 'warn' ? 'warning' : 'log',
          text: line.text,
          timestamp: line.id,
        })
      } else if (message.type === 'notify') {
        if (extension.permissions.includes('ui.notify') && typeof message.message === 'string') {
          toast(message.message.slice(0, 300))
        }
      } else if (message.type === 'command-register') {
        if (typeof message.id !== 'string' || typeof message.name !== 'string') return
        const id = message.id.slice(0, 32)
        const name = message.name.trim().slice(0, 60)
        if (!id || !name) return
        commandCallbacks.current.set(id, extension.id)
        setCommands((existing) => [...existing.filter((command) => command.id !== id), { id, name }])
      } else if (message.type === 'subscribe') {
        if (!extension.permissions.includes('workspace.events') || typeof message.event !== 'string') return
        if (!supportedEvents.includes(message.event as keyof IdeEventMap)) return
        if (eventSubscriptions.current.has(message.event)) return
        const eventName = message.event as keyof IdeEventMap
        const callback = (payload: IdeEventMap[typeof eventName]) => {
          frameRef.current?.contentWindow?.postMessage({
            channel: 'lynora-extension',
            type: 'event',
            event: eventName,
            payload,
          }, '*')
        }
        const unsubscribe = ideEventBus.on(eventName, callback)
        eventSubscriptions.current.set(message.event, unsubscribe)
      } else if (message.type === 'rpc') {
        void (async () => {
          const id = typeof message.id === 'string' ? message.id.slice(0, 32) : ''
          const method = typeof message.method === 'string' ? message.method : ''
          const payload = message.payload && typeof message.payload === 'object'
            ? message.payload as Record<string, unknown>
            : {}
          let result: unknown
          let error: string | undefined
          try {
            if (method === 'files.read' && extension.permissions.includes('files.read')) {
              const current = useIdeStore.getState()
              const tab = current.tabs.find((item) => item.id === current.activeTabId)
              if (!tab) throw new Error('No active editor file.')
              result = { path: tab.path, name: tab.name, content: tab.content }
            } else if (method === 'files.write' && extension.permissions.includes('files.write')) {
              if (typeof payload.content !== 'string' || payload.content.length > 1_000_000) {
                throw new Error('File content is invalid or too large.')
              }
              const current = useIdeStore.getState()
              const tab = current.tabs.find((item) => item.id === current.activeTabId)
              if (!tab) throw new Error('No active editor file.')
              if (!window.confirm(`Extension "${extension.name}" wants to replace ${tab.path}. Continue?`)) {
                throw new Error('Write cancelled by user.')
              }
              current.updateTabContent(tab.id, payload.content)
              result = { updated: true, path: tab.path }
            } else {
              throw new Error('Permission denied or unsupported extension API method.')
            }
          } catch (caught) {
            error = caught instanceof Error ? caught.message : String(caught)
          }
          frameRef.current?.contentWindow?.postMessage({
            channel: 'lynora-extension',
            type: 'rpc-result',
            id,
            result,
            error,
          }, '*')
        })()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const create = async () => {
    try {
      const extension = await addExtension(draft)
      setExtensions((existing) => [...existing, { ...extension, owned: true, installed: true }])
      setDraft(emptyDraft)
      setShowCreate(false)
      toast.success('Extension added.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add extension.')
    }
  }

  const toggle = async (extension: CodingExtension) => {
    try {
      await updateExtension(extension.id, { enabled: !extension.enabled })
      setExtensions((existing) => existing.map((item) =>
        item.id === extension.id ? { ...item, enabled: !item.enabled } : item))
      if (extension.enabled && activeExtension?.id === extension.id) stopExtension()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update extension.')
    }
  }

  const publish = async (extension: CodingExtension) => {
    try {
      await updateExtension(extension.id, { published: !extension.published })
      setExtensions((existing) => existing.map((item) =>
        item.id === extension.id ? { ...item, published: !item.published } : item))
      toast.success(extension.published ? 'Extension removed from marketplace.' : 'Extension published.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update publication.')
    }
  }

  const install = async (extension: CodingExtension) => {
    try {
      const installed = await installMarketplaceExtension(extension.id)
      setExtensions((existing) => [
        ...existing.map((item) => item.id === extension.id ? { ...item, installed: true } : item),
        { ...installed, owned: true, installed: true },
      ])
      toast.success(`${extension.name} installed. Review its permissions before enabling it.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to install extension.')
    }
  }

  const remove = async (extension: CodingExtension) => {
    if (!window.confirm(`Remove extension "${extension.name}"?`)) return
    try {
      await removeExtension(extension.id)
      setExtensions((existing) => existing.filter((item) => item.id !== extension.id))
      if (activeExtension?.id === extension.id) stopExtension()
      toast.success('Extension removed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove extension.')
    }
  }

  const run = (extension: CodingExtension) => {
    if (!extension.enabled) {
      toast.error('Enable this extension before running it.')
      return
    }
    if (extension.permissions.length > 0 && !window.confirm(
      `"${extension.name}" requests: ${extension.permissions.join(', ')}. Continue in the sandbox?`,
    )) return
    if (!activeTab) {
      toast.error('Open a file in the editor before running this extension.')
      return
    }
    stopExtension()
    setConsoleLines([])
    setCommands([])
    commandCallbacks.current.clear()
    activeExtensionRef.current = extension
    setExecutionId((id) => id + 1)
    setActiveExtension({ ...extension })
  }

  const marketplace = extensions.filter((item) => item.published && !item.owned)
  const owned = extensions.filter((item) => item.owned)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Extensions</span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void refresh()} title="Refresh marketplace">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCreate(!showCreate)} title="Add extension">
            {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="shrink-0 space-y-2 border-b p-3">
          <Input aria-label="Extension name" placeholder="Extension name" value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <Input aria-label="Extension description" placeholder="Description" value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          <Input aria-label="Extension version" placeholder="Version (1.0.0)" value={draft.version}
            onChange={(event) => setDraft({ ...draft, version: event.target.value })} />
          <Textarea aria-label="Extension JavaScript source" className="min-h-32 font-mono text-xs"
            placeholder={"// Runs in a sandboxed iframe. API: api.getActiveFile(), api.replaceActiveFile(content), api.notify(message), api.on(event, callback), api.registerCommand(name, callback)."}
            value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} />
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-medium"><Shield className="h-3 w-3" />Requested permissions</div>
            {permissionChoices.map(([permission, label]) => (
              <label key={permission} className="flex items-center gap-2 text-[11px]">
                <input type="checkbox" checked={draft.permissions.includes(permission)}
                  onChange={(event) => setDraft({
                    ...draft,
                    permissions: event.target.checked
                      ? [...draft.permissions, permission]
                      : draft.permissions.filter((item) => item !== permission),
                  })} />
                {label}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={draft.published}
              onChange={(event) => setDraft({ ...draft, published: event.target.checked })} />
            Publish to the shared marketplace
          </label>
          <Button size="sm" className="h-7 w-full text-xs" disabled={!draft.name.trim() || !draft.source.trim()}
            onClick={() => void create()}>
            <Upload className="mr-1 h-3 w-3" /> Save extension
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2">
        {loading && <p className="p-2 text-xs text-muted-foreground">Loading extensions…</p>}
        <section className="space-y-2">
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {lynoaiInstalled ? 'Installed' : 'Recommended'}
          </h2>
          <article className="group rounded-lg border bg-card p-3 transition-colors hover:border-emerald-500/40 hover:bg-accent/20">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border bg-background p-1">
                <Image
                  src="/logo_assistant_ia.svg"
                  alt="LynoAI extension icon"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                  style={{ width: 40, height: 40 }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold leading-5">LynoAI</h3>
                <p className="truncate text-[11px] text-muted-foreground">LynoraLink</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  AI coding assistant with inline suggestions, explanations, optimizations, and test generation.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Built-in</span>
                <span aria-hidden="true">·</span>
                <span>{lynoaiInstalled ? 'Installed' : 'Not installed'}</span>
              </div>
              <Button
                size="sm"
                variant={lynoaiInstalled ? 'outline' : 'default'}
                className="h-7 min-w-20 text-[10px]"
                onClick={toggleLynoAIInstallation}
              >
                {lynoaiInstalled ? 'Uninstall' : 'Install'}
              </Button>
            </div>
          </article>
        </section>
        {!loading && owned.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">
            {lynoaiInstalled
              ? 'No additional extensions installed. Add one or browse the marketplace.'
              : 'No installed extensions. Add one or browse the marketplace.'}
          </p>
        )}
        {owned.map((extension) => (
          <article key={extension.id} className="space-y-2 rounded-md border p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-xs font-semibold">{extension.name}</h3>
                <p className="text-[10px] text-muted-foreground">v{extension.version}{extension.published ? ' · Published' : ''}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground"
                title="Remove extension" onClick={() => void remove(extension)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {extension.description && <p className="text-[11px] text-muted-foreground">{extension.description}</p>}
            <div className="flex flex-wrap gap-1">
              {extension.permissions.map((permission) => (
                <span key={permission} className="rounded bg-muted px-1 py-0.5 text-[9px]">{permission}</span>
              ))}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={extension.enabled ? 'secondary' : 'outline'} className="h-7 flex-1 text-[10px]"
                onClick={() => void toggle(extension)}>{extension.enabled ? 'Disable' : 'Enable'}</Button>
              <Button size="sm" variant="outline" className="h-7 flex-1 text-[10px]" disabled={!extension.enabled}
                onClick={() => run(extension)}><Play className="mr-1 h-3 w-3" />Run</Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px]"
                onClick={() => void publish(extension)}>{extension.published ? 'Unpublish' : 'Publish'}</Button>
            </div>
          </article>
        ))}

        <section className="space-y-2 border-t pt-3">
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Marketplace</h2>
          {marketplace.length === 0 && !loading && (
            <p className="p-1 text-[11px] text-muted-foreground">No published extensions are available.</p>
          )}
          {marketplace.map((extension) => (
            <article key={extension.id} className="space-y-1 rounded-md border p-2">
              <h3 className="text-xs font-semibold">{extension.name}</h3>
              <p className="text-[10px] text-muted-foreground">{extension.description || 'No description'} · v{extension.version}</p>
              <Button size="sm" variant="outline" className="h-7 w-full text-[10px]"
                disabled={extension.installed} onClick={() => void install(extension)}>
                <Download className="mr-1 h-3 w-3" />{extension.installed ? 'Installed' : 'Install'}
              </Button>
            </article>
          ))}
        </section>

        {activeExtension && (
          <section className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider">Sandbox · {activeExtension.name}</h2>
              <Button size="icon" variant="ghost" className="h-6 w-6" title="Stop extension" onClick={stopExtension}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <iframe key={executionId} ref={frameRef} title={`Sandbox for ${activeExtension.name}`}
              sandbox="allow-scripts" srcDoc={frameDocument} className="hidden" />
            {commands.map((command) => (
              <Button key={command.id} size="sm" variant="outline" className="h-7 w-full text-[10px]"
                onClick={() => {
                  if (commandCallbacks.current.get(command.id) !== activeExtension.id) return
                  frameRef.current?.contentWindow?.postMessage({
                    channel: 'lynora-extension',
                    type: 'command',
                    id: command.id,
                  }, '*')
                }}>
                <Blocks className="mr-1 h-3 w-3" />{command.name}
              </Button>
            ))}
            <div className="max-h-28 space-y-1 overflow-auto rounded bg-muted p-2 font-mono text-[10px]" aria-live="polite">
              {consoleLines.length === 0 && <p className="text-muted-foreground">Sandbox console is ready.</p>}
              {consoleLines.map((line) => (
                <p key={line.id} className={line.kind === 'error' ? 'text-destructive' : ''}>
                  <span className="opacity-60">[{line.kind}]</span> {line.text}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
