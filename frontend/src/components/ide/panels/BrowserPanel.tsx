'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft, ArrowRight, ExternalLink, Globe2, LockKeyhole, RotateCw, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  requestBrowserContent,
  setBrowserController,
  type BrowserController,
} from '@/lib/ide/browser-api'

function normalizeURL(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Enter a web address to continue.')

  const hasWebProtocol = /^https?:\/\//i.test(trimmed)
  const hostWithPort = /^[\w.-]+:\d+(?:[/?#]|$)/i.test(trimmed)
  const localAddress = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(trimmed)
  if (!hasWebProtocol && /^[a-z][a-z\d+.-]*:/i.test(trimmed) && !hostWithPort) {
    throw new Error('Only HTTP and HTTPS addresses are supported.')
  }

  const address = hasWebProtocol
    ? trimmed
    : `${localAddress ? 'http' : 'https'}://${trimmed}`
  const parsed = new URL(address)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS addresses are supported.')
  }
  return parsed.href
}

export function BrowserPanel() {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const navigate = useCallback((value: string) => {
    const nextURL = normalizeURL(value)
    setError('')
    setAddress(nextURL)
    setUrl(nextURL)
    const nextHistory = [...history.slice(0, historyIndex + 1), nextURL]
    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
  }, [history, historyIndex])

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return
    const nextIndex = historyIndex - 1
    setHistoryIndex(nextIndex)
    setAddress(history[nextIndex])
    setUrl(history[nextIndex])
  }, [history, historyIndex])

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const nextIndex = historyIndex + 1
    setHistoryIndex(nextIndex)
    setAddress(history[nextIndex])
    setUrl(history[nextIndex])
  }, [history, historyIndex])

  const reload = useCallback(() => {
    const frame = frameRef.current
    if (!frame || !url) return
    frame.src = url
  }, [url])

  useEffect(() => {
    const controller: BrowserController = {
      getURL: () => url || null,
      navigate,
      goBack,
      goForward,
      reload,
      getHTML: async () => {
        const html = await requestBrowserContent(frameRef.current, 'get-html')
        if (typeof html !== 'string') throw new Error('The page returned an invalid HTML response.')
        return html
      },
      executeJavaScript: (script) =>
        requestBrowserContent(frameRef.current, 'execute-javascript', script),
    }
    setBrowserController(controller)
    return () => setBrowserController(null)
  }, [goBack, goForward, navigate, reload, url])

  const submitAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      navigate(address)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open this address.')
    }
  }

  const openInNewTab = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background" aria-label="Browser">
      <form
        onSubmit={submitAddress}
        className="flex min-h-14 items-center gap-2 border-b bg-card px-3"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Forward"
            aria-label="Forward"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={!url}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Reload"
            aria-label="Reload"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15">
          <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <input
            ref={addressRef}
            value={address}
            onChange={(event) => {
              setAddress(event.target.value)
              if (error) setError('')
            }}
            placeholder="Enter a URL (https://example.com)"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Web address"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
          />
          <button
            type="submit"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            title="Open address"
            aria-label="Open address"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={openInNewTab}
          disabled={!url}
          className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          title="Open in new tab"
          aria-label="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </form>

      {error && (
        <div role="alert" className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative min-h-0 flex-1 bg-muted/30">
        {url ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <span>Some websites block embedded viewing.</span>
              <button
                type="button"
                onClick={openInNewTab}
                className="shrink-0 font-medium text-emerald-600 hover:text-emerald-700"
              >
                Open in new tab
              </button>
            </div>
            <iframe
              key={url}
              ref={frameRef}
              src={url}
              title="Web page"
              sandbox="allow-scripts allow-forms"
              referrerPolicy="no-referrer"
              className="min-h-0 w-full flex-1 border-0 bg-white"
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-card text-emerald-600 shadow-sm">
              <Globe2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Browse the web</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Enter a website address above to open it securely inside LynoraCoding.
              </p>
            </div>
            <button
              type="button"
              onClick={() => addressRef.current?.focus()}
              className={cn(
                'mt-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white',
                'transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
              )}
            >
              Enter a web address
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
