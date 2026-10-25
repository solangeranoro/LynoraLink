'use client'

import { useEffect, useRef, useState } from 'react'
import { useIdeStore } from '@/store/ide-store'
import { installPublicAPI } from '@/lib/ide/public-api'
import { ActivityBar } from './ActivityBar'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { EditorArea } from './editor/EditorArea'
import { BrowserPanel } from './panels/BrowserPanel'
import { IntegratedTerminal } from './panels/IntegratedTerminal'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { CodingAssistantPanel } from './panels/CodingAssistantPanel'
import { Toaster } from 'sonner'
import { loadLynoaAISettings } from '@/lib/ide/lynoai-settings'
import { ideEventBus } from '@/lib/ide/event-bus'
import { getCodingTeamId } from '@/lib/workspace-api'
import { TeamWorkspaceBar } from './TeamWorkspaceBar'

export function IdeShell() {
  const workspaceLoading = useIdeStore((s) => s.workspaceLoading)
  const activePanel = useIdeStore((s) => s.activePanel)
  const theme = useIdeStore((s) => s.theme)
  const setTheme = useIdeStore((s) => s.setTheme)
  const bottomPanel = useIdeStore((s) => s.bottomPanel)
  const bottomPanelHeight = useIdeStore((s) => s.bottomPanelHeight)
  const setBottomPanelHeight = useIdeStore((s) => s.setBottomPanelHeight)
  const setBottomPanel = useIdeStore((s) => s.setBottomPanel)
  const loadWorkspace = useIdeStore((s) => s.loadWorkspace)
  const sidebarVisible = useIdeStore((s) => s.sidebarVisible)
  const assistantSidebarVisible = useIdeStore((s) => s.assistantSidebarVisible)
  const toggleSidebar = useIdeStore((s) => s.toggleSidebar)
  const tabs = useIdeStore((s) => s.tabs)
  const activeTabId = useIdeStore((s) => s.activeTabId)
  const setActiveTab = useIdeStore((s) => s.setActiveTab)
  const closeTab = useIdeStore((s) => s.closeTab)
  const updateLynoAISettings = useIdeStore((s) => s.updateLynoAISettings)
  const [splashVisible, setSplashVisible] = useState(true)
  const [splashLeaving, setSplashLeaving] = useState(false)
  const [assistantWidth, setAssistantWidth] = useState(340)
  const [teamId, setTeamId] = useState<string | null>(null)
  const splashStartedAt = useRef<number | null>(null)
  const assistantResizeRef = useRef({ active: false, startX: 0, startWidth: 340 })

  useEffect(() => {
    splashStartedAt.current = Date.now()
  }, [])

  useEffect(() => {
    if (workspaceLoading || !splashVisible) return

    const minimumDuration = 3000
    const startedAt = splashStartedAt.current ?? Date.now()
    const remainingDuration = Math.max(0, minimumDuration - (Date.now() - startedAt))
    const leaveTimer = window.setTimeout(() => setSplashLeaving(true), remainingDuration)
    const removeTimer = window.setTimeout(
      () => setSplashVisible(false),
      remainingDuration + 250,
    )

    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(removeTimer)
    }
  }, [workspaceLoading, splashVisible])

  // Apply dark class on <html>
  useEffect(() => {
    const root = document.documentElement
    const initiallyDark = root.classList.contains('dark')
    root.classList.toggle('dark', theme === 'dark')

    return () => {
      root.classList.toggle('dark', initiallyDark)
    }
  }, [theme])

  // Install public API for LynoraLink embedding
  useEffect(() => {
    installPublicAPI()
  }, [])

  useEffect(() => ideEventBus.on('output:line', (line) => {
    useIdeStore.getState().appendIdeOutput({
      ...line,
      id: Date.now() + Math.random(),
    })
  }), [])

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 767px)')
    const closeSidebarOnMobile = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches && useIdeStore.getState().sidebarVisible) toggleSidebar()
    }

    closeSidebarOnMobile(mobileViewport)
    mobileViewport.addEventListener('change', closeSidebarOnMobile)
    return () => mobileViewport.removeEventListener('change', closeSidebarOnMobile)
  }, [toggleSidebar])

  // Drag handle for resizing the bottom panel
  const dragRef = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  const onDragStart = (e: React.MouseEvent) => {
    dragRef.current = true
    startY.current = e.clientY
    startH.current = bottomPanelHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const delta = startY.current - e.clientY
      setBottomPanelHeight(startH.current + delta)
    }
    const onUp = () => {
      dragRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setBottomPanelHeight])

  const onAssistantResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(max-width: 767px)').matches) return
    event.preventDefault()
    assistantResizeRef.current = {
      active: true,
      startX: event.clientX,
      startWidth: assistantWidth,
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!assistantResizeRef.current.active) return
      const { startX, startWidth } = assistantResizeRef.current
      const maxWidth = Math.min(600, window.innerWidth * 0.5)
      setAssistantWidth(Math.max(280, Math.min(maxWidth, startWidth + startX - event.clientX)))
    }
    const onUp = () => {
      assistantResizeRef.current.active = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  useEffect(() => {
    setTeamId(getCodingTeamId())
  }, [])

  useEffect(() => {
    updateLynoAISettings(loadLynoaAISettings())
  }, [updateLynoAISettings])

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="lynoracoding coding-shell h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {splashVisible && (
        <div
          className={`coding-splash${splashLeaving ? ' is-leaving' : ''}`}
          role="status"
          aria-label="Loading LynoraCoding workspace"
          aria-live="polite"
        >
          <object
            className="coding-splash-logo"
            data="/logo_lynoracoding_anime.svg"
            type="image/svg+xml"
            aria-label="LynoraCoding animated logo"
            tabIndex={-1}
          />
          <div className="coding-splash-title" aria-label="LynoraCoding">
            <span className="coding-splash-word coding-splash-word-lynora">Lynora</span>
            <span className="coding-splash-word coding-splash-word-coding">Coding</span>
          </div>
          <span className="coding-splash-message">Loading your workspace…</span>
        </div>
      )}
      <TopBar />
      <TeamWorkspaceBar />

      <div className="coding-workspace flex flex-1 min-h-0 relative">
        <ActivityBar />
        {sidebarVisible && activePanel !== 'browser' && (
          <button
            type="button"
            className="coding-sidebar-backdrop"
            onClick={toggleSidebar}
            aria-label="Close navigation panel"
          />
        )}
        {activePanel !== 'browser' && <Sidebar />}

        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Editor area (grows) */}
          <div className={`flex-1 min-h-0 flex flex-col${activePanel === 'browser' ? ' hidden' : ''}`}>
            <EditorArea teamId={teamId} />
          </div>
          <div className={`flex-1 min-h-0 flex flex-col${activePanel === 'browser' ? '' : ' hidden'}`}>
            <BrowserPanel />
          </div>

          {/* Resize handle */}
          {bottomPanel && (
            <div
              onMouseDown={onDragStart}
              className="coding-resize-handle h-1 cursor-row-resize bg-border hover:bg-emerald-500 transition-colors flex-shrink-0"
            />
          )}

          {/* Bottom panel (terminal / problems / output / debug) */}
          {bottomPanel && (
            <div style={{ height: bottomPanelHeight }} className="coding-terminal-panel flex-shrink-0">
              <IntegratedTerminal />
            </div>
          )}

        </div>
        {assistantSidebarVisible && (
          <aside
            className="coding-assistant-sidebar h-full min-h-0 flex-shrink-0 overflow-hidden border-l bg-background"
            style={{ width: assistantWidth }}
          >
            <div
              role="separator"
              aria-label="Resize LynoaAI chat sidebar"
              aria-orientation="vertical"
              tabIndex={0}
              className="coding-assistant-resize-handle"
              onPointerDown={onAssistantResizeStart}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') setAssistantWidth((width) => Math.min(600, width + 20))
                if (event.key === 'ArrowRight') setAssistantWidth((width) => Math.max(280, width - 20))
              }}
            />
            <CodingAssistantPanel />
          </aside>
        )}
      </div>

      <StatusBar />
      <CommandPalette />
      <Toaster position="bottom-right" />
    </div>
  )
}
