import type { CodingTerminalPort, ProjectFile } from '@/types/ide'
import { toProjectFiles, type WorkspaceFileRecord } from '@/lib/workspace-files'
import { normalizeEditorSettings, type EditorSettings } from '@/lib/ide/event-bus'
import { isLynoAIQuota, publishLynoAIQuota, type LynoAIQuota } from '@/lib/lynoai-quota'

export interface CodingExtension {
  id: string
  ownerId: string
  slug: string
  name: string
  description: string
  version: string
  permissions: string[]
  source: string
  published: boolean
  enabled: boolean
  owned?: boolean
  installed?: boolean
}

export interface LynoAICodingChange {
  path: string
  content: string
  summary: string
  previousContent: string | null
  expectedUpdatedAt: string | null
}

export interface LynoAICodingCommand {
  command: string
}

export interface LynoAICodingAgentRequest {
  requestId?: string
  mode?: 'chat' | 'complete'
  modelTier?: 'fast' | 'precise'
  message: string
  conversationId: string
  language?: string
  selection?: string
  cursor?: { line: number; column: number }
  context?: { role: 'user' | 'assistant'; content: string }[]
  locale?: 'fr' | 'en'
  activeFile?: { path: string; content: string; savedContent: string } | null
}

export interface LynoAICodingAgentResult {
  reply: string
  explanation: string
  changes: LynoAICodingChange[]
  todos: string[]
  command: LynoAICodingCommand | null
  provider: string
  quota: LynoAIQuota
}

export type LynoAICodingProgressStage =
  | 'analyzing'
  | 'reading'
  | 'analyzing_context'
  | 'editing'
  | 'preparing_changes'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface LynoAICodingProgress {
  stage: LynoAICodingProgressStage
  updatedAt: number
}

export interface CodingTerminalResult {
  output: string
  cwd: string
  exitCode: number
  mode?: 'docker' | 'simulated'
  timedOut?: boolean
}

export interface CodingTerminalSession {
  id: string
  cwd: string
  mode: 'docker' | 'simulated'
  architecture: string
  running: boolean
  exitCode: number | null
  syncError: string | null
  output: string
  cursor: number
}

export async function loadWorkspaceTerminalPorts(
  sessionId: string,
  signal?: AbortSignal,
): Promise<CodingTerminalPort[]> {
  const response = await fetch(
    `/api/coding/terminal/sessions/${encodeURIComponent(sessionId)}/ports`,
    { cache: 'no-store', signal },
  )
  const result = await response.json().catch(() => null) as {
    ports?: CodingTerminalPort[]
    error?: string
  } | null
  if (!response.ok) throw new Error(result?.error ?? `Port forwarding error (${response.status})`)
  if (!result || !Array.isArray(result.ports)) {
    throw new Error('The terminal returned an invalid port list.')
  }
  return result.ports
}

function isLynoAICodingAgentResult(value: unknown): value is LynoAICodingAgentResult {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'reply' in value &&
    typeof value.reply === 'string' &&
    'explanation' in value &&
    typeof value.explanation === 'string' &&
    'provider' in value &&
    typeof value.provider === 'string' &&
    'changes' in value &&
    Array.isArray(value.changes) &&
    value.changes.every((change: unknown) =>
      Boolean(
        change &&
        typeof change === 'object' &&
        'path' in change &&
        typeof change.path === 'string' &&
        'content' in change &&
        typeof change.content === 'string' &&
        'summary' in change &&
        typeof change.summary === 'string' &&
        'previousContent' in change &&
        (typeof change.previousContent === 'string' || change.previousContent === null) &&
        'expectedUpdatedAt' in change &&
        (typeof change.expectedUpdatedAt === 'string' || change.expectedUpdatedAt === null),
      )) &&
      'todos' in value &&
      Array.isArray(value.todos) &&
      value.todos.length <= 8 &&
      value.todos.every((todo: unknown) =>
        typeof todo === 'string' && todo.trim().length > 0 && todo.length <= 180,
      ) &&
      'command' in value &&
    (value.command === null || Boolean(
      value.command &&
      typeof value.command === 'object' &&
      'command' in value.command &&
      typeof value.command.command === 'string' &&
      value.command.command.length > 0 &&
      value.command.command.length <= 4_000,
    )) &&
    'quota' in value &&
    isLynoAIQuota(value.quota),
  )
}

const WORKSPACE_WINDOW_STORAGE_KEY = 'lynoracoding-window-workspace-id'
const WORKSPACE_WINDOW_CHANNEL_NAME = 'lynoracoding-window-workspace'
const workspaceWindowGlobal = globalThis as typeof globalThis & {
  __lynoraCodingWorkspaceWindow?: {
    idPromise: Promise<string> | null
    channel: BroadcastChannel | null
  }
}
const workspaceWindowState = workspaceWindowGlobal.__lynoraCodingWorkspaceWindow ??=
  { idPromise: null, channel: null }

export function getCodingTeamId(): string | null {
  if (typeof window === 'undefined') return null
  const teamId = new URLSearchParams(window.location.search).get('teamId')
  return teamId && /^[a-zA-Z0-9_-]{1,64}$/.test(teamId) ? teamId : null
}

async function getWorkspaceWindowId(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('The coding workspace is only available in a browser window.')
  }
  if (workspaceWindowState.idPromise) return workspaceWindowState.idPromise

  workspaceWindowState.idPromise = (async () => {
    const channel = workspaceWindowState.channel ??= typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(WORKSPACE_WINDOW_CHANNEL_NAME)
    let windowId = window.sessionStorage.getItem(WORKSPACE_WINDOW_STORAGE_KEY)

    if (windowId && channel) {
      const duplicateWindow = await new Promise<boolean>((resolve) => {
        let duplicate = false
        const onMessage = (event: MessageEvent<{ type?: string; windowId?: string }>) => {
          if (event.data?.windowId !== windowId) return
          if (event.data.type === 'probe') {
            channel.postMessage({ type: 'active', windowId })
          } else if (event.data.type === 'active') {
            duplicate = true
          }
        }
        channel.addEventListener('message', onMessage)
        channel.postMessage({ type: 'probe', windowId })
        window.setTimeout(() => {
          channel.removeEventListener('message', onMessage)
          resolve(duplicate)
        }, 100)
      })
      if (duplicateWindow) windowId = null
    }

    if (!windowId) windowId = crypto.randomUUID()
    window.sessionStorage.setItem(WORKSPACE_WINDOW_STORAGE_KEY, windowId)
    channel?.addEventListener('message', (event: MessageEvent<{ type?: string; windowId?: string }>) => {
      if (event.data?.type === 'probe' && event.data.windowId === windowId) {
        channel.postMessage({ type: 'active', windowId })
      }
    })
    return windowId
  })()

  return workspaceWindowState.idPromise
}

export async function codingWorkspaceHeaders(): Promise<Record<string, string>> {
  const teamId = getCodingTeamId()
  return {
    'X-Lynora-Coding-Workspace': await getWorkspaceWindowId(),
    ...(teamId ? { 'X-Lynora-Coding-Team': teamId } : {}),
  }
}

export async function createCodingCollaborationSession(
  teamId: string,
  filePath: string,
): Promise<{
  ticket: string
  role: 'LEADER' | 'CONTRIBUTOR' | 'OBSERVER'
  user: { id: string; name: string }
  websocketUrl: string
}> {
  const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/coding/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  })
  const result = await response.json().catch(() => null) as {
    ticket?: string
    role?: 'LEADER' | 'CONTRIBUTOR' | 'OBSERVER'
    user?: { id: string; name: string }
    websocketUrl?: string
    error?: string
  } | null
  if (!response.ok) throw new Error(result?.error ?? `Collaboration error (${response.status})`)
  if (!result?.ticket || !result.role || !result.user || !result.websocketUrl) {
    throw new Error('The collaboration service returned an invalid session.')
  }
  return result as {
    ticket: string
    role: 'LEADER' | 'CONTRIBUTOR' | 'OBSERVER'
    user: { id: string; name: string }
    websocketUrl: string
  }
}

async function request<T>(init?: RequestInit): Promise<T> {
  const workspaceHeaders = await codingWorkspaceHeaders()
  const response = await fetch('/api/coding', {
    ...init,
    headers: {
      ...workspaceHeaders,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const result = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) {
    throw new Error(result?.error ?? `Workspace API error (${response.status})`)
  }
  return result as T
}

async function requestExtensions<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const result = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(result?.error ?? `Extensions API error (${response.status})`)
  return result as T
}

export async function loadWorkspaceFiles(): Promise<{
  files: ProjectFile[]
  settings: EditorSettings
  projectName: string
}> {
  const result = await request<{
    files: WorkspaceFileRecord[]
    settings: unknown
    workspace: { name: string }
  }>()
  return {
    files: toProjectFiles(result.files),
    settings: normalizeEditorSettings(result.settings),
    projectName: result.workspace.name,
  }
}

export async function saveEditorSettings(settings: EditorSettings): Promise<void> {
  await request({ method: 'PATCH', body: JSON.stringify({ settings }) })
}

export async function replaceWorkspaceFiles(
  files: { path: string; isDirectory: boolean; content: string }[],
  projectName?: string,
): Promise<{ replaced: number }> {
  return request<{ replaced: number }>({
    method: 'PUT',
    body: JSON.stringify({ files, ...(projectName ? { projectName } : {}) }),
  })
}

export async function runWorkspaceTerminalCommand(command: string, cwd: string): Promise<CodingTerminalResult> {
  const workspaceHeaders = await codingWorkspaceHeaders()
  const response = await fetch('/api/coding/terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...workspaceHeaders },
    body: JSON.stringify({ command, cwd }),
  })
  const result = await response.json().catch(() => null) as (CodingTerminalResult & { error?: string }) | null
  if (!response.ok) {
    throw new Error(result?.error ?? `Terminal error (${response.status})`)
  }
  if (!result) throw new Error('The terminal returned an invalid response.')
  return result
}

export async function startWorkspaceTerminalSession(
  cwd: string,
  cols: number,
  rows: number,
): Promise<CodingTerminalSession> {
  const workspaceHeaders = await codingWorkspaceHeaders()
  const response = await fetch('/api/coding/terminal/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...workspaceHeaders },
    body: JSON.stringify({ cwd, cols, rows }),
  })
  const result = await response.json().catch(() => null) as (CodingTerminalSession & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? `Terminal error (${response.status})`)
  if (!result) throw new Error('The terminal returned an invalid response.')
  return result
}

export async function pollWorkspaceTerminalSession(
  sessionId: string,
  cursor: number,
  signal?: AbortSignal,
): Promise<CodingTerminalSession> {
  const workspaceHeaders = await codingWorkspaceHeaders()
  const response = await fetch(
    `/api/coding/terminal/sessions/${encodeURIComponent(sessionId)}?cursor=${cursor}`,
    { cache: 'no-store', signal, headers: workspaceHeaders },
  )
  const result = await response.json().catch(() => null) as (CodingTerminalSession & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? `Terminal error (${response.status})`)
  if (!result) throw new Error('The terminal returned an invalid response.')
  return result
}

export async function writeWorkspaceTerminalInput(sessionId: string, data: string): Promise<void> {
  const workspaceHeaders = await codingWorkspaceHeaders()
  for (let offset = 0; offset < data.length; offset += 48_000) {
    const response = await fetch(`/api/coding/terminal/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...workspaceHeaders },
      body: JSON.stringify({ action: 'input', data: data.slice(offset, offset + 48_000) }),
    })
    const result = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) throw new Error(result?.error ?? `Terminal input error (${response.status})`)
  }
}

export async function resizeWorkspaceTerminal(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  const workspaceHeaders = await codingWorkspaceHeaders()
  const response = await fetch(`/api/coding/terminal/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...workspaceHeaders },
    body: JSON.stringify({ action: 'resize', cols, rows }),
  })
  const result = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(result?.error ?? `Terminal resize error (${response.status})`)
}

export async function stopWorkspaceTerminalSession(sessionId: string): Promise<void> {
  const workspaceHeaders = await codingWorkspaceHeaders()
  const response = await fetch(`/api/coding/terminal/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: workspaceHeaders,
  })
  const result = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok && response.status !== 404) {
    throw new Error(result?.error ?? `Terminal stop error (${response.status})`)
  }
}

export async function loadExtensions(): Promise<CodingExtension[]> {
  const result = await requestExtensions<{ extensions: CodingExtension[] }>('/api/coding/extensions')
  return result.extensions
}

export async function addExtension(input: {
  name: string
  description: string
  version: string
  permissions: string[]
  source: string
  published?: boolean
}): Promise<CodingExtension> {
  const result = await requestExtensions<{ extension: CodingExtension }>('/api/coding/extensions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.extension
}

export async function installMarketplaceExtension(marketplaceId: string): Promise<CodingExtension> {
  const result = await requestExtensions<{ extension: CodingExtension }>('/api/coding/extensions', {
    method: 'POST',
    body: JSON.stringify({ marketplaceId }),
  })
  return result.extension
}

export async function updateExtension(
  id: string,
  changes: { enabled?: boolean; published?: boolean },
): Promise<void> {
  await requestExtensions(`/api/coding/extensions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

export async function removeExtension(id: string): Promise<void> {
  await requestExtensions(`/api/coding/extensions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function createWorkspaceFile(
  parentPath: string,
  name: string,
  isDirectory: boolean,
): Promise<void> {
  await request({
    method: 'POST',
    body: JSON.stringify({ parentPath, name, isDirectory }),
  })
}

export async function importWorkspaceFiles(
  files: { path: string; isDirectory: boolean; content: string }[],
): Promise<{ imported: number }> {
  return request<{ imported: number }>({
    method: 'POST',
    body: JSON.stringify({ files }),
  })
}

export async function applyLynoAICodingChanges(
  changes: Pick<LynoAICodingChange, 'path' | 'content' | 'expectedUpdatedAt'>[],
): Promise<void> {
  const workspaceHeaders = await codingWorkspaceHeaders()
  const response = await fetch('/api/ai/coding/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...workspaceHeaders },
    body: JSON.stringify({ changes }),
  })
  const result = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(result?.error ?? `LynoAI apply error (${response.status})`)
}

export async function requestLynoAICodingAgent(
  payload: LynoAICodingAgentRequest,
  signal?: AbortSignal,
): Promise<LynoAICodingAgentResult> {
  const workspaceHeaders = await codingWorkspaceHeaders()
  const response = await fetch('/api/ai/coding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...workspaceHeaders },
    body: JSON.stringify(payload),
    signal,
  })
  const result = await response.json().catch(() => null) as (Partial<LynoAICodingAgentResult> & { error?: string }) | null
  if (isLynoAIQuota(result?.quota)) publishLynoAIQuota(result.quota)
  if (!response.ok) throw new Error(result?.error ?? `LynoAI coding error (${response.status})`)
  if (!isLynoAICodingAgentResult(result)) {
    throw new Error('LynoAI returned an invalid coding-agent response.')
  }
  return result
}

export async function loadLynoAICodingProgress(
  requestId: string,
  signal?: AbortSignal,
): Promise<LynoAICodingProgress | null> {
  const response = await fetch(`/api/ai/coding/progress/${encodeURIComponent(requestId)}`, {
    cache: 'no-store',
    signal,
  })
  if (response.status === 204) return null
  const result = await response.json().catch(() => null) as (LynoAICodingProgress & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? `LynoAI progress error (${response.status})`)
  if (!result || typeof result.stage !== 'string' || typeof result.updatedAt !== 'number') {
    throw new Error('LynoAI returned an invalid progress update.')
  }
  return result
}

export async function saveWorkspaceFile(path: string, content: string): Promise<void> {
  await request({
    method: 'PATCH',
    body: JSON.stringify({ path, content }),
  })
}

export async function deleteWorkspaceFile(path: string): Promise<void> {
  await request({
    method: 'DELETE',
    body: JSON.stringify({ path }),
  })
}
