'use client'

/**
 * LynoraCoding — Public API
 * --------------------------------
 * Surface exposed on `window.LynoraIDE` so that LynoraLink can later embed
 * LynoraCoding as a workspace section and drive it programmatically.
 *
 * This is the single integration point — no other module should reach into
 * the store directly from outside the editor bundle.
 */

import { useIdeStore } from '@/store/ide-store'
import { ProjectFile } from '@/types/ide'
import { requestLynoAICodingAgent, type LynoAICodingChange } from '@/lib/workspace-api'
import { getBrowserController, type LynoraBrowserAPI } from './browser-api'

export interface LynoraPublicAPI {
  /** Editor version */
  version: string
  /** Open a file by path */
  openFile: (path: string) => boolean
  /** Open a file with raw content (for virtual projects) */
  openVirtualFile: (name: string, language: string, content: string) => void
  /** Get the current project files (deep copy) */
  getFiles: () => ProjectFile[]
  /** Ask LynoAI with the active editor context; changes are returned as review-only proposals. */
  askAI: (
    message: string,
    options?: { selection?: string; locale?: 'en' | 'fr' },
  ) => Promise<{ reply: string; changes: LynoAICodingChange[] }>
  /** Programmatically set the theme */
  setTheme: (theme: 'light' | 'dark') => void
  /** Toggle the sidebar */
  toggleSidebar: () => void
  /** Subscribe to active-file changes */
  onActiveFileChange: (cb: (path: string | null) => void) => () => void
  /** Show / hide a specific bottom panel */
  showTerminal: () => void
  hideTerminal: () => void
  /** Control the embedded browser. Content inspection requires the page's Lynora bridge. */
  browser: LynoraBrowserAPI
}

let installed = false

export function installPublicAPI() {
  if (installed) return
  if (typeof window === 'undefined') return

  const api: LynoraPublicAPI = {
    version: '1.0.0',
    openFile: (path: string) => {
      const state = useIdeStore.getState()
      const find = (files: ProjectFile[]): ProjectFile | undefined => {
        for (const f of files) {
          if (f.path === path) return f
          if (f.children) {
            const found = find(f.children)
            if (found) return found
          }
        }
      }
      const file = find(state.files)
      if (file && !file.isDirectory) {
        state.openFile(file)
        return true
      }
      return false
    },
    openVirtualFile: (name, language, content) => {
      const file: ProjectFile = {
        id: `virtual-${Date.now()}`,
        name,
        path: name,
        type: 'unknown',
        language,
        isDirectory: false,
        content,
        updatedAt: Date.now(),
      }
      useIdeStore.getState().openFile(file)
    },
    getFiles: () => JSON.parse(JSON.stringify(useIdeStore.getState().files)),
    askAI: async (message, options = {}) => {
      const state = useIdeStore.getState()
      if (!state.lynoAISettings.enabled) throw new Error('LynoAI is disabled in editor settings.')
      const activeFile = state.tabs.find((tab) => tab.id === state.activeTabId)
      const result = await requestLynoAICodingAgent({
        mode: 'chat',
        modelTier: state.lynoAISettings.model,
        message,
        conversationId: `extension-${crypto.randomUUID()}`,
        language: activeFile?.language,
        selection: options.selection?.slice(0, 20_000) ?? '',
        locale: options.locale ?? 'en',
        activeFile: activeFile ? {
          path: activeFile.path,
          content: activeFile.content,
          savedContent: activeFile.originalContent,
        } : null,
      })
      return { reply: result.reply, changes: result.changes }
    },
    setTheme: (theme) => useIdeStore.getState().setTheme(theme),
    toggleSidebar: () => useIdeStore.getState().toggleSidebar(),
    onActiveFileChange: (cb) => {
      return useIdeStore.subscribe((state, prev) => {
        const cur = state.tabs.find((t) => t.id === state.activeTabId)?.path ?? null
        const old = prev.tabs.find((t) => t.id === prev.activeTabId)?.path ?? null
        if (cur !== old) cb(cur)
      })
    },
    showTerminal: () => useIdeStore.getState().setBottomPanel('terminal'),
    hideTerminal: () => useIdeStore.getState().setBottomPanel(null),
    browser: {
      getURL: () => getBrowserController()?.getURL() ?? null,
      navigate: (url) => {
        const controller = getBrowserController()
        if (!controller) throw new Error('Open the Browser panel before navigating.')
        controller.navigate(url)
      },
      goBack: () => {
        const controller = getBrowserController()
        if (!controller) throw new Error('Open the Browser panel before navigating.')
        controller.goBack()
      },
      goForward: () => {
        const controller = getBrowserController()
        if (!controller) throw new Error('Open the Browser panel before navigating.')
        controller.goForward()
      },
      reload: () => {
        const controller = getBrowserController()
        if (!controller) throw new Error('Open the Browser panel before navigating.')
        controller.reload()
      },
      getHTML: () => {
        const controller = getBrowserController()
        if (!controller) return Promise.reject(new Error('Open the Browser panel before reading page content.'))
        return controller.getHTML()
      },
      executeJavaScript: (script: string) => {
        const controller = getBrowserController()
        if (!controller) return Promise.reject(new Error('Open the Browser panel before interacting with page content.'))
        return controller.executeJavaScript(script)
      },
    },
  }

  ;(window as unknown as { LynoraIDE: LynoraPublicAPI }).LynoraIDE = api
  installed = true
}
