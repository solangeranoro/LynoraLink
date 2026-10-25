'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Plus, Trash2, Send, Loader2, Clock, HardDrive, Save, Download, Upload, KeyRound,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ApiResponse } from '@/types/ide'
import { toast } from 'sonner'
import { useIdeStore } from '@/store/ide-store'

interface Header { id: string; key: string; value: string }

interface ApiRequest {
  method: string
  url: string
  headers: Header[]
  body: string
  bodyType: 'json' | 'text' | 'none'
}

type ApiAuth =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }

interface StoredRequest {
  id: string
  name: string
  savedAt: number
  request: ApiRequest
}

interface HistoryEntry {
  id: string
  sentAt: number
  request: ApiRequest
  status: number
  statusText: string
}

const historyStorageKey = 'lynoracoding-api-history-v1'
const collectionStorageKey = 'lynoracoding-api-collection-v1'
const secretHeaderPattern = /auth|cookie|api[-_]?key|token|secret|password/i
const supportedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

function isApiRequest(value: unknown): value is ApiRequest {
  if (!value || typeof value !== 'object') return false
  const request = value as Partial<ApiRequest>
  return typeof request.url === 'string' && request.url.length <= 4096 &&
    typeof request.method === 'string' && supportedMethods.includes(request.method) &&
    Array.isArray(request.headers) && request.headers.length <= 100 &&
    request.headers.every((header) =>
      !!header && typeof header.id === 'string' && typeof header.key === 'string' &&
      typeof header.value === 'string') &&
    typeof request.body === 'string' && request.body.length <= 2_000_000 &&
    (request.bodyType === 'json' || request.bodyType === 'text' || request.bodyType === 'none')
}

function stripSecrets(request: ApiRequest): ApiRequest {
  let safeUrl = request.url
  try {
    const parsed = new URL(request.url)
    parsed.username = ''
    parsed.password = ''
    for (const key of [...parsed.searchParams.keys()]) {
      if (secretHeaderPattern.test(key)) parsed.searchParams.delete(key)
    }
    safeUrl = parsed.toString()
  } catch {
    safeUrl = request.url.replace(/([?&][^=]*(?:auth|token|key|secret|password)[^=]*=)[^&#]*/gi, '$1[REDACTED]')
  }
  return {
    ...request,
    url: safeUrl,
    headers: request.headers
      .filter((header) => !secretHeaderPattern.test(header.key.trim()))
      .map((header) => ({ ...header })),
  }
}

export function ApiTesterPanel() {
  const [req, setReq] = useState<ApiRequest>({
    method: 'GET',
    url: '',
    headers: [{ id: 'h1', key: 'Accept', value: 'application/json' }],
    body: '',
    bodyType: 'none',
  })
  const [resp, setResp] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [auth, setAuth] = useState<ApiAuth>({ type: 'none' })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [savedRequests, setSavedRequests] = useState<StoredRequest[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savedRequestName, setSavedRequestName] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(historyStorageKey)
      const storedCollection = localStorage.getItem(collectionStorageKey)
      if (storedHistory) {
        const parsed: unknown = JSON.parse(storedHistory)
        if (!Array.isArray(parsed)) throw new Error('Invalid API history.')
        setHistory(parsed.filter((entry): entry is HistoryEntry =>
          !!entry && typeof entry === 'object' &&
          typeof entry.id === 'string' && typeof entry.sentAt === 'number' &&
          typeof entry.status === 'number' && typeof entry.statusText === 'string' &&
          isApiRequest(entry.request)).slice(0, 40))
      }
      if (storedCollection) {
        const parsed: unknown = JSON.parse(storedCollection)
        if (!Array.isArray(parsed)) throw new Error('Invalid API collection.')
        setSavedRequests(parsed.filter((entry): entry is StoredRequest =>
          !!entry && typeof entry === 'object' &&
          typeof entry.id === 'string' && typeof entry.name === 'string' &&
          typeof entry.savedAt === 'number' && isApiRequest(entry.request)).slice(0, 100))
      }
    } catch {
      toast.error('Unable to read the API tester data saved in this browser.')
    }
  }, [])

  const persistHistory = (entries: HistoryEntry[]) => {
    setHistory(entries)
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(entries))
    } catch {
      toast.error('Unable to save API request history in this browser.')
    }
  }

  const persistCollection = (entries: StoredRequest[]) => {
    setSavedRequests(entries)
    try {
      localStorage.setItem(collectionStorageKey, JSON.stringify(entries))
    } catch {
      toast.error('Unable to save the API collection in this browser.')
    }
  }

  const requestHistory = (request: ApiRequest, response: ApiResponse) => {
    const entries = [{
      id: crypto.randomUUID(),
      sentAt: Date.now(),
      request: stripSecrets(request),
      status: response.status,
      statusText: response.statusText,
    }, ...history].slice(0, 40)
    persistHistory(entries)
  }

  const send = async () => {
    if (!supportedMethods.includes(req.method)) {
      toast.error('Choose a supported HTTP method.')
      return
    }
    setLoading(true)
    setResp(null)
    const t0 = performance.now()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const target = new URL(req.url)
      if (!['http:', 'https:'].includes(target.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are supported.')
      }
      const controller = new AbortController()
      timeout = setTimeout(() => controller.abort(), 15_000)
      const response = await fetch(target, {
        method: req.method,
        headers: (() => {
          const headers = new Headers(Object.fromEntries(req.headers.filter(h => h.key).map(h => [h.key, h.value])))
          if (req.bodyType === 'json' && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json')
          } else if (req.bodyType === 'text' && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'text/plain')
          }
          if (auth.type === 'bearer' && auth.token) headers.set('Authorization', `Bearer ${auth.token}`)
          if (auth.type === 'basic') {
            const encoded = btoa(Array.from(
              new TextEncoder().encode(`${auth.username}:${auth.password}`),
              (byte) => String.fromCharCode(byte),
            ).join(''))
            headers.set('Authorization', `Basic ${encoded}`)
          }
          return headers
        })(),
        body: !['GET', 'HEAD'].includes(req.method) && req.bodyType !== 'none' && req.body
          ? req.body
          : undefined,
        signal: controller.signal,
      })
      const text = await response.text()
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => { headers[key] = value })
      const responseData: ApiResponse = {
        status: response.status,
        statusText: response.statusText,
        headers,
        body: text,
        time: Math.round(performance.now() - t0),
        size: new Blob([text]).size,
      }
      setResp(responseData)
      requestHistory(req, responseData)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const responseData: ApiResponse = {
        status: 0,
        statusText: message,
        headers: {},
        body: message,
        time: Math.round(performance.now() - t0),
        size: 0,
      }
      setResp(responseData)
      requestHistory(req, responseData)
    } finally {
      if (timeout) clearTimeout(timeout)
      setLoading(false)
    }
  }

  const formatResponseBody = (text: string, contentType = '') => {
    try { return JSON.stringify(JSON.parse(text), null, 2) } catch { /* response is not JSON */ }
    if (!/xml|svg/i.test(contentType) && !text.trimStart().startsWith('<?xml')) return text
    try {
      const document = new DOMParser().parseFromString(text, 'application/xml')
      if (document.documentElement.localName === 'parsererror') return text
      const serialized = new XMLSerializer().serializeToString(document)
      const tokens = serialized.match(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g) ?? []
      let indentation = 0
      return tokens.map((token) => {
        const closing = /^<\//.test(token)
        if (closing) indentation = Math.max(0, indentation - 1)
        const line = `${'  '.repeat(indentation)}${token.trim()}`
        if (/^<[^!?/][^>]*[^/]?>$/.test(token) && !token.endsWith('/>')) indentation += 1
        return line
      }).join('\n')
    } catch {
      return text
    }
  }

  const saveRequest = () => {
    setSavedRequestName('')
    setSaveDialogOpen(true)
  }

  const submitSavedRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = savedRequestName.trim()
    if (!name) return
    persistCollection([{
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 100),
      savedAt: Date.now(),
      request: stripSecrets(req),
    }, ...savedRequests])
    setSaveDialogOpen(false)
  }

  const exportCollection = () => {
    const blob = new Blob([JSON.stringify({ version: 1, requests: savedRequests }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'lynoracoding-api-collection.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importCollection = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > 1_000_000) throw new Error('Collection file is larger than 1 MB.')
      const parsed: unknown = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { requests?: unknown }).requests)) {
        throw new Error('The file is not a supported request collection.')
      }
      const records = (parsed as { requests: unknown[] }).requests
      if (records.length > 100) throw new Error('A collection may contain at most 100 requests.')
      const imported = records.map((entry): StoredRequest | null => {
        if (!entry || typeof entry !== 'object') return null
        const item = entry as Partial<StoredRequest>
        if (!isApiRequest(item.request)) return null
        return {
          id: crypto.randomUUID(),
          name: typeof item.name === 'string' ? item.name.slice(0, 100) : 'Imported request',
          savedAt: Date.now(),
          request: stripSecrets(item.request),
        }
      }).filter((item): item is StoredRequest => item !== null)
      if (imported.length === 0) throw new Error('The file contains no valid API requests.')
      persistCollection([...imported, ...savedRequests].slice(0, 100))
      toast.success(`${imported.length} request${imported.length === 1 ? '' : 's'} imported.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to import this collection.')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const loadRequest = (request: ApiRequest) => {
    setReq(stripSecrets(request))
    setAuth({ type: 'none' })
    setResp(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          API Tester
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Ask LynoAI to analyze the response"
            disabled={!resp}
            onClick={() => resp && useIdeStore.getState().queueLynoAICommand(
              `Analyze this API response. Explain the status and payload, point out likely issues, and suggest next debugging steps. Do not repeat credentials or secrets.\nRequest: ${req.method} ${stripSecrets(req).url}\nStatus: ${resp.status} ${resp.statusText}\nResponse body (may contain sensitive data):\n${resp.body.slice(0, 12_000)}`,
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Save request" onClick={saveRequest}>
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Export collection" onClick={exportCollection}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Import collection" onClick={() => importRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(event) => void importCollection(event.target.files?.[0])} />
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Clear response" onClick={() => setResp(null)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* URL bar */}
      <div className="flex shrink-0 items-center gap-2 border-b p-2">
        <Select
          value={req.method}
          onValueChange={(v) => setReq({ ...req, method: v })}
        >
          <SelectTrigger className="w-24 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={req.url}
          onChange={(e) => setReq({ ...req, url: e.target.value })}
          placeholder="https://api.your-domain.com/endpoint"
          className="flex-1 h-7 text-xs font-mono"
        />
        <Button size="sm" className="h-7 text-xs" onClick={send} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
          Send
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Tabs defaultValue="headers" className="w-full">
          <div className="px-2 pt-2">
            <TabsList className="h-8">
              <TabsTrigger value="headers" className="text-xs">Headers</TabsTrigger>
              <TabsTrigger value="body" className="text-xs">Body</TabsTrigger>
              <TabsTrigger value="auth" className="text-xs">Auth</TabsTrigger>
              <TabsTrigger value="response" className="text-xs">Response</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
              <TabsTrigger value="saved" className="text-xs">Saved</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="headers" className="m-0 p-2 space-y-1.5">
            {req.headers.map((h, idx) => (
              <div key={h.id} className="flex items-center gap-1">
                <Input
                  placeholder="Key"
                  value={h.key}
                  onChange={(e) => {
                    const headers = [...req.headers]
                    headers[idx] = { ...h, key: e.target.value }
                    setReq({ ...req, headers })
                  }}
                  className="flex-1 h-7 text-xs"
                />
                <Input
                  placeholder="Value"
                  value={h.value}
                  onChange={(e) => {
                    const headers = [...req.headers]
                    headers[idx] = { ...h, value: e.target.value }
                    setReq({ ...req, headers })
                  }}
                  className="flex-1 h-7 text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setReq({ ...req, headers: req.headers.filter((x) => x.id !== h.id) })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setReq({ ...req, headers: [...req.headers, { id: `h${Date.now()}`, key: '', value: '' }] })}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Header
            </Button>
          </TabsContent>

          <TabsContent value="auth" className="m-0 space-y-2 p-2">
            <div className="flex items-center gap-1 text-xs font-medium"><KeyRound className="h-3.5 w-3.5" />Authentication</div>
            <Select value={auth.type} onValueChange={(value) => {
              if (value === 'bearer') setAuth({ type: 'bearer', token: '' })
              else if (value === 'basic') setAuth({ type: 'basic', username: '', password: '' })
              else setAuth({ type: 'none' })
            }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No authentication</SelectItem>
                <SelectItem value="bearer">Bearer token</SelectItem>
                <SelectItem value="basic">Basic authentication</SelectItem>
              </SelectContent>
            </Select>
            {auth.type === 'bearer' && (
              <Input type="password" autoComplete="off" placeholder="Bearer token" value={auth.token}
                onChange={(event) => setAuth({ ...auth, token: event.target.value })} />
            )}
            {auth.type === 'basic' && (
              <>
                <Input autoComplete="username" placeholder="Username" value={auth.username}
                  onChange={(event) => setAuth({ ...auth, username: event.target.value })} />
                <Input type="password" autoComplete="new-password" placeholder="Password" value={auth.password}
                  onChange={(event) => setAuth({ ...auth, password: event.target.value })} />
              </>
            )}
            <p className="text-[10px] text-muted-foreground">Credentials are kept in memory and never added to saved requests or history.</p>
          </TabsContent>

          <TabsContent value="history" className="m-0 space-y-1 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Recent requests are stored in this browser without credentials.</span>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => persistHistory([])}>Clear</Button>
            </div>
            {history.map((entry) => (
              <button key={entry.id} className="flex w-full items-center justify-between gap-2 rounded border p-2 text-left text-[10px] hover:bg-muted"
                onClick={() => loadRequest(entry.request)}>
                <span className="shrink-0 font-mono">{entry.request.method}</span>
                <span className="flex-1 truncate font-mono">{entry.request.url || '(empty URL)'}</span>
                <span className="shrink-0">{entry.status || entry.statusText}</span>
              </button>
            ))}
            {history.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No request history yet.</p>}
          </TabsContent>

          <TabsContent value="saved" className="m-0 space-y-1 p-2">
            {savedRequests.map((entry) => (
              <div key={entry.id} className="flex items-center gap-1 rounded border p-2">
                <button className="min-w-0 flex-1 truncate text-left text-[11px] hover:underline"
                  onClick={() => loadRequest(entry.request)}>{entry.name}</button>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Delete saved request"
                  onClick={() => persistCollection(savedRequests.filter((item) => item.id !== entry.id))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {savedRequests.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No saved requests.</p>}
          </TabsContent>

          <TabsContent value="body" className="m-0 p-2 space-y-2">
            <Select
              value={req.bodyType}
              onValueChange={(value) => {
                if (value === 'json' || value === 'text' || value === 'none') {
                  setReq({ ...req, bodyType: value })
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="json">application/json</SelectItem>
                <SelectItem value="text">text/plain</SelectItem>
              </SelectContent>
            </Select>
            {req.bodyType !== 'none' && (
              <Textarea
                value={req.body}
                onChange={(e) => setReq({ ...req, body: e.target.value })}
                placeholder={req.bodyType === 'json' ? '{ "key": "value" }' : 'Raw body'}
                className="min-h-[200px] text-xs font-mono"
              />
            )}
          </TabsContent>

          <TabsContent value="response" className="m-0 p-2 space-y-2">
            {!resp && !loading && (
              <div className="text-center text-xs text-muted-foreground py-12">
                Send a request to see the response here
              </div>
            )}
            {loading && (
              <div className="text-center text-xs text-muted-foreground py-12 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Waiting for response...
              </div>
            )}
            {resp && (
              <>
                <div className="flex items-center gap-3 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-mono ${resp.status >= 200 && resp.status < 300 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-destructive/20 text-destructive'}`}>
                    {resp.status} {resp.statusText}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> {resp.time} ms
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <HardDrive className="h-3 w-3" /> {(resp.size / 1024).toFixed(2)} KB
                  </span>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Response Headers</div>
                  <div className="text-[11px] font-mono bg-muted p-2 rounded max-h-32 overflow-y-auto">
                    {Object.entries(resp.headers).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-emerald-600">{k}:</span> {v}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Response Body</div>
                  <pre className="text-[11px] font-mono bg-muted p-2 rounded max-h-80 overflow-auto whitespace-pre-wrap">
                    {formatResponseBody(resp.body, resp.headers['content-type'])}
                  </pre>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <form onSubmit={submitSavedRequest}>
            <DialogHeader>
              <DialogTitle>Save API Request</DialogTitle>
              <DialogDescription>
                Choose a name for this request. Credentials are not saved.
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              aria-label="Request name"
              className="mt-4"
              maxLength={100}
              onChange={(event) => setSavedRequestName(event.target.value)}
              placeholder="Request name"
              required
              value={savedRequestName}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
