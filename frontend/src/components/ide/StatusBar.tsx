'use client'

import { useIdeStore } from '@/store/ide-store'
import {
  Radio, Sun, Moon, Terminal, CheckCircle2,
} from 'lucide-react'

export function StatusBar() {
  const {
    theme, settings, toggleTheme, toggleTerminal, activeTabId, tabs, lastSaved,
  } = useIdeStore()

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const dirtyCount = tabs.filter((t) => t.isDirty).length

  return (
    <div className="coding-status-bar flex items-center h-6 bg-emerald-600 text-white text-[11px] px-2 gap-3 flex-shrink-0">
      <button
        className="flex items-center gap-1 hover:bg-white/20 px-1.5 py-0.5 rounded"
        onClick={toggleTerminal}
        title="Toggle Terminal"
      >
        <Terminal className="h-3 w-3" />
      </button>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-3 text-white/90">
        {activeTab && (
          <span>
            Lines {activeTab.content.split('\n').length}
          </span>
        )}
        <span>Spaces: {settings.tabSize}</span>
        <span>UTF-8</span>
        <span className="capitalize">{activeTab?.language ?? 'plaintext'}</span>
        {dirtyCount > 0 && (
          <span className="flex items-center gap-1">
            <Radio className="h-3 w-3 animate-pulse" />
            {dirtyCount} unsaved
          </span>
        )}
        {lastSaved && (
          <span className="hidden lg:flex items-center gap-1 text-white/70">
            <CheckCircle2 className="h-3 w-3" />
            Saved {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <button
        className="flex items-center gap-1 hover:bg-white/20 px-1.5 py-0.5 rounded"
        onClick={toggleTheme}
        title="Toggle Theme"
      >
        {theme === 'dark' ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
        <span className="coding-theme-label capitalize">{theme}</span>
      </button>

    </div>
  )
}
