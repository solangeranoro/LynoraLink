'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUp, Check, Code2, Copy, ExternalLink, FileCode2, History, LoaderCircle, MessageSquarePlus, Play, Square,
  Mic, Pin, PinOff, Settings2, ThumbsDown, ThumbsUp, UserRound, X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CodeRenderer } from '@/components/CodeRenderer'
import {
  loadLynoAICodingProgress,
  loadWorkspaceTerminalPorts,
  pollWorkspaceTerminalSession,
  requestLynoAICodingAgent,
  writeWorkspaceTerminalInput,
  type LynoAICodingChange,
  type LynoAICodingProgressStage,
} from '@/lib/workspace-api'
import { useIdeStore } from '@/store/ide-store'
import { useTranslation } from '@/lib/i18n'
import { ideEventBus } from '@/lib/ide/event-bus'
import { toast } from 'sonner'
import { flattenProjectFiles } from '@/lib/workspace-files'
import type { ProjectFile } from '@/types/ide'
import {
  LogViewer,
  TodoList,
  WorkflowSidebar,
  useWorkflowSteps,
} from './lynoai-workflow'

type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  changes?: LynoAICodingChange[]
  tool?: {
    command: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'dismissed'
    output?: string
    exitCode?: number
    previewUrl?: string
  }
  status?: 'pending' | 'applied' | 'dismissed'
  todos?: string[]
  category?: 'explanation' | 'optimization' | 'generation' | 'correction' | 'general'
  pinned?: boolean
  feedback?: 'up' | 'down'
}

type ChatConversation = {
  id: string
  title: string
  updatedAt: number
  messages: Message[]
}

type MessageFilter = 'all' | 'explanation' | 'optimization' | 'generation' | 'correction'

function changeDiff(change: LynoAICodingChange) {
  const before = change.previousContent === null ? [] : change.previousContent.split('\n')
  const after = change.content.split('\n')
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1

  const beforeEnd = before.length - suffix
  const afterEnd = after.length - suffix
  return [
    ...before.slice(Math.max(0, prefix - 2), prefix).map((line) => ({ marker: ' ', line })),
    ...before.slice(prefix, beforeEnd).map((line) => ({ marker: '-', line })),
    ...after.slice(prefix, afterEnd).map((line) => ({ marker: '+', line })),
    ...before.slice(beforeEnd, Math.min(before.length, beforeEnd + 2)).map((line) => ({ marker: ' ', line })),
  ]
}

function errorText(code: string, isFrench: boolean) {
  if (code === 'LYNOAI_QUOTA_EXCEEDED') {
    return isFrench ? 'Votre quota LynoAI du mois est atteint. Il sera réinitialisé au prochain cycle.' : 'Your monthly LynoAI quota is exhausted. It will reset at the next cycle.'
  }
  if (code === 'AI_NOT_CONFIGURED') {
    return isFrench ? 'Le service LynoAI n’est pas configuré.' : 'LynoAI is not configured.'
  }
  if (code === 'UNAUTHORIZED') {
    return isFrench ? 'Votre session a expiré. Reconnectez-vous.' : 'Your session expired. Please sign in again.'
  }
  if (code === 'AI_PROVIDER_UNAVAILABLE') {
    return isFrench ? 'Le service LynoAI ne répond pas pour le moment. Réessayez.' : 'LynoAI is temporarily unavailable. Please try again.'
  }
  if (code === 'AI_STORAGE_UNAVAILABLE') {
    return isFrench ? 'La réponse LynoAI n’a pas pu être enregistrée. Réessayez.' : 'LynoAI could not save this response. Please try again.'
  }
  if (code === 'VALIDATION') {
    return isFrench ? 'Le message ou le contexte dépasse la limite autorisée.' : 'The message or attached context exceeds the allowed limit.'
  }
  if (code === 'ACTIVE_FILE_CHANGED') {
    return isFrench
      ? 'Le fichier a changé dans l’espace de travail. Rechargez-le avant de demander une modification.'
      : 'This file changed in the workspace. Reload it before asking LynoAI to edit it.'
  }
  if (code === 'ACTIVE_FILE_NOT_FOUND') {
    return isFrench ? 'Le fichier actif est introuvable dans cet espace de travail.' : 'The active file was not found in this workspace.'
  }
  if (code === 'INVALID_AI_CHANGE' || code === 'AI_CHANGE_LIMIT') {
    return isFrench ? 'LynoAI a proposé une modification invalide ou trop volumineuse.' : 'LynoAI proposed an invalid or oversized change.'
  }
  if (code === 'ACTIVE_FILE_NOT_FOUND') {
    return isFrench ? 'Le fichier actif n’existe plus dans cet espace de travail.' : 'The active file no longer exists in this workspace.'
  }
  if (code === 'INVALID_AI_CHANGE' || code === 'AI_CHANGE_LIMIT') {
    return isFrench ? 'La proposition de modification de LynoAI est invalide ou trop volumineuse.' : 'LynoAI returned an invalid or oversized code change.'
  }
  return isFrench ? 'LynoAI est temporairement indisponible. Réessayez.' : 'LynoAI is temporarily unavailable. Please try again.'
}

function findFile(files: ProjectFile[], path: string) {
  return flattenProjectFiles(files).find((file) => file.path === path)
}

function normalizeWorkspacePath(path: string) {
  return path.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '')
}

function projectStartCommand(files: ProjectFile[], tabs: { path: string; content: string }[]) {
  const manifest = findFile(files, 'package.json')
  if (!manifest || manifest.isDirectory) return null

  const content = tabs.find((tab) => tab.path === manifest.path)?.content ?? manifest.content ?? ''
  try {
    const parsed: unknown = JSON.parse(content)
    if (!parsed || typeof parsed !== 'object' || !('scripts' in parsed) ||
      !parsed.scripts || typeof parsed.scripts !== 'object') return null
    const scripts = parsed.scripts as Record<string, unknown>
    const scriptName = ['dev', 'start'].find((name) =>
      typeof scripts[name] === 'string' && scripts[name].trim())
    if (!scriptName) return null

    const script = scripts[scriptName] as string
    const hostArgument = /\bnext(?:\s|$)/i.test(script)
      ? ' -- --hostname 0.0.0.0'
      : /\bvite(?:\s|$)/i.test(script)
        ? ' -- --host 0.0.0.0'
        : ''
    const install = 'if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi'
    return `${install} && npm run ${scriptName}${hostArgument}`
  } catch {
    return null
  }
}

function asksToStartProject(prompt: string) {
  return /(?:d[ée]mar|lanc|start|run|boot|serve|ex[ée]cut)/i.test(prompt) &&
    /(?:projet|project|application|\bapp\b|site|serveur|\bserver\b|en local|locally|development|développement)/i.test(prompt)
}

function waitForProgressPoll(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = window.setTimeout(finish, 500)
    signal.addEventListener('abort', finish, { once: true })
  })
}

export function CodingAssistantPanel() {
  const { locale } = useTranslation()
  const isFrench = locale === 'fr'
  const activeTab = useIdeStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId))
  const projectName = useIdeStore((state) => state.projectName)
  const activeTabId = useIdeStore((state) => state.activeTabId)
  const files = useIdeStore((state) => state.files)
  const problemsByPath = useIdeStore((state) => state.problemsByPath)
  const assistantSidebarVisible = useIdeStore((state) => state.assistantSidebarVisible)
  const applyChanges = useIdeStore((state) => state.applyLynoAICodingChanges)
  const queuedCommand = useIdeStore((state) => state.queuedLynoAICommand)
  const clearQueuedCommand = useIdeStore((state) => state.clearQueuedLynoAICommand)
  const preferences = useIdeStore((state) => state.lynoAISettings)
  const editorTheme = useIdeStore((state) => state.theme)
  const updateSettings = useIdeStore((state) => state.updateLynoAISettings)
  const openFile = useIdeStore((state) => state.openFile)
  const toggleDir = useIdeStore((state) => state.toggleDir)
  const setSidebarVisible = useIdeStore((state) => state.setSidebarVisible)
  const saveTab = useIdeStore((state) => state.saveTab)
  const saveAll = useIdeStore((state) => state.saveAll)
  const incrementAssistantUnread = useIdeStore((state) => state.incrementAssistantUnread)
  const [messages, setMessages] = useState<Message[]>([])
  const [workflowMessageId, setWorkflowMessageId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState('')
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [commandExecuting, setCommandExecuting] = useState(false)
  const [workingProgress, setWorkingProgress] = useState<LynoAICodingProgressStage | null>(null)
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all')
  const [slashOpen, setSlashOpen] = useState(false)
  const [popupContainer, setPopupContainer] = useState<HTMLElement | null>(null)
  const [historyReadyFor, setHistoryReadyFor] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const conversationId = useRef(`coding-${crypto.randomUUID()}`)
  const conversationsRef = useRef<ChatConversation[]>([])
  const popupWindowRef = useRef<Window | null>(null)
  const handledCommandId = useRef<string | null>(null)
  const commandExecutionRef = useRef(false)
  const requestAbortController = useRef<AbortController | null>(null)
  const responseCategory = useRef<Message['category']>('general')
  const {
    steps: workflowSteps,
    todos: workflowTodos,
    logs: workflowLogs,
    start: startWorkflow,
    setStep: setWorkflowStep,
    updateForProgress: updateWorkflowForProgress,
    setPlan: setWorkflowPlan,
    toggleTodo: toggleWorkflowTodo,
    addOutput: addWorkflowOutput,
    allTodosComplete,
  } = useWorkflowSteps()

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  const historyKey = `lynoracoding-lynoai-history-v1:${projectName}`
  useEffect(() => {
    setHistoryReadyFor('')
    setMessages([])
    setConversations([])
    conversationsRef.current = []
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(historyKey) ?? '[]')
      const isMessage = (item: unknown): item is Message => {
        if (!item || typeof item !== 'object') return false
        const candidate = item as Message
        const tool = candidate.tool
        return typeof candidate.id === 'string' &&
          (candidate.role === 'user' || candidate.role === 'assistant') &&
          typeof candidate.text === 'string' &&
          (tool === undefined || (
            !!tool &&
            typeof tool === 'object' &&
            typeof tool.command === 'string' &&
            ['pending', 'running', 'completed', 'failed', 'dismissed'].includes(tool.status) &&
            (tool.output === undefined || typeof tool.output === 'string') &&
            (tool.exitCode === undefined || typeof tool.exitCode === 'number')
          ))
      }
      const normalizeMessages = (value: unknown) => Array.isArray(value)
        ? value.filter(isMessage).slice(-80)
        : []
      let loadedConversations: ChatConversation[] = []
      if (Array.isArray(stored)) {
        const legacyMessages = normalizeMessages(stored)
        if (legacyMessages.length) {
          loadedConversations = [{
            id: `coding-${crypto.randomUUID()}`,
            title: legacyMessages.find((item) => item.role === 'user')?.text.slice(0, 72) || (isFrench ? 'Discussion' : 'Conversation'),
            updatedAt: Date.now(),
            messages: legacyMessages,
          }]
        }
      } else if (stored && typeof stored === 'object' && Array.isArray((stored as { conversations?: unknown }).conversations)) {
        loadedConversations = (stored as { conversations: unknown[] }).conversations
          .filter((item): item is ChatConversation => (
            !!item && typeof item === 'object' &&
            typeof (item as ChatConversation).id === 'string' &&
            typeof (item as ChatConversation).title === 'string' &&
            typeof (item as ChatConversation).updatedAt === 'number'
          ))
          .map((item) => ({ ...item, messages: normalizeMessages(item.messages) }))
          .slice(-50)
      } else if (stored !== null) {
        throw new Error('Invalid LynoaAI project history.')
      }
      const requestedActiveId = stored && typeof stored === 'object' && !Array.isArray(stored)
        ? (stored as { activeId?: unknown }).activeId
        : undefined
      const activeConversation = loadedConversations.find((item) => item.id === requestedActiveId)
        ?? loadedConversations.at(-1)
      const currentId = activeConversation?.id ?? `coding-${crypto.randomUUID()}`
      conversationId.current = currentId
      setActiveConversationId(currentId)
      conversationsRef.current = loadedConversations
      setConversations(loadedConversations)
      setMessages(activeConversation?.messages ?? [])
    } catch (cause) {
      console.error('Unable to load LynoaAI project conversation:', cause)
      toast.error(isFrench ? 'Impossible de charger l’historique LynoaAI de ce projet.' : 'Unable to load LynoaAI history for this project.')
      setMessages([])
      setConversations([])
      conversationsRef.current = []
      conversationId.current = `coding-${crypto.randomUUID()}`
      setActiveConversationId(conversationId.current)
    }
    setHistoryReadyFor(historyKey)
  }, [historyKey, isFrench])

  useEffect(() => {
    if (historyReadyFor !== historyKey) return
    try {
      let storedConversations = conversationsRef.current
      if (messages.length) {
        const id = conversationId.current
        const existing = storedConversations.find((item) => item.id === id)
        const title = existing?.title
          || messages.find((item) => item.role === 'user')?.text.replace(/\s+/g, ' ').slice(0, 72)
          || (isFrench ? 'Nouvelle discussion' : 'New conversation')
        const current: ChatConversation = {
          id,
          title,
          updatedAt: Date.now(),
          messages: messages.slice(-80),
        }
        storedConversations = [...storedConversations.filter((item) => item.id !== id), current]
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .slice(0, 50)
        conversationsRef.current = storedConversations
        setConversations(storedConversations)
      }
      window.localStorage.setItem(historyKey, JSON.stringify({
        activeId: conversationId.current,
        conversations: storedConversations,
      }))
    } catch (cause) {
      console.error('Unable to save LynoaAI project conversation:', cause)
      toast.error(isFrench ? 'Impossible d’enregistrer l’historique LynoaAI.' : 'Unable to save LynoaAI conversation history.')
    }
  }, [historyKey, historyReadyFor, isFrench, messages])

  const openPopup = () => {
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.focus()
      return
    }
    const popup = window.open('', 'lynoai-chat', 'popup=yes,width=440,height=720,resizable=yes')
    if (!popup) {
      toast.error(isFrench ? 'Autorisez les fenêtres contextuelles pour détacher le chat.' : 'Allow pop-ups to detach the chat.')
      return
    }
    popup.document.title = 'LynoaAI'
    const base = popup.document.createElement('base')
    base.href = window.location.origin
    popup.document.head.append(base)
    popup.document.documentElement.className = document.documentElement.className
    popup.document.documentElement.style.height = '100%'
    popup.document.body.className = document.body.className
    popup.document.body.style.height = '100%'
    popup.document.body.style.margin = '0'
    for (const stylesheet of document.querySelectorAll('link[rel="stylesheet"], style')) {
      popup.document.head.append(stylesheet.cloneNode(true))
    }
    popupWindowRef.current = popup
    setPopupContainer(popup.document.body)
    popup.focus()
  }

  const dockChat = () => {
    const popup = popupWindowRef.current
    popupWindowRef.current = null
    setPopupContainer(null)
    if (popup && !popup.closed) popup.close()
  }

  useEffect(() => {
    if (!popupContainer) return
    const monitor = window.setInterval(() => {
      if (popupWindowRef.current?.closed) {
        popupWindowRef.current = null
        setPopupContainer(null)
      }
    }, 500)
    return () => window.clearInterval(monitor)
  }, [popupContainer])

  useEffect(() => () => {
    requestAbortController.current?.abort()
    const popup = popupWindowRef.current
    if (popup && !popup.closed) popup.close()
  }, [])

  const sendPrompt = useCallback(async (
    prompt: string,
    explicitSelection?: string,
    contextOverride?: Message[],
  ) => {
    const rawText = prompt.trim()
    const commandMatch = rawText.match(/^\/(explain|refactor|generate-tests|fix|search|read|navigate|edit|commit|save-all|save|run|start)(?:\s+([\s\S]*))?$/i)
    const command = commandMatch?.[1].toLowerCase()
    const commandText = commandMatch?.[2]?.trim() ?? ''
    let category: Message['category'] = command === 'explain'
      ? 'explanation'
      : command === 'refactor'
        ? 'optimization'
        : command === 'generate-tests'
          ? 'generation'
          : command === 'fix'
            ? 'correction'
          : /test|spec|génér|generate/i.test(rawText)
            ? 'generation'
            : /optim|refactor|improv|restructur/i.test(rawText)
              ? 'optimization'
              : /explain|expliqu|analyse|understand/i.test(rawText)
                ? 'explanation'
                : 'general'
    let commandPrompt = command === 'explain'
      ? `${isFrench ? 'Explique le fichier actif et ses cas limites.' : 'Explain the active file and its edge cases.'}${commandText ? ` ${commandText}` : ''}`
      : command === 'refactor'
        ? `${isFrench ? 'Propose une refactorisation du fichier actif. Retourne les fichiers complets modifiés dans changes pour vérification, sans appliquer les changements.' : 'Suggest a refactor of the active file. Return complete changed files in changes for review, without applying them.'}${commandText ? ` ${commandText}` : ''}`
        : command === 'generate-tests'
          ? `${isFrench ? 'Génère des tests pour le fichier actif.' : 'Generate tests for the active file.'}${commandText ? ` ${commandText}` : ''}`
          : command === 'fix'
            ? `${isFrench ? 'Corrige les erreurs de syntaxe ou de logique du fichier actif. Retourne les fichiers complets corrigés dans changes pour validation, sans les appliquer.' : 'Fix syntax or logic errors in the active file. Return complete corrected files in changes for review, without applying them.'}${commandText ? ` ${commandText}` : ''}`
            : command === 'commit'
              ? `${isFrench ? 'Prépare un message de commit concis (titre et corps) à partir des modifications locales. Ne crée pas de commit et ne pousse rien.' : 'Prepare a concise commit message (title and body) from local changes. Do not create a commit or push anything.'}`
              : rawText
    let text = commandPrompt.trim()
    if (!text || pending || !preferences.enabled) return
    setInput('')
    setSlashOpen(false)
    setError('')
    responseCategory.current = category
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: rawText }])
    setWorkflowMessageId(null)
    setPending(true)
    setWorkingProgress('analyzing')
    startWorkflow(activeTab?.path, rawText)
    const requestId = crypto.randomUUID()
    const controller = new AbortController()
    requestAbortController.current = controller
    try {
      let workspaceState = useIdeStore.getState()
      const workspaceFiles = flattenProjectFiles(workspaceState.files)
      let localReply: string | null = null

      const startCommand = command === 'start' || asksToStartProject(rawText)
        ? projectStartCommand(workspaceState.files, workspaceState.tabs)
        : null
      if (command === 'run' || command === 'start' || startCommand) {
        const proposedCommand = command === 'run' ? commandText : startCommand
        if (!proposedCommand) {
          throw new Error(command === 'run'
            ? (isFrench ? 'Utilisation : /run <commande>' : 'Usage: /run <command>')
            : (isFrench
              ? 'Aucun script npm « dev » ou « start » valide trouvé dans le package.json racine.'
              : 'No valid npm "dev" or "start" script was found in the root package.json.'))
        }
        const todos = [
          isFrench ? 'Vérifier la commande et le dossier de travail' : 'Review the command and working directory',
          isFrench ? 'Confirmer les effets attendus de cette exécution' : 'Confirm the expected effects of this run',
        ]
        setWorkflowStep('read', 'completed', isFrench ? 'Workspace consulté' : 'Workspace inspected')
        setWorkflowStep('analyze', 'completed', isFrench ? 'Commande et contexte vérifiés' : 'Command and context reviewed')
        setWorkflowPlan(todos)
        setWorkflowStep('edit', 'completed', isFrench ? 'Aucune modification demandée' : 'No edits requested')
        setWorkflowStep('execute', 'pending', isFrench ? 'En attente du TODO et de votre confirmation' : 'Awaiting TODO completion and your approval')
        setWorkflowStep('commit', 'pending', isFrench ? 'Aucun commit ne sera créé automatiquement.' : 'No commit will be created automatically.')
        const responseId = crypto.randomUUID()
        setWorkflowMessageId(responseId)
        setMessages((current) => [...current, {
          id: responseId,
          role: 'assistant',
          text: command === 'start' || startCommand
            ? (isFrench
              ? 'J’ai trouvé le script de démarrage du projet. Après confirmation, les dépendances seront installées si nécessaire et le serveur restera actif dans le terminal.'
              : 'I found the project start script. After approval, dependencies will be installed if needed and the server will stay active in the terminal.')
            : (isFrench
              ? 'Cette commande sera exécutée dans le workspace isolé après votre confirmation.'
              : 'This command will run in the isolated workspace after you approve it.'),
          tool: { command: proposedCommand, status: 'pending' },
          todos,
          category,
        }])
        return
      }

      if (command === 'search') {
        if (!commandText) throw new Error(isFrench ? 'Utilisation : /search <mot-clé>' : 'Usage: /search <keyword>')
        const query = commandText.toLocaleLowerCase()
        const unsavedContent = new Map(workspaceState.tabs.map((tab) => [tab.path, tab.content]))
        const matches: string[] = []
        for (const file of workspaceFiles) {
          if (file.isDirectory) continue
          const lines = (unsavedContent.get(file.path) ?? file.content ?? '').split('\n')
          lines.forEach((line, index) => {
            if (line.toLocaleLowerCase().includes(query) && matches.length < 50) {
              matches.push(`- \`${file.path}:${index + 1}\` ${line.trim().slice(0, 180)}`)
            }
          })
          if (matches.length >= 50) break
        }
        localReply = matches.length
          ? `${isFrench ? `Résultats pour « ${commandText} »` : `Results for "${commandText}"`} (${matches.length}${matches.length === 50 ? '+' : ''})\n\n${matches.join('\n')}`
          : (isFrench ? `Aucun résultat pour « ${commandText} ».` : `No results for "${commandText}".`)
      }

      if (command === 'read' || command === 'navigate' || command === 'edit') {
        const targetPath = normalizeWorkspacePath(command === 'edit'
          ? commandText.split(/\s+/, 1)[0] ?? ''
          : commandText)
        if (!targetPath) {
          throw new Error(isFrench ? `Utilisation : /${command} <chemin>` : `Usage: /${command} <path>`)
        }
        const target = findFile(workspaceState.files, targetPath)
        if (!target) throw new Error(isFrench ? `Chemin introuvable : ${targetPath}` : `Path not found: ${targetPath}`)
        if (target.isDirectory) {
          if (command !== 'navigate') {
            throw new Error(isFrench ? 'Cette commande attend un fichier, pas un dossier.' : 'This command expects a file, not a directory.')
          }
          for (const directory of workspaceFiles.filter((file) =>
            file.isDirectory && (file.path === target.path || target.path.startsWith(`${file.path}/`)))) {
            if (!useIdeStore.getState().expandedDirs.has(directory.path)) toggleDir(directory.path)
          }
          setSidebarVisible(true)
          localReply = isFrench ? `Dossier ouvert : \`${target.path}\`.` : `Opened folder: \`${target.path}\`.`
        } else {
          openFile(target)
          if (command === 'navigate') {
            localReply = isFrench ? `Fichier ouvert : \`${target.path}\`.` : `Opened file: \`${target.path}\`.`
          } else if (command === 'read') {
            const content = useIdeStore.getState().tabs.find((tab) => tab.path === target.path)?.content
              ?? target.content ?? ''
            const excerpt = content.slice(0, 12_000)
            const fence = excerpt.includes('```') ? '````' : '```'
            localReply = `**${target.path}**${content.length > excerpt.length ? (isFrench ? ' (contenu tronqué)' : ' (truncated)') : ''}\n\n${fence}${target.language ?? ''}\n${excerpt}\n${fence}`
          } else {
            const requestedChange = commandText.slice(targetPath.length).trim()
            if (!requestedChange) {
              throw new Error(isFrench ? 'Précisez la modification après le chemin du fichier.' : 'Specify the requested change after the file path.')
            }
            commandPrompt = isFrench
              ? `Modifie ${target.path} comme suit : ${requestedChange}. Retourne le fichier complet dans changes pour validation sans appliquer la modification.`
              : `Edit ${target.path} as follows: ${requestedChange}. Return the complete file in changes for review without applying it.`
            text = commandPrompt
          }
        }
      }

      if (command === 'save' || command === 'save-all') {
        const currentTab = workspaceState.tabs.find((tab) => tab.id === workspaceState.activeTabId)
        if (command === 'save' && currentTab) await saveTab(currentTab.id)
        else if (command === 'save-all') await saveAll()
        else throw new Error(isFrench ? 'Aucun fichier actif à enregistrer.' : 'No active file to save.')
        workspaceState = useIdeStore.getState()
        const unsaved = command === 'save'
          ? workspaceState.tabs.some((tab) => tab.id === currentTab?.id && tab.isDirty)
          : workspaceState.tabs.some((tab) => tab.isDirty)
        localReply = unsaved
          ? (isFrench ? 'Certains changements n’ont pas pu être enregistrés. Consultez les erreurs affichées.' : 'Some changes could not be saved. Check the displayed errors.')
          : (isFrench ? 'Fichier(s) enregistré(s).' : 'File(s) saved.')
      }

      if (localReply !== null) {
        setWorkflowStep('read', 'completed', isFrench ? 'Contexte du workspace consulté' : 'Workspace context inspected')
        setWorkflowStep('analyze', 'completed', isFrench ? 'Analyse locale terminée' : 'Local analysis complete')
        setWorkflowPlan([])
        setWorkflowStep('edit', 'completed', isFrench ? 'Aucune modification demandée' : 'No edits requested')
        setWorkflowStep('execute', 'completed', isFrench ? 'Aucune exécution nécessaire' : 'No execution needed')
        setWorkflowStep('commit', 'pending', isFrench ? 'Utilisez /commit pour préparer un message, sans créer de commit.' : 'Use /commit to prepare a message; no commit is created.')
        setMessages((current) => [...current, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: localReply,
          category,
        }])
        return
      }

      if (command === 'fix') {
        category = 'correction'
        const activePath = workspaceState.tabs.find((tab) => tab.id === workspaceState.activeTabId)?.path
        const allProblems = Object.values(workspaceState.problemsByPath).flat()
        const problems = (activePath
          ? allProblems.filter((problem) => problem.path === activePath)
          : allProblems).slice(0, 80)
        commandPrompt += problems.length
          ? `\n\n${isFrench ? 'Diagnostics détectés :' : 'Detected diagnostics:'}\n${problems.map((problem) => `${problem.path}:${problem.line}:${problem.column} [${problem.severity}] ${problem.message}`).join('\n')}`
          : `\n\n${isFrench ? 'Aucun diagnostic automatique disponible ; analyse le fichier actif et corrige les erreurs évidentes.' : 'No automatic diagnostics are available; inspect the active file and fix evident errors.'}`
        text = commandPrompt
      }

      if (command === 'commit') {
        const dirty = workspaceState.tabs.filter((tab) => tab.isDirty).map((tab) => tab.path)
        const remote = workspaceState.gitRemoteFiles
        const remoteByPath = new Map(remote?.map((file) => [file.path, file.content]) ?? [])
        const localByPath = new Map(workspaceState.tabs.map((tab) => [tab.path, tab.content]))
        const changedFiles = remote
          ? workspaceFiles.filter((file) => !file.isDirectory
            && remoteByPath.get(file.path) !== (localByPath.get(file.path) ?? file.content))
          : []
        const changeSummary = changedFiles.slice(0, 8).map((file) => {
          const content = localByPath.get(file.path) ?? file.content ?? ''
          const previousContent = remoteByPath.get(file.path) ?? null
          const summaryLines = changeDiff({
            path: file.path,
            content,
            previousContent,
            summary: '',
            expectedUpdatedAt: null,
          }).filter((line) => line.marker !== ' ').slice(0, 8)
          return `${file.path}\n${summaryLines.map((line) => `${line.marker}${line.line}`).join('\n').slice(0, 700)}`
        })
        commandPrompt += `\n\n${isFrench ? 'Fichiers avec changements non enregistrés :' : 'Files with unsaved editor changes:'} ${dirty.join(', ') || (isFrench ? 'aucun' : 'none')}\n${isFrench ? 'Fichiers différents de la référence distante chargée :' : 'Files differing from loaded remote snapshot:'} ${changedFiles.map((file) => file.path).join(', ') || (remote ? (isFrench ? 'aucun' : 'none') : (isFrench ? 'référence distante non chargée' : 'no remote snapshot loaded'))}\n${isFrench ? 'Extraits des modifications :' : 'Change excerpts:'}\n${changeSummary.join('\n\n') || (isFrench ? 'Aucun diff disponible.' : 'No diff available.')}\n${isFrench ? 'Prépare uniquement un message, sans exécuter Git.' : 'Prepare a message only; do not execute Git.'}`
        text = commandPrompt
      }

      responseCategory.current = category
      workspaceState = useIdeStore.getState()
      const currentTab = workspaceState.tabs.find((tab) => tab.id === workspaceState.activeTabId)
      const selection = explicitSelection ?? (
        workspaceState.editorSelection?.tabId === workspaceState.activeTabId
          ? workspaceState.editorSelection.text
          : ''
      )
      const contextMessages = contextOverride ?? messages
      const context = contextMessages.slice(-8).map((item) => ({
        role: item.role,
        content: `${item.text}${item.tool
          ? `\n\nProposed command: ${item.tool.command}\nCommand result (exit code ${item.tool.exitCode ?? 'not run'}):\n${item.tool.output ?? 'pending user approval'}` 
          : ''}`.slice(0, 1800),
      }))
      void (async () => {
        while (!controller.signal.aborted) {
          await waitForProgressPoll(controller.signal)
          if (controller.signal.aborted) return
          const progress = await loadLynoAICodingProgress(requestId, controller.signal)
          if (progress) {
            setWorkingProgress(progress.stage)
            updateWorkflowForProgress(progress.stage)
            if (['completed', 'failed', 'cancelled'].includes(progress.stage)) return
          }
        }
      })().catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          console.error('Unable to follow LynoAI request progress:', cause)
        }
      })
      const result = await requestLynoAICodingAgent({
        requestId,
        mode: 'chat',
        modelTier: preferences.model,
        message: text,
        conversationId: conversationId.current,
        language: currentTab?.language,
        selection: selection.slice(0, 20_000),
        context,
        locale: isFrench ? 'fr' : 'en',
        activeFile: currentTab ? {
          path: currentTab.path,
          content: currentTab.content,
          savedContent: currentTab.originalContent,
        } : null,
      }, controller.signal)
      const plannedTodos = result.todos.length
        ? result.todos
        : result.changes.length || result.command
          ? [
            isFrench ? 'Vérifier les fichiers concernés et le résultat attendu' : 'Review the affected files and expected outcome',
            ...(result.changes.length
              ? [isFrench ? 'Examiner le diff proposé avant application' : 'Review the proposed diff before applying']
              : []),
            ...(result.command
              ? [isFrench ? 'Vérifier la commande et ses effets avant exécution' : 'Review the command and its effects before execution']
              : []),
          ]
          : []
      setWorkflowStep('read', 'completed', activeTab
        ? `${activeTab.path} · ${activeTab.content.split('\n').length} ${isFrench ? 'lignes' : 'lines'}`
        : (isFrench ? 'Index du workspace consulté' : 'Workspace index inspected'))
      setWorkflowStep('analyze', 'completed', isFrench ? 'Analyse terminée' : 'Analysis complete')
      setWorkflowPlan(plannedTodos)
      setWorkflowStep('edit', result.changes.length ? 'pending' : 'completed', result.changes.length
        ? `${result.changes.length} ${isFrench ? 'fichier(s) proposé(s), en attente de validation' : 'file(s) proposed, awaiting approval'}`
        : (isFrench ? 'Aucune modification de fichier proposée' : 'No file changes proposed'))
      setWorkflowStep('execute', result.command ? 'pending' : 'completed', result.command
        ? (isFrench ? 'Commande en attente de validation et du TODO' : 'Command awaits your approval and TODO checklist')
        : (isFrench ? 'Aucune commande nécessaire' : 'No command needed'))
      setWorkflowStep('commit', command === 'commit' ? 'completed' : 'pending', command === 'commit'
        ? result.reply.slice(0, 150)
        : (isFrench ? 'Préparation via /commit ; aucun commit Git automatique.' : 'Prepare with /commit; no automatic Git commit.'))
      const responseId = crypto.randomUUID()
      setWorkflowMessageId(responseId)
      setMessages((current) => [...current, {
        id: responseId,
        role: 'assistant',
        text: result.reply,
        changes: result.changes,
        todos: plannedTodos,
        tool: result.command ? { command: result.command.command, status: 'pending' } : undefined,
        status: result.changes.length ? 'pending' : undefined,
        category: responseCategory.current,
      }])
      const detachedWindow = popupWindowRef.current
      const detachedChatFocused = Boolean(detachedWindow && !detachedWindow.closed && detachedWindow.document.hasFocus())
      const chatWindowFocused = detachedChatFocused || (!detachedWindow && document.hasFocus())
      const chatWindowVisible = detachedChatFocused || (!detachedWindow && document.visibilityState === 'visible')
      if ((!assistantSidebarVisible && !popupContainer) || !chatWindowFocused || !chatWindowVisible) {
        incrementAssistantUnread()
      }
      if (result.changes.length) {
        toast.success(command === 'fix'
          ? (isFrench ? 'Correction proposée : vérifiez le diff avant application.' : 'Fix proposed: review the diff before applying.')
          : (isFrench ? 'Suggestion générée : vérifiez le diff avant application.' : 'Suggestion generated: review the diff before applying.'))
      } else if (/```/.test(result.reply)) {
        toast.success(isFrench ? 'Suggestion générée par LynoaAI' : 'Suggestion generated by LynoaAI')
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        setWorkingProgress('cancelled')
        setWorkflowStep('analyze', 'failed', isFrench ? 'Analyse interrompue' : 'Analysis cancelled')
        setMessages((current) => [...current, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: isFrench ? 'Travail interrompu à votre demande.' : 'Work stopped at your request.',
          category,
        }])
        setInput(rawText)
        return
      }
      const code = cause instanceof Error ? cause.message : ''
      setWorkflowStep('analyze', 'failed', code || (isFrench ? 'La demande a échoué' : 'Request failed'))
      const fallback = isFrench ? 'LynoAI est temporairement indisponible. Réessayez.' : 'LynoAI is temporarily unavailable. Please try again.'
      const translated = errorText(code, isFrench)
      setError(cause instanceof TypeError
        ? (isFrench ? 'Impossible de joindre LynoAI. Vérifiez votre connexion.' : 'Could not reach LynoAI. Check your connection.')
        : translated === fallback ? (code || fallback) : translated)
      setInput(text)
    } finally {
      requestAbortController.current?.abort()
      requestAbortController.current = null
      setPending(false)
      setWorkingProgress(null)
    }
  }, [activeTab, assistantSidebarVisible, incrementAssistantUnread, isFrench, messages, openFile, pending, popupContainer, preferences.enabled, preferences.model, saveAll, saveTab, setSidebarVisible, startWorkflow, setWorkflowPlan, setWorkflowStep, toggleDir, updateWorkflowForProgress])

  const cancelRequest = () => {
    requestAbortController.current?.abort()
  }

  const runProposedCommand = async (messageId: string, command: string) => {
    if (commandExecutionRef.current) return
    if (messageId !== workflowMessageId || !allTodosComplete) {
      toast.error(isFrench
        ? 'Cochez toutes les tâches du TODO avant d’exécuter la commande.'
        : 'Check every TODO item before running this command.')
      return
    }
    commandExecutionRef.current = true
    setCommandExecuting(true)
    setWorkflowStep('execute', 'running', isFrench ? 'Démarrage de la commande dans le conteneur isolé' : 'Starting command in the isolated container')
    addWorkflowOutput(`$ ${command}`)
    setMessages((current) => current.map((item) => item.id === messageId && item.tool
      ? { ...item, tool: { ...item.tool, status: 'running' } }
      : item))
    try {
      const store = useIdeStore.getState()
      await store.saveAll()
      if (useIdeStore.getState().tabs.some((tab) => tab.isDirty)) {
        throw new Error(isFrench
          ? 'Enregistrez ou résolvez les changements de l’éditeur avant de lancer une commande.'
          : 'Save or resolve editor changes before running a command.')
      }
      store.setBottomPanel('terminal')
      store.addTerminal()
      const terminalId = useIdeStore.getState().activeTerminalId
      if (!terminalId) throw new Error('Unable to create a terminal for LynoAI.')
      const sessionId = await useIdeStore.getState().startTerminalSession(terminalId, 100, 30)
      const exitMarker = `__LYNOAI_EXIT_${crypto.randomUUID().replace(/-/g, '')}__`
      await writeWorkspaceTerminalInput(sessionId, `${command}; printf '\\n${exitMarker}%s\\n' "$?"\r`)

      let cursor = 0
      let output = ''
      let exitCode: number | undefined
      let running = true
      let commandFinished = false
      let previewUrl: string | undefined
      for (let attempt = 0; attempt < 4 && running; attempt += 1) {
        const snapshot = await pollWorkspaceTerminalSession(sessionId, cursor)
        cursor = snapshot.cursor
        output += snapshot.output
        addWorkflowOutput(snapshot.output)
        running = snapshot.running
        const markerMatch = new RegExp(`${exitMarker}(\\d+)`).exec(output)
        if (markerMatch) {
          exitCode = Number(markerMatch[1])
          commandFinished = true
          break
        }
        exitCode = snapshot.exitCode ?? undefined
        if (running) {
          try {
            const ports = await loadWorkspaceTerminalPorts(sessionId)
            const webPort = ports.find((port) => [3000, 3001, 4000, 4173, 4200, 4321, 5000, 5173, 8000, 8080, 8081, 8888, 9000].includes(port.containerPort))
            if (webPort) {
              previewUrl = `http://127.0.0.1:${webPort.hostPort}`
              break
            }
          } catch (error) {
            console.warn('Unable to inspect ports for the LynoAI project process:', error)
          }
        }
      }
      const outputNote = !commandFinished && running
        ? (previewUrl
          ? (isFrench ? '\n\nServeur démarré. Aperçu prêt.' : '\n\nServer started. Preview is ready.')
          : (isFrench ? '\n\nProcessus toujours actif dans le terminal.' : '\n\nProcess is still running in the terminal.'))
        : ''
      const combinedOutput = `${output}${outputNote}`
      const clippedOutput = combinedOutput.length > 12_000
        ? `${combinedOutput.slice(0, 12_000)}\n\n[${isFrench ? 'Sortie tronquée' : 'Output truncated'}]`
        : combinedOutput
      if (previewUrl) useIdeStore.getState().setBottomPanel('ports')
      setWorkflowStep(
        'execute',
        !commandFinished && running ? 'running' : exitCode === 0 ? 'completed' : 'failed',
        !commandFinished && running
          ? (isFrench ? 'Le processus continue dans le terminal.' : 'Process is still running in the terminal.')
          : `${isFrench ? 'Code de sortie' : 'Exit code'}: ${exitCode ?? 'unknown'}`,
      )
      setMessages((current) => current.map((item) => item.id === messageId && item.tool
        ? {
          ...item,
          tool: {
            ...item.tool,
            status: !commandFinished && running ? 'running' : exitCode === 0 ? 'completed' : 'failed',
            output: clippedOutput.replace(new RegExp(`${exitMarker}\\d+\\s*`), ''),
            exitCode,
            previewUrl,
          },
        }
        : item))
    } catch (cause) {
      const errorMessage = cause instanceof Error ? cause.message : 'Unable to run the command.'
      setWorkflowStep('execute', 'failed', errorMessage)
      addWorkflowOutput(errorMessage)
      setMessages((current) => current.map((item) => item.id === messageId && item.tool
        ? { ...item, tool: { ...item.tool, status: 'failed', output: errorMessage } }
        : item))
    } finally {
      commandExecutionRef.current = false
      setCommandExecuting(false)
    }
  }

  const continueAfterCommand = (messageId: string) => {
    const contextMessages = messages.map((item) => {
      if (item.id !== messageId || !item.tool) return item
      return {
        ...item,
        text: `${item.text}\n\n${isFrench ? 'Résultat de la commande' : 'Command result'} (exit code ${item.tool.exitCode ?? 'unknown'}):\n${item.tool.output || (isFrench ? '(aucune sortie)' : '(no output)')}`,
      }
    })
    void sendPrompt(
      isFrench
        ? 'Analyse le résultat de la commande et poursuis la tâche. Si une autre commande est nécessaire, propose-la sans l’exécuter.'
        : 'Analyze the command result and continue the task. If another command is needed, propose it without running it.',
      undefined,
      contextMessages,
    )
  }

  useEffect(() => {
    if (!queuedCommand || pending || handledCommandId.current === queuedCommand.id) return
    handledCommandId.current = queuedCommand.id
    clearQueuedCommand(queuedCommand.id)
    setInput(queuedCommand.prompt)
    void sendPrompt(queuedCommand.prompt, queuedCommand.selection)
  }, [queuedCommand, pending, clearQueuedCommand, sendPrompt])

  const applyProposal = async (messageId: string, changes: LynoAICodingChange[]) => {
    const applied = await applyChanges(changes)
    if (applied) {
      if (messageId === workflowMessageId) {
        setWorkflowStep('edit', 'completed', `${changes.length} ${isFrench ? 'fichier(s) appliqué(s)' : 'file(s) applied'}`)
      }
      setMessages((current) => current.map((message) =>
        message.id === messageId ? { ...message, status: 'applied' } : message))
      const proposal = messages.find((message) => message.id === messageId)
      toast.success(proposal?.category === 'correction'
        ? (isFrench ? 'Correction appliquée.' : 'Correction applied.')
        : (isFrench ? 'Modifications appliquées.' : 'Changes applied.'))
    }
  }

  const togglePinned = (messageId: string) => {
    setMessages((current) => current.map((message) =>
      message.id === messageId ? { ...message, pinned: !message.pinned } : message))
  }

  const setFeedback = (messageId: string, feedback: NonNullable<Message['feedback']>) => {
    setMessages((current) => current.map((message) =>
      message.id === messageId
        ? { ...message, feedback: message.feedback === feedback ? undefined : feedback }
        : message))
    toast.success(isFrench ? 'Merci pour votre retour.' : 'Thanks for your feedback.')
  }

  const visibleMessages = messageFilter === 'all'
    ? messages
    : messages.filter((message, index) => (
      message.role === 'assistant'
        ? message.category === messageFilter
        : messages.slice(index + 1).find((item) => item.role === 'assistant')?.category === messageFilter
    ))

  const progressStages: { stage: LynoAICodingProgressStage; label: string; percent: number }[] = [
    { stage: 'analyzing', label: isFrench ? 'Analyse du projet' : 'Analyzing project', percent: 18 },
    { stage: 'reading', label: isFrench ? 'Lecture des fichiers' : 'Reading files', percent: 38 },
    { stage: 'analyzing_context', label: isFrench ? 'Analyse du code lu' : 'Analyzing file context', percent: 64 },
    { stage: 'editing', label: isFrench ? 'Préparation des modifications' : 'Preparing code changes', percent: 88 },
    { stage: 'preparing_changes', label: isFrench ? 'Finalisation' : 'Finalizing', percent: 96 },
  ]
  const currentProgressStage = workingProgress ?? 'analyzing'
  const currentProgress = progressStages.find((item) => item.stage === currentProgressStage)
    ?? progressStages[0]

  const slashCommands = [
    { command: '/explain', description: isFrench ? 'Expliquer le code actif' : 'Explain the active code' },
    { command: '/refactor', description: isFrench ? 'Proposer une refactorisation' : 'Suggest a refactor' },
    { command: '/generate-tests', description: isFrench ? 'Générer des tests' : 'Generate tests' },
    { command: '/fix', description: isFrench ? 'Corriger les erreurs détectées' : 'Fix detected errors' },
    { command: '/search', description: isFrench ? 'Rechercher dans le projet' : 'Search the workspace' },
    { command: '/read', description: isFrench ? 'Lire un fichier' : 'Read a file' },
    { command: '/navigate', description: isFrench ? 'Ouvrir un fichier ou dossier' : 'Open a file or folder' },
    { command: '/edit', description: isFrench ? 'Modifier un fichier (diff à valider)' : 'Edit a file (review diff)' },
    { command: '/commit', description: isFrench ? 'Préparer un message de commit' : 'Prepare a commit message' },
    { command: '/save', description: isFrench ? 'Enregistrer le fichier actif' : 'Save active file' },
    { command: '/save-all', description: isFrench ? 'Tout enregistrer' : 'Save all files' },
    { command: '/run', description: isFrench ? 'Proposer une commande à exécuter (confirmation requise)' : 'Run a command (approval required)' },
    { command: '/start', description: isFrench ? 'Démarrer le projet (confirmation requise)' : 'Start the project (approval required)' },
  ].filter((item) => item.command.startsWith(input.trim().split(/\s/, 1)[0].toLowerCase()))

  const startNewConversation = () => {
    if (pending) return
    conversationId.current = `coding-${crypto.randomUUID()}`
    setActiveConversationId(conversationId.current)
    setMessages([])
    setError('')
    setInput('')
    setMessageFilter('all')
  }

  const panel = (
    <section className="coding-chat-panel flex h-full min-h-0 flex-col bg-background" aria-label="LynoAI coding assistant">
      <header className="coding-chat-header shrink-0">
        <div className="coding-chat-heading">
          <div className="min-w-0 flex-1">
            <h2>LynoaAI</h2>
            <span className="coding-chat-presence">
              <span />{isFrench ? 'Assistant de code' : 'Coding assistant'}
            </span>
          </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="coding-chat-header-action"
          aria-label={isFrench ? 'Historique des discussions' : 'Chat history'}
          aria-expanded={historyOpen}
          title={isFrench ? 'Historique des discussions' : 'Chat history'}
          onClick={() => setHistoryOpen((open) => !open)}
        >
          <History />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="coding-chat-header-action"
          aria-label={isFrench ? 'Nouvelle discussion' : 'New chat'}
          title={isFrench ? 'Nouvelle discussion' : 'New chat'}
          disabled={pending}
          onClick={startNewConversation}
        >
          <MessageSquarePlus />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="coding-chat-header-action"
          aria-label={popupContainer
            ? (isFrench ? 'Rattacher le chat' : 'Dock chat')
            : (isFrench ? 'Détacher le chat' : 'Detach chat')}
          title={popupContainer
            ? (isFrench ? 'Rattacher le chat' : 'Dock chat')
            : (isFrench ? 'Ouvrir dans une fenêtre' : 'Open in a window')}
          onClick={popupContainer ? dockChat : openPopup}
        >
          <ExternalLink />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="coding-chat-header-action"
          aria-label={isFrench ? 'Paramètres LynoaAI' : 'LynoaAI settings'}
          aria-expanded={settingsOpen}
          title={isFrench ? 'Paramètres LynoaAI' : 'LynoaAI settings'}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Settings2 />
        </Button>
        </div>
        <div className="coding-chat-filter-row">
          <label htmlFor="lynoai-message-filter">
            {isFrench ? 'Afficher' : 'Show'}
          </label>
          <Select
            value={messageFilter}
            onValueChange={(value) => setMessageFilter(value as MessageFilter)}
          >
            <SelectTrigger
              id="lynoai-message-filter"
              aria-label={isFrench ? 'Filtrer les messages' : 'Filter messages'}
              className="coding-chat-filter-trigger"
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              container={popupContainer}
              className="coding-chat-filter-content"
              align="end"
            >
              <SelectItem value="all" className="coding-chat-filter-option">
                {isFrench ? 'Tous les messages' : 'All messages'}
              </SelectItem>
              <SelectItem value="explanation" className="coding-chat-filter-option">
                {isFrench ? 'Explications' : 'Explanations'}
              </SelectItem>
              <SelectItem value="optimization" className="coding-chat-filter-option">
                {isFrench ? 'Optimisations' : 'Optimizations'}
              </SelectItem>
              <SelectItem value="generation" className="coding-chat-filter-option">
                {isFrench ? 'Code généré' : 'Generated code'}
              </SelectItem>
              <SelectItem value="correction" className="coding-chat-filter-option">
                {isFrench ? 'Corrections' : 'Fixes'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {settingsOpen && (
        <div className="coding-lynoai-sidebar-settings">
          <div className="flex items-start gap-2">
            <Settings2 className="mt-0.5 h-4 w-4 text-violet-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{isFrench ? 'Paramètres LynoaAI' : 'LynoaAI settings'}</p>
              <p className="text-[10px] text-muted-foreground">{isFrench ? 'Préférences enregistrées sur cet appareil' : 'Preferences saved on this device'}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSettingsOpen(false)} aria-label={isFrench ? 'Fermer les paramètres' : 'Close settings'}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <label className="coding-lynoai-preference-row">
            <span><strong>{isFrench ? 'Assistant activé' : 'Assistant enabled'}</strong><small>{isFrench ? 'Complétions et actions' : 'Completions and actions'}</small></span>
            <input type="checkbox" checked={preferences.enabled} onChange={(event) => updateSettings({ ...preferences, enabled: event.target.checked })} />
          </label>
          <label className="coding-lynoai-model-row">
            <span><strong>{isFrench ? 'Modèle des complétions inline' : 'Inline completion model'}</strong><small>{isFrench ? 'Rapide ou précis' : 'Fast or precise'}</small></span>
            <Select
              value={preferences.model}
              onValueChange={(value) => updateSettings({
                ...preferences,
                model: value === 'precise' ? 'precise' : 'fast',
              })}
            >
              <SelectTrigger
                aria-label={isFrench ? 'Modèle des complétions inline' : 'Inline completion model'}
                size="sm"
                className="coding-chat-model-trigger"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                container={popupContainer}
                className="coding-chat-filter-content"
                align="end"
              >
                <SelectItem value="fast" className="coding-chat-filter-option">
                  {isFrench ? 'Rapide' : 'Fast'}
                </SelectItem>
                <SelectItem value="precise" className="coding-chat-filter-option">
                  {isFrench ? 'Précis' : 'Precise'}
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          <div className="coding-lynoai-shortcuts">
            <strong>{isFrench ? 'Raccourcis clavier' : 'Keyboard shortcuts'}</strong>
            {([
              ['explain', isFrench ? 'Expliquer' : 'Explain'],
              ['optimize', isFrench ? 'Optimiser' : 'Optimize'],
              ['tests', isFrench ? 'Générer des tests' : 'Generate tests'],
            ] as const).map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <Input aria-label={`${label} shortcut`} value={preferences.shortcuts[key]} onChange={(event) => updateSettings({
                  ...preferences,
                  shortcuts: { ...preferences.shortcuts, [key]: event.target.value },
                })} />
              </label>
            ))}
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="max-h-44 shrink-0 overflow-y-auto border-b bg-muted/20 p-2">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase text-muted-foreground">
            {isFrench ? 'Discussions récentes' : 'Recent conversations'}
          </p>
          {conversations.length ? conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                if (pending) return
                conversationId.current = conversation.id
                setActiveConversationId(conversation.id)
                setMessages(conversation.messages)
                setHistoryOpen(false)
                setError('')
              }}
              className={`block w-full truncate rounded px-2 py-1.5 text-left text-[11px] hover:bg-accent ${
                conversation.id === activeConversationId ? 'bg-accent font-medium' : ''
              }`}
              title={conversation.title}
            >
              {conversation.title || (isFrench ? 'Discussion sans titre' : 'Untitled conversation')}
            </button>
          )) : (
            <p className="px-2 py-2 text-[10px] text-muted-foreground">
              {isFrench ? 'Aucune discussion enregistrée.' : 'No saved conversations yet.'}
            </p>
          )}
        </div>
      )}

      <div className="coding-chat-toolbar shrink-0">
        <button
          type="button"
          disabled={!preferences.enabled || pending}
          onClick={() => void sendPrompt('/explain')}
          className="coding-lynoai-quick-action"
          title={isFrench ? 'Expliquer le fichier actif' : 'Explain active file'}
        >
          {isFrench ? 'Expliquer' : 'Explain'}
        </button>
        <button
          type="button"
          disabled={!preferences.enabled || pending}
          onClick={() => void sendPrompt('/refactor')}
          className="coding-lynoai-quick-action"
          title={isFrench ? 'Proposer une refactorisation' : 'Suggest a refactor'}
        >
          {isFrench ? 'Optimiser' : 'Optimize'}
        </button>
        <button
          type="button"
          disabled={!preferences.enabled || pending}
          onClick={() => void sendPrompt('/fix')}
          className="coding-lynoai-quick-action"
          title={isFrench ? 'Corriger les erreurs détectées' : 'Fix detected errors'}
        >
          {isFrench ? 'Corriger' : 'Fix'}
        </button>
        <button
          type="button"
          disabled={!preferences.enabled || pending}
          onClick={() => void sendPrompt('/generate-tests')}
          className="coding-lynoai-quick-action"
          title={isFrench ? 'Générer des tests' : 'Generate tests'}
        >
          {isFrench ? 'Tests' : 'Tests'}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={preferences.enabled}
          aria-label={isFrench ? 'Activer ou désactiver LynoaAI' : 'Enable or disable LynoaAI'}
          onClick={() => updateSettings({ ...preferences, enabled: !preferences.enabled })}
          className={`ml-auto rounded-full px-2 py-1 text-[9px] font-medium ${
            preferences.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
          }`}
          title={isFrench ? 'Activer ou désactiver LynoaAI' : 'Toggle LynoaAI'}
        >
          <span className="coding-chat-toggle-dot" />
          {preferences.enabled ? (isFrench ? 'Activé' : 'On') : (isFrench ? 'Désactivé' : 'Off')}
        </button>
      </div>

      <div ref={listRef} className="coding-chat-messages min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!settingsOpen && !messages.length && (
          <div className="coding-chat-empty">
            <div className="coding-chat-empty-copy">
              <span>{isFrench ? 'VOTRE PARTENAIRE DE CODE' : 'YOUR CODING PARTNER'}</span>
              <h3>{isFrench ? 'Que souhaitez-vous construire ?' : 'What would you like to build?'}</h3>
              <p>
                {isFrench
                  ? 'Explorez votre projet, comprenez un fichier ou demandez une amélioration.'
                  : 'Explore your project, understand a file, or ask for an improvement.'}
              </p>
            </div>
            {activeTab && (
              <div className="coding-chat-context">
                <FileCode2 />
                <span>{isFrench ? 'Fichier actif' : 'Active file'}</span>
                <code>{activeTab.path}</code>
              </div>
            )}
            <div className="coding-chat-suggestions">
              <span>{isFrench ? 'COMMENCER AVEC' : 'GET STARTED'}</span>
              <div>
                {[
                  {
                    label: isFrench ? 'Expliquer le fichier actif' : 'Explain the active file',
                    prompt: isFrench ? 'Explique le code du fichier actif et ses cas limites.' : 'Explain the active file and its edge cases.',
                  },
                  {
                    label: isFrench ? 'Suggérer une optimisation' : 'Suggest an optimization',
                    prompt: isFrench
                      ? 'Propose une version optimisée du code actif sous forme d’extrait à vérifier. Ne prétends pas modifier le fichier.'
                      : 'Suggest an optimized version of the active code as a snippet for review. Do not claim to modify the file.',
                  },
                  {
                    label: isFrench ? 'Générer des tests' : 'Generate tests',
                    prompt: isFrench ? 'Génère des tests adaptés aux conventions de ce projet.' : 'Generate tests that follow this project’s conventions.',
                  },
                  {
                    label: isFrench ? 'Rechercher dans le projet' : 'Search the project',
                    prompt: isFrench ? 'Aide-moi à trouver où sont définis les principaux flux de ce projet.' : 'Help me find where the main flows in this project are defined.',
                  },
                ].map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    disabled={!preferences.enabled}
                    onClick={() => void sendPrompt(suggestion.prompt)}
                    className="coding-chat-suggestion"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="coding-chat-safety-note">
              <Check />
              {isFrench
                ? 'Vos fichiers ne changent qu’après votre validation.'
                : 'Your files only change after you review and approve.'}
            </p>
          </div>
        )}

        {visibleMessages.map((message) => (
          <article
            key={message.id}
            className={`coding-chat-message flex items-start gap-2.5 py-1 ${
              message.role === 'user' ? 'flex-row-reverse text-right' : ''
            }`}
          >
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
              message.role === 'user'
                ? 'bg-muted text-muted-foreground'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              {message.role === 'assistant'
                ? <span className="coding-chat-assistant-mark" aria-label="LynoaAI">L</span>
                : <UserRound className="h-3.5 w-3.5" aria-hidden="true" />}
            </span>
            <div className={`min-w-0 flex-1 ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
              <div className={`mb-1 text-[11px] font-semibold ${message.role === 'user' ? 'text-right' : ''}`}>
                {message.role === 'assistant' ? 'LynoaAI' : isFrench ? 'Vous' : 'You'}
              </div>
              <div className={`coding-chat-bubble space-y-2 break-words rounded-lg px-3 py-2 text-left text-xs leading-relaxed ${
                message.role === 'user' ? 'is-user' : 'is-assistant'
              } ${message.pinned ? 'ring-1 ring-violet-400/50' : ''}`}>
                {message.role === 'assistant' ? (
                  <ReactMarkdown
                    components={{
                      pre: ({ children }) => <>{children}</>,
                      code: ({ className, children }) => {
                        const source = String(children)
                        const isBlock = Boolean(className) || source.endsWith('\n')
                        if (!isBlock) return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
                        const snippet = source.replace(/\n$/, '')
                        const language = className?.match(/language-([\w-]+)/)?.[1]
                        return (
                          <div className="group relative overflow-hidden rounded-md border bg-slate-950">
                            <div className="flex h-7 items-center justify-end gap-1 border-b border-white/10 px-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[9px] text-slate-200 hover:bg-white/10 hover:text-white"
                                onClick={() => {
                                  void navigator.clipboard.writeText(snippet).then(
                                    () => toast.success(isFrench ? 'Code copié.' : 'Code copied.'),
                                    () => toast.error(isFrench ? 'Impossible de copier le code.' : 'Unable to copy code.'),
                                  )
                                }}
                              >
                                <Copy className="mr-1 h-3 w-3" /> {isFrench ? 'Copier' : 'Copy'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[9px] text-slate-200 hover:bg-white/10 hover:text-white"
                                disabled={!activeTabId}
                                onClick={() => {
                                  if (!activeTabId) return
                                  ideEventBus.emit('editor:insert-text', { tabId: activeTabId, text: snippet })
                                  toast.success(isFrench ? 'Snippet inséré dans l’éditeur.' : 'Snippet inserted into the editor.')
                                }}
                              >
                                <Code2 className="mr-1 h-3 w-3" /> {isFrench ? 'Insérer' : 'Insert'}
                              </Button>
                            </div>
                            <pre
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.setData('text/plain', snippet)
                                event.dataTransfer.effectAllowed = 'copy'
                              }}
                              className="max-h-60 cursor-grab overflow-auto active:cursor-grabbing"
                              title={isFrench ? 'Glissez ce code dans l’éditeur pour l’insérer' : 'Drag this code into the editor to insert it'}
                            >
                              <CodeRenderer code={snippet} language={language} />
                            </pre>
                          </div>
                        )
                      },
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : <p className="whitespace-pre-wrap">{message.text}</p>}
              </div>
              {message.role === 'assistant' && (
                <div className="mt-1 flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={`h-6 w-6 ${message.pinned ? 'text-violet-500' : 'text-muted-foreground'}`}
                    aria-label={message.pinned ? (isFrench ? 'Désépingler la réponse' : 'Unpin response') : (isFrench ? 'Épingler la réponse' : 'Pin response')}
                    title={message.pinned ? (isFrench ? 'Désépingler' : 'Unpin') : (isFrench ? 'Épingler' : 'Pin')}
                    onClick={() => togglePinned(message.id)}
                  >
                    {message.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={`h-6 w-6 ${message.feedback === 'up' ? 'text-emerald-600' : 'text-muted-foreground'}`}
                    aria-label={isFrench ? 'Réponse utile' : 'Helpful response'}
                    title={isFrench ? 'Utile' : 'Helpful'}
                    onClick={() => setFeedback(message.id, 'up')}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={`h-6 w-6 ${message.feedback === 'down' ? 'text-rose-600' : 'text-muted-foreground'}`}
                    aria-label={isFrench ? 'Réponse inutile' : 'Not helpful'}
                    title={isFrench ? 'Pas utile' : 'Not helpful'}
                    onClick={() => setFeedback(message.id, 'down')}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
            {message.role === 'assistant' && message.todos && message.todos.length > 0 && (
              <section className="mr-2 mt-2 rounded-md border border-violet-500/20 bg-violet-500/[0.035] p-2" aria-label="TODO plan">
                <header className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold">
                  <span className="text-[#6a00f4]">TODO</span>
                  <span className="ml-auto text-[9px] font-normal text-muted-foreground">
                    {message.id === workflowMessageId
                      ? `${workflowTodos.filter((todo) => todo.completed).length}/${workflowTodos.length}`
                      : ''}
                  </span>
                </header>
                {message.id === workflowMessageId ? (
                  <TodoList
                    todos={workflowTodos}
                    isFrench={isFrench}
                    onToggle={toggleWorkflowTodo}
                  />
                ) : (
                  <ul className="space-y-1">
                    {message.todos.map((todo) => (
                      <li key={todo} className="text-[10px] leading-relaxed text-muted-foreground">{todo}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {message.tool && (
              <div className="mr-2 mt-2 space-y-2 rounded-md border bg-card p-2">
                <div className="text-[10px] font-medium text-muted-foreground">
                  {isFrench ? 'Commande dans le workspace isolé' : 'Command in isolated workspace'}
                </div>
                <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] text-foreground">
                  {message.tool.command}
                </pre>
                {message.tool.output !== undefined && (
                  <div>
                    <div className="mb-1 text-[10px] text-muted-foreground">
                      {message.tool.status === 'failed'
                        ? (isFrench ? 'Échec' : 'Failed')
                        : `${isFrench ? 'Code de sortie' : 'Exit code'}: ${message.tool.exitCode ?? '—'}`}
                    </div>
                    {message.id === workflowMessageId && workflowLogs.length > 0
                      ? <LogViewer logs={workflowLogs} isFrench={isFrench} />
                      : (
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 font-mono text-[10px]">
                          {message.tool.output || (isFrench ? '(aucune sortie)' : '(no output)')}
                        </pre>
                      )}
                  </div>
                )}
                {message.tool.previewUrl && (
                  <a
                    href={message.tool.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    {isFrench ? 'Ouvrir l’aperçu du projet' : 'Open project preview'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {message.tool.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 flex-1 text-[10px]"
                      disabled={commandExecuting || message.id !== workflowMessageId || !allTodosComplete}
                      onClick={() => void runProposedCommand(message.id, message.tool!.command)}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      {allTodosComplete
                        ? (isFrench ? 'Confirmer et exécuter' : 'Approve & run')
                        : (isFrench ? 'Cochez le TODO pour exécuter' : 'Complete TODO to run')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => setMessages((current) => current.map((item) =>
                        item.id === message.id && item.tool
                          ? { ...item, tool: { ...item.tool, status: 'dismissed' } }
                          : item))}
                    >
                      {isFrench ? 'Refuser' : 'Decline'}
                    </Button>
                  </div>
                )}
                {message.tool.status === 'running' && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground" role="status">
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                    {isFrench ? 'Exécution en cours…' : 'Command is running…'}
                  </div>
                )}
                {message.tool.status === 'dismissed' && (
                  <p className="text-[10px] text-muted-foreground">
                    {isFrench ? 'Commande refusée.' : 'Command declined.'}
                  </p>
                )}
                {(message.tool.status === 'completed' || message.tool.status === 'failed' || message.tool.status === 'running') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-[10px]"
                    onClick={() => continueAfterCommand(message.id)}
                    disabled={pending}
                  >
                    {isFrench ? 'Analyser le résultat avec LynoAI' : 'Continue with LynoAI'}
                  </Button>
                )}
              </div>
            )}
            {message.changes?.map((change) => (
              <details key={change.path} open className="mr-2 overflow-hidden rounded-lg border bg-card">
                <summary className="cursor-pointer px-2.5 py-2 text-[11px]">
                  <span className="font-mono">{change.path}</span>
                  {change.summary && <span className="mt-1 block text-muted-foreground">{change.summary}</span>}
                </summary>
                <div className="max-h-64 overflow-auto border-t bg-muted/30 p-2 font-mono text-[10px] leading-relaxed">
                  {changeDiff(change).map((line, index) => (
                    <div
                      key={`${index}-${line.marker}`}
                      className={line.marker === '+'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : line.marker === '-' ? 'bg-rose-500/10 text-rose-400' : 'text-muted-foreground'}
                    >
                      <span className="mr-2 inline-block w-3 select-none text-right">{line.marker}</span>
                      <span className="whitespace-pre-wrap break-all">{line.line || ' '}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
            {message.status === 'pending' && message.changes?.length ? (
              <div className="mr-2 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  className="h-7 flex-1 text-[10px]"
                  onClick={() => void applyProposal(message.id, message.changes!)}
                >
                  {isFrench ? 'Vérifier et appliquer' : 'Review & apply'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setMessages((current) => current.map((item) =>
                    item.id === message.id ? { ...item, status: 'dismissed' } : item))}
                >
                  {isFrench ? 'Ignorer' : 'Dismiss'}
                </Button>
              </div>
            ) : message.status === 'applied' ? (
              <p className="mr-2 text-right text-[10px] text-emerald-500">
                {isFrench ? 'Modifications appliquées' : 'Changes applied'}
              </p>
            ) : null}
            </div>
          </article>
        ))}

        {messages.length > 0 && visibleMessages.length === 0 && (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            {isFrench ? 'Aucune réponse pour ce filtre.' : 'No responses match this filter.'}
          </p>
        )}

        {pending && (
          <WorkflowSidebar
            steps={workflowSteps}
            todos={workflowTodos}
            logs={workflowLogs}
            isFrench={isFrench}
            onToggleTodo={toggleWorkflowTodo}
          />
        )}
        {error && <p role="alert" className="rounded-md border border-destructive/40 p-2 text-[11px] text-destructive">{error}</p>}
      </div>

      <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (pending) {
          cancelRequest()
          return
        }
        void sendPrompt(input)
      }} className="coding-chat-composer relative shrink-0 p-3">
        {slashOpen && slashCommands.length > 0 && (
          <div className="coding-chat-slash-menu" role="listbox" aria-label={isFrench ? 'Commandes LynoaAI' : 'LynoaAI commands'}>
            {slashCommands.map((item) => (
              <button
                key={item.command}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setInput(`${item.command} `)
                  setSlashOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[10px] hover:bg-accent"
              >
                <code className="font-semibold text-emerald-600">{item.command}</code>
                <span className="truncate text-muted-foreground">{item.description}</span>
              </button>
            ))}
          </div>
        )}
        <div className="coding-chat-composer-box">
        <div className="coding-chat-composer-context">
          <FileCode2 />
          <span>{activeTab ? (isFrench ? 'Fichier actif' : 'Active file') : (isFrench ? 'Contexte du projet' : 'Project context')}</span>
          <code title={activeTab?.path}>
            {activeTab?.path ?? (isFrench ? 'Aucun fichier sélectionné' : 'No file selected')}
          </code>
        </div>
        <Textarea
          aria-label={isFrench ? 'Message à LynoAI' : 'Message LynoAI'}
          className="coding-chat-textarea min-h-[76px] resize-y border-0 bg-transparent text-xs shadow-none focus-visible:ring-0"
          disabled={!preferences.enabled || pending}
          maxLength={4000}
          onChange={(event) => {
            const value = event.target.value
            setInput(value)
            setSlashOpen(/^\/[^\s]*$/.test(value.trimStart()))
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              if (slashOpen && slashCommands.length) {
                event.preventDefault()
                setInput(`${slashCommands[0].command} `)
                setSlashOpen(false)
                return
              }
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={!preferences.enabled
            ? (isFrench ? 'Activez LynoaAI dans ses paramètres pour discuter.' : 'Enable LynoaAI in settings to start chatting.')
            : isFrench ? 'Écrivez une demande ou tapez / pour les commandes…' : 'Ask a question or type / for commands…'}
          value={input}
        />
        <div className="coding-chat-composer-footer">
          <span>{isFrench ? 'Entrée pour envoyer · Maj + Entrée pour une ligne' : 'Enter to send · Shift + Enter for a new line'}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled
              className="coding-chat-mic-button h-7 w-7 shrink-0"
              aria-label={isFrench ? 'Microphone bientôt disponible' : 'Microphone coming soon'}
              title={isFrench ? 'La saisie vocale sera bientôt disponible' : 'Voice input coming soon'}
            >
              <Mic className="h-3.5 w-3.5" />
            </Button>
            {pending ? (
              <Button
                type="button"
                variant="outline"
                className="coding-chat-cancel-button h-8 shrink-0"
                onClick={cancelRequest}
                aria-label={isFrench ? 'Arrêter le travail de LynoAI' : 'Stop LynoAI work'}
                title={isFrench ? 'Arrêter le travail en cours' : 'Stop current work'}
              >
                <Square className="h-3 w-3 fill-current" />
                {isFrench ? 'Arrêter' : 'Stop'}
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!preferences.enabled || !input.trim()}
                className="coding-chat-send-button h-7 w-7 shrink-0"
                aria-label={isFrench ? 'Envoyer le message' : 'Send message'}
                title={isFrench ? 'Envoyer' : 'Send'}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        </div>
        <p className="coding-chat-disclaimer">
          {isFrench ? 'L’IA peut se tromper. Vérifiez les modifications proposées.' : 'AI can make mistakes. Review proposed changes.'}
        </p>
      </form>
    </section>
  )

  return popupContainer ? (
    <>
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
        <ExternalLink className="h-5 w-5 text-emerald-500" />
        <span>{isFrench ? 'Le chat LynoaAI est ouvert dans une fenêtre séparée.' : 'LynoaAI chat is open in a separate window.'}</span>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={dockChat}>
          {isFrench ? 'Rattacher le chat' : 'Dock chat'}
        </Button>
      </div>
      {createPortal(panel, popupContainer)}
    </>
  ) : panel
}
