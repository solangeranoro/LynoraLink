'use client'

import { create } from 'zustand'
import { toast } from 'sonner'
import type {
  BottomPanelKey,
  EditorTab,
  IdeOutputEntry,
  PanelKey,
  ProjectFile,
  ProblemDiagnostic,
  TerminalSession,
} from '@/types/ide'
import {
  applyLynoAICodingChanges,
  createWorkspaceFile,
  deleteWorkspaceFile,
  getCodingTeamId,
  importWorkspaceFiles,
  loadWorkspaceFiles,
  replaceWorkspaceFiles,
  saveWorkspaceFile,
  startWorkspaceTerminalSession,
  stopWorkspaceTerminalSession,
  type LynoAICodingChange,
} from '@/lib/workspace-api'
import { flattenProjectFiles } from '@/lib/workspace-files'
import { DEFAULT_EDITOR_SETTINGS, ideEventBus, type EditorSettings } from '@/lib/ide/event-bus'
import { saveEditorSettings } from '@/lib/workspace-api'
import {
  DEFAULT_LYNOAI_SETTINGS,
  saveLynoaAISettings,
  type LynoaAISettings,
} from '@/lib/ide/lynoai-settings'

interface IdeState {
  projectName: string
  files: ProjectFile[]
  workspaceLoading: boolean
  expandedDirs: Set<string>
  selectedFileId: string | null
  tabs: EditorTab[]
  activeTabId: string | null
  editorSelection: { tabId: string; text: string } | null
  queuedLynoAICommand: { id: string; prompt: string; selection: string } | null
  lynoAISettings: LynoaAISettings
  activePanel: PanelKey
  assistantSidebarVisible: boolean
  assistantUnreadResponses: number
  problemsByPath: Record<string, ProblemDiagnostic[]>
  editorRevealRequest: { path: string; line: number; column: number; id: number } | null
  ideOutput: IdeOutputEntry[]
  gitRemoteFiles: { path: string; content: string }[] | null
  bottomPanel: BottomPanelKey | null
  bottomPanelHeight: number
  sidebarVisible: boolean
  settings: EditorSettings
  theme: 'light' | 'dark'
  searchQuery: string
  searchReplaceValue: string
  searchCaseSensitive: boolean
  searchRegex: boolean
  searchWholeWord: boolean
  searchResults: { fileId: string; filePath: string; fileName: string; matches: { line: number; column: number; text: string }[] }[]
  terminals: TerminalSession[]
  activeTerminalId: string | null
  commandPaletteOpen: boolean
  saving: boolean
  lastSaved: number | null

  loadWorkspace: () => Promise<void>
  openFile: (file: ProjectFile) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setEditorSelection: (selection: { tabId: string; text: string } | null) => void
  queueLynoAICommand: (prompt: string, selection?: string) => void
  clearQueuedLynoAICommand: (id: string) => void
  updateLynoAISettings: (settings: LynoaAISettings) => void
  updateTabContent: (tabId: string, content: string) => void
  saveTab: (tabId: string) => Promise<void>
  saveAll: () => Promise<void>
  toggleDir: (path: string) => void
  selectFile: (fileId: string | null) => void
  setActivePanel: (panel: PanelKey) => void
  openPanel: (panel: PanelKey) => void
  setFileProblems: (path: string, problems: ProblemDiagnostic[]) => void
  revealProblemLocation: (path: string, line: number, column: number) => void
  clearEditorRevealRequest: (id: number) => void
  appendIdeOutput: (entry: IdeOutputEntry) => void
  clearIdeOutput: () => void
  setGitRemoteFiles: (files: { path: string; content: string }[] | null) => void
  incrementAssistantUnread: () => void
  setBottomPanel: (panel: BottomPanelKey | null) => void
  setSidebarVisible: (visible: boolean) => void
  toggleSidebar: () => void
  toggleAssistantSidebar: () => void
  toggleTerminal: () => void
  setBottomPanelHeight: (height: number) => void
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
  updateSettings: (settings: EditorSettings) => Promise<void>
  resetSettings: () => Promise<void>
  setSearchQuery: (query: string) => void
  setSearchReplace: (replacement: string) => void
  toggleSearchOption: (option: 'caseSensitive' | 'regex' | 'wholeWord') => void
  runSearch: () => void
  replaceAll: () => void
  addTerminal: () => void
  closeTerminal: (id: string) => void
  setActiveTerminal: (id: string) => void
  startTerminalSession: (id: string, cols: number, rows: number) => Promise<string>
  setTerminalStatus: (id: string, running: boolean, connecting?: boolean) => void
  finishTerminalSession: (id: string) => Promise<void>
  clearTerminal: (id: string) => void
  setCommandPaletteOpen: (open: boolean) => void
  createFile: (parentPath: string, name: string, isDirectory?: boolean) => Promise<void>
  importFiles: (
    files: { path: string; isDirectory: boolean; content: string }[],
    replaceWorkspace?: boolean,
    projectName?: string,
    skippedFiles?: number,
  ) => Promise<void>
  applyLynoAICodingChanges: (changes: LynoAICodingChange[]) => Promise<boolean>
  deleteFile: (path: string) => Promise<void>
}

let idCounter = 0
const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${++idCounter}`
const terminalSessionStarts = new Map<string, Promise<string>>()

const initialTerminal = (): TerminalSession => {
  const id = uid('terminal')
  return {
    id,
    name: `Terminal ${idCounter}`,
    cwd: '/workspace',
    mode: null,
    architecture: null,
    running: false,
    connecting: false,
    connectionId: null,
    clearVersion: 0,
  }
}

const replaceFile = (
  files: ProjectFile[],
  path: string,
  update: (file: ProjectFile) => ProjectFile,
): ProjectFile[] => files.map((file) => {
  if (file.path === path) return update(file)
  return file.children ? { ...file, children: replaceFile(file.children, path, update) } : file
})

const removeFile = (files: ProjectFile[], path: string): ProjectFile[] =>
  files
    .filter((file) => file.path !== path && !file.path.startsWith(`${path}/`))
    .map((file) => file.children ? { ...file, children: removeFile(file.children, path) } : file)

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
let settingsSaveTimer: ReturnType<typeof setTimeout> | undefined

export const useIdeStore = create<IdeState>((set, get) => ({
  projectName: 'LynoraCoding Workspace',
  files: [],
  workspaceLoading: true,
  expandedDirs: new Set(),
  selectedFileId: null,
  tabs: [],
  activeTabId: null,
  editorSelection: null,
  queuedLynoAICommand: null,
  lynoAISettings: DEFAULT_LYNOAI_SETTINGS,
  activePanel: 'explorer',
  assistantSidebarVisible: false,
  assistantUnreadResponses: 0,
  problemsByPath: {},
  editorRevealRequest: null,
  ideOutput: [],
  gitRemoteFiles: null,
  bottomPanel: null,
  bottomPanelHeight: 240,
  sidebarVisible: true,
  settings: DEFAULT_EDITOR_SETTINGS,
  theme: DEFAULT_EDITOR_SETTINGS.theme,
  searchQuery: '',
  searchReplaceValue: '',
  searchCaseSensitive: false,
  searchRegex: false,
  searchWholeWord: false,
  searchResults: [],
  terminals: [initialTerminal()],
  activeTerminalId: null,
  commandPaletteOpen: false,
  saving: false,
  lastSaved: null,

  loadWorkspace: async () => {
    set({ workspaceLoading: true })
    try {
      const workspace = await loadWorkspaceFiles()
      const currentFiles = flattenProjectFiles(workspace.files)
      set((state) => ({
        files: workspace.files,
        projectName: workspace.projectName,
        settings: workspace.settings,
        theme: workspace.settings.theme,
        tabs: state.tabs.map((tab) => {
          const file = currentFiles.find((item) => item.id === tab.fileId)
          return !file || tab.isDirty
            ? tab
            : { ...tab, content: file.content ?? '', originalContent: file.content ?? '' }
        }),
        workspaceLoading: false,
      }))
      ideEventBus.emit('workspace:loaded', { fileCount: currentFiles.filter((file) => !file.isDirectory).length })
    } catch (error) {
      set({ workspaceLoading: false })
      toast.error(error instanceof Error ? error.message : 'Could not load workspace.')
    }
  },

  openFile: (file) => {
    if (file.isDirectory) return
    const existing = get().tabs.find((tab) => tab.fileId === file.id)
    if (existing) {
      set((state) => ({
        tabs: state.tabs.map((tab) => ({ ...tab, isActive: tab.id === existing.id })),
        activeTabId: existing.id,
        selectedFileId: file.id,
      }))
      ideEventBus.emit('editor:active-file-changed', { path: file.path })
      return
    }

    const tab: EditorTab = {
      id: uid('tab'),
      fileId: file.id,
      name: file.name,
      path: file.path,
      language: file.language ?? 'plaintext',
      content: file.content ?? '',
      originalContent: file.content ?? '',
      isDirty: false,
      isActive: true,
    }
    set((state) => ({
      tabs: [...state.tabs.map((item) => ({ ...item, isActive: false })), tab],
      activeTabId: tab.id,
      selectedFileId: file.id,
    }))
    ideEventBus.emit('editor:active-file-changed', { path: file.path })
  },

  closeTab: (tabId) => set((state) => {
    const index = state.tabs.findIndex((tab) => tab.id === tabId)
    if (index < 0) return state
    if (state.tabs[index].isDirty) {
      toast.error('Save or discard your unsaved changes before closing this file.')
      return state
    }
    const tabs = state.tabs.filter((tab) => tab.id !== tabId)
    const activeTabId = state.activeTabId === tabId
      ? tabs[Math.max(0, index - 1)]?.id ?? null
      : state.activeTabId
    return {
      tabs: tabs.map((tab) => ({ ...tab, isActive: tab.id === activeTabId })),
      activeTabId,
      selectedFileId: tabs.find((tab) => tab.id === activeTabId)?.fileId ?? null,
    }
  }),

  setActiveTab: (tabId) => set((state) => ({
    tabs: state.tabs.map((tab) => ({ ...tab, isActive: tab.id === tabId })),
    activeTabId: tabId,
    selectedFileId: state.tabs.find((tab) => tab.id === tabId)?.fileId ?? null,
  })),
  setEditorSelection: (editorSelection) => set({ editorSelection }),
  updateLynoAISettings: (lynoAISettings) => {
    saveLynoaAISettings(lynoAISettings)
    set({ lynoAISettings })
  },
  queueLynoAICommand: (prompt, selection = '') => {
    if (!get().lynoAISettings.enabled) {
      toast.info('Enable LynoaAI in its settings to use AI actions.')
      return
    }
    set({
      assistantSidebarVisible: true,
      assistantUnreadResponses: 0,
      queuedLynoAICommand: { id: uid('lynoai-command'), prompt, selection },
    })
  },
  clearQueuedLynoAICommand: (id) => set((state) => (
    state.queuedLynoAICommand?.id === id ? { queuedLynoAICommand: null } : state
  )),

  updateTabContent: (tabId, content) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.id === tabId
      ? { ...tab, content, isDirty: content !== tab.originalContent }
      : tab),
  })),

  saveTab: async (tabId) => {
    const tab = get().tabs.find((item) => item.id === tabId)
    if (!tab || !tab.isDirty) return
    if (getCodingTeamId()) {
      const savedAt = Date.now()
      set((state) => ({
        files: replaceFile(state.files, tab.path, (file) => ({
          ...file,
          content: tab.content,
          size: tab.content.length,
          updatedAt: savedAt,
        })),
        tabs: state.tabs.map((item) => item.id === tabId
          ? { ...item, originalContent: tab.content, isDirty: item.content !== tab.content }
          : item),
        lastSaved: savedAt,
      }))
      ideEventBus.emit('file:saved', { path: tab.path })
      return
    }
    set({ saving: true })
    try {
      await saveWorkspaceFile(tab.path, tab.content)
      const savedAt = Date.now()
      set((state) => ({
        files: replaceFile(state.files, tab.path, (file) => ({ ...file, content: tab.content, size: tab.content.length, updatedAt: savedAt })),
        tabs: state.tabs.map((item) => item.id === tabId
          ? { ...item, originalContent: tab.content, isDirty: item.content !== tab.content }
          : item),
        lastSaved: savedAt,
        saving: false,
      }))
      ideEventBus.emit('file:saved', { path: tab.path })
    } catch (error) {
      set({ saving: false })
      toast.error(error instanceof Error ? error.message : `Could not save ${tab.path}.`)
    }
  },

  saveAll: async () => {
    const dirtyTabs = get().tabs.filter((tab) => tab.isDirty)
    for (const tab of dirtyTabs) await get().saveTab(tab.id)
  },

  toggleDir: (path) => set((state) => {
    const expandedDirs = new Set(state.expandedDirs)
    if (expandedDirs.has(path)) expandedDirs.delete(path)
    else expandedDirs.add(path)
    return { expandedDirs }
  }),
  selectFile: (selectedFileId) => set({ selectedFileId }),
  setActivePanel: (activePanel) => set(activePanel === 'assistant'
    ? { assistantSidebarVisible: true, assistantUnreadResponses: 0 }
    : { activePanel }),
  openPanel: (activePanel) => set(activePanel === 'assistant'
    ? { assistantSidebarVisible: true, assistantUnreadResponses: 0 }
    : { activePanel, sidebarVisible: true }),
  setFileProblems: (path, problems) => set((state) => {
    const problemsByPath = { ...state.problemsByPath }
    if (problems.length) problemsByPath[path] = problems
    else delete problemsByPath[path]
    return { problemsByPath }
  }),
  revealProblemLocation: (path, line, column) => set({
    editorRevealRequest: { path, line, column, id: Date.now() + Math.random() },
  }),
  clearEditorRevealRequest: (id) => set((state) => (
    state.editorRevealRequest?.id === id ? { editorRevealRequest: null } : state
  )),
  appendIdeOutput: (entry) => set((state) => ({
    ideOutput: [...state.ideOutput.slice(-499), entry],
  })),
  clearIdeOutput: () => set({ ideOutput: [] }),
  setGitRemoteFiles: (gitRemoteFiles) => set({ gitRemoteFiles }),
  incrementAssistantUnread: () => set((state) => ({
    assistantUnreadResponses: state.assistantUnreadResponses + 1,
  })),
  setBottomPanel: (bottomPanel) => set({ bottomPanel }),
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  toggleAssistantSidebar: () => set((state) => ({
    assistantSidebarVisible: !state.assistantSidebarVisible,
    assistantUnreadResponses: state.assistantSidebarVisible ? state.assistantUnreadResponses : 0,
  })),
  toggleTerminal: () => set((state) => ({ bottomPanel: state.bottomPanel ? null : 'terminal' })),
  setBottomPanelHeight: (height) => set({ bottomPanelHeight: Math.max(80, Math.min(600, height)) }),
  toggleTheme: () => {
    const settings: EditorSettings = {
      ...get().settings,
      theme: get().theme === 'dark' ? 'light' : 'dark',
    }
    void get().updateSettings(settings)
  },
  setTheme: (theme) => {
    const settings = { ...get().settings, theme }
    void get().updateSettings(settings)
  },
  updateSettings: async (settings) => {
    set({ settings, theme: settings.theme })
    ideEventBus.emit('settings:changed', { settings })
    if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
    settingsSaveTimer = setTimeout(() => {
      void saveEditorSettings(get().settings).catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Could not save editor settings.')
      })
    }, 300)
  },
  resetSettings: async () => get().updateSettings(DEFAULT_EDITOR_SETTINGS),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchReplace: (searchReplaceValue) => set({ searchReplaceValue }),
  toggleSearchOption: (option) => set((state) => ({
    ...(option === 'caseSensitive' ? { searchCaseSensitive: !state.searchCaseSensitive } : {}),
    ...(option === 'regex' ? { searchRegex: !state.searchRegex } : {}),
    ...(option === 'wholeWord' ? { searchWholeWord: !state.searchWholeWord } : {}),
  })),

  runSearch: () => {
    const { searchQuery, searchCaseSensitive, searchRegex, searchWholeWord, files } = get()
    if (!searchQuery.trim()) {
      set({ searchResults: [] })
      return
    }

    let pattern: RegExp
    try {
      const source = searchRegex ? searchQuery : escapeRegExp(searchQuery)
      pattern = new RegExp(searchWholeWord ? `\\b(?:${source})\\b` : source, searchCaseSensitive ? 'g' : 'gi')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid search expression.')
      return
    }

    const searchResults = flattenProjectFiles(files)
      .filter((file) => !file.isDirectory)
      .map((file) => {
        const matches: { line: number; column: number; text: string }[] = []
        ;(file.content ?? '').split('\n').forEach((line, index) => {
          pattern.lastIndex = 0
          const match = pattern.exec(line)
          if (match) matches.push({ line: index + 1, column: match.index + 1, text: line.trim() })
        })
        return matches.length
          ? { fileId: file.id, filePath: file.path, fileName: file.name, matches }
          : null
      })
      .filter((result): result is NonNullable<typeof result> => result !== null)
    set({ searchResults })
  },

  replaceAll: () => {
    const { searchQuery, searchReplaceValue, searchCaseSensitive, searchRegex, searchWholeWord, tabs } = get()
    if (!searchQuery.trim()) return
    try {
      const source = searchRegex ? searchQuery : escapeRegExp(searchQuery)
      const pattern = new RegExp(searchWholeWord ? `\\b(?:${source})\\b` : source, searchCaseSensitive ? 'g' : 'gi')
      set({ tabs: tabs.map((tab) => ({
        ...tab,
        content: tab.content.replace(pattern, searchReplaceValue),
        isDirty: tab.content.replace(pattern, searchReplaceValue) !== tab.originalContent,
      })) })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid search expression.')
    }
  },

  addTerminal: () => {
    const terminal = initialTerminal()
    set((state) => ({ terminals: [...state.terminals, terminal], activeTerminalId: terminal.id }))
  },
  closeTerminal: (id) => {
    const terminal = get().terminals.find((item) => item.id === id)
    if (terminal?.connectionId && !getCodingTeamId()) {
      void stopWorkspaceTerminalSession(terminal.connectionId).catch((error: unknown) => {
        console.error('Unable to stop a LynoraCoding terminal session:', error)
      })
    }
    set((state) => {
      const terminals = state.terminals.filter((item) => item.id !== id)
      return {
        terminals: terminals.length ? terminals : [initialTerminal()],
        activeTerminalId: state.activeTerminalId === id ? terminals[0]?.id ?? null : state.activeTerminalId,
      }
    })
  },
  setActiveTerminal: (activeTerminalId) => set({ activeTerminalId }),
  startTerminalSession: (id, cols, rows) => {
    const pending = terminalSessionStarts.get(id)
    if (pending) return pending

    const terminal = get().terminals.find((item) => item.id === id)
    if (!terminal) return Promise.reject(new Error('Terminal tab is no longer available.'))
    if (terminal.connectionId) return Promise.resolve(terminal.connectionId)
    if (terminal.connecting) return Promise.reject(new Error('The terminal is already starting.'))
    set((state) => ({
      terminals: state.terminals.map((item) => item.id === id
        ? { ...item, connecting: true }
        : item),
    }))
    const start = (async () => {
      try {
        await get().saveAll()
        if (get().tabs.some((tab) => tab.isDirty)) {
          throw new Error('Save or resolve editor changes before starting the terminal.')
        }
        const result = await startWorkspaceTerminalSession(terminal.cwd, cols, rows)
        if (!get().terminals.some((item) => item.id === id)) {
          if (!getCodingTeamId()) await stopWorkspaceTerminalSession(result.id)
          throw new Error('Terminal tab was closed before the session started.')
        }
        set((state) => ({
          terminals: state.terminals.map((item) => item.id === id
            ? { ...item, connectionId: result.id, cwd: result.cwd, mode: result.mode, architecture: result.architecture, running: result.running, connecting: false }
            : item),
        }))
        return result.id
      } catch (error) {
        set((state) => ({
          terminals: state.terminals.map((item) => item.id === id
            ? { ...item, connecting: false, running: false }
            : item),
        }))
        throw error
      } finally {
        terminalSessionStarts.delete(id)
      }
    })()
    terminalSessionStarts.set(id, start)
    return start
  },
  setTerminalStatus: (id, running, connecting = false) => set((state) => ({
    terminals: state.terminals.map((item) => item.id === id
      ? { ...item, running, connecting }
      : item),
  })),
  finishTerminalSession: async (id) => {
    set((state) => ({
      terminals: state.terminals.map((item) => item.id === id
        ? { ...item, running: false, connecting: false }
        : item),
    }))
    const workspace = await loadWorkspaceFiles()
    const flattenedFiles = flattenProjectFiles(workspace.files)
    set((state) => ({
      files: workspace.files,
      tabs: state.tabs.map((tab) => {
        if (tab.isDirty) return tab
        const file = flattenedFiles.find((item) => item.path === tab.path)
        return !file
          ? tab
          : { ...tab, fileId: file.id, content: file.content ?? '', originalContent: file.content ?? '' }
      }),
    }))
  },
  clearTerminal: (id) => set((state) => ({
    terminals: state.terminals.map((terminal) => terminal.id === id
      ? { ...terminal, clearVersion: terminal.clearVersion + 1 }
      : terminal),
  })),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),

  createFile: async (parentPath, name, isDirectory = false) => {
    try {
      await createWorkspaceFile(parentPath, name.trim(), isDirectory)
      const files = await loadWorkspaceFiles()
      const loadedFiles = files.files
      const path = parentPath ? `${parentPath}/${name.trim()}` : name.trim()
      const created = flattenProjectFiles(loadedFiles).find((file) => file.path === path)
      set((state) => ({
        files: loadedFiles,
        expandedDirs: new Set([...state.expandedDirs, ...(parentPath ? [parentPath] : [])]),
      }))
      ideEventBus.emit('file:created', { path })
      if (created && !created.isDirectory) get().openFile(created)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the file.')
    }
  },

  importFiles: async (importedFiles, replaceWorkspace = false, importedProjectName, skippedFiles = 0) => {
    try {
      let importedCount: number
      if (replaceWorkspace) {
        const result = await replaceWorkspaceFiles(importedFiles, importedProjectName)
        importedCount = result.replaced
      } else {
        const result = await importWorkspaceFiles(importedFiles)
        importedCount = result.imported
      }
      const workspace = await loadWorkspaceFiles()
      const loadedFiles = workspace.files
      const importedDirectories = importedFiles
        .filter((file) => file.isDirectory)
        .map((file) => file.path)
      const firstImportedFile = importedFiles.find((file) => !file.isDirectory)
      set((state) => ({
        files: loadedFiles,
        expandedDirs: replaceWorkspace
          ? new Set(importedDirectories)
          : new Set([...state.expandedDirs, ...importedDirectories]),
        ...(replaceWorkspace
          ? {
              tabs: [],
              activeTabId: null,
              selectedFileId: null,
              projectName: importedProjectName ?? state.projectName,
              problemsByPath: {},
              gitRemoteFiles: null,
            }
          : {}),
      }))
      for (const file of importedFiles) {
        ideEventBus.emit('file:created', { path: file.path })
      }
      if (firstImportedFile) {
        const created = flattenProjectFiles(loadedFiles).find((file) => file.path === firstImportedFile.path)
        if (created) get().openFile(created)
      }
      toast.success(
        `${replaceWorkspace ? 'Loaded' : 'Imported'} ${importedCount} item${importedCount === 1 ? '' : 's'}${replaceWorkspace && importedProjectName ? ` from ${importedProjectName}` : ''}.${skippedFiles ? ` ${skippedFiles} unsupported, binary, large or excluded file(s) were skipped.` : ''}`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import the selected files.')
    }
  },

  applyLynoAICodingChanges: async (changes) => {
    try {
      await applyLynoAICodingChanges(changes)
      const workspace = await loadWorkspaceFiles()
      const loadedFiles = workspace.files
      const flattenedFiles = flattenProjectFiles(loadedFiles)
      const changesByPath = new Map(changes.map((change) => [change.path, change]))
      set((state) => ({
        files: loadedFiles,
        tabs: state.tabs.map((tab) => {
          const change = changesByPath.get(tab.path)
          const file = flattenedFiles.find((item) => item.path === tab.path)
          return change && file
            ? { ...tab, fileId: file.id, content: file.content ?? '', originalContent: file.content ?? '', isDirty: false }
            : tab
        }),
      }))
      for (const change of changes) {
        if (change.expectedUpdatedAt === null) ideEventBus.emit('file:created', { path: change.path })
        else ideEventBus.emit('file:saved', { path: change.path })
      }
      const firstChangedFile = flattenedFiles.find((file) =>
        !file.isDirectory && changesByPath.has(file.path))
      if (firstChangedFile) get().openFile(firstChangedFile)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not apply LynoAI changes.')
      return false
    }
  },

  deleteFile: async (path) => {
    try {
      await deleteWorkspaceFile(path)
      set((state) => ({
        files: removeFile(state.files, path),
        tabs: state.tabs.filter((tab) => tab.path !== path && !tab.path.startsWith(`${path}/`)),
        problemsByPath: Object.fromEntries(Object.entries(state.problemsByPath)
          .filter(([filePath]) => filePath !== path && !filePath.startsWith(`${path}/`))),
      }))
      ideEventBus.emit('file:deleted', { path })
      const activeTabId = get().activeTabId
      if (!get().tabs.some((tab) => tab.id === activeTabId)) {
        const active = get().tabs.at(-1) ?? null
        set({
          activeTabId: active?.id ?? null,
          selectedFileId: active?.fileId ?? null,
          tabs: get().tabs.map((tab) => ({ ...tab, isActive: tab.id === active?.id })),
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not delete ${path}.`)
    }
  },
}))
