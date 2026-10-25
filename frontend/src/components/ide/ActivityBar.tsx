'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useIdeStore } from '@/store/ide-store'
import { PanelKey } from '@/types/ide'
import { ArrowLeft, Files, Search, Globe, Compass, Settings, Bug, Blocks, GitBranch, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BadgeNotification } from './BadgeNotification'
import { getWorkspaceGitStatuses } from '@/lib/ide/workspace-git-status'

const items: { key: PanelKey; icon: React.ReactNode; label: string }[] = [
  { key: 'explorer', icon: <Files className="h-5 w-5" />, label: 'Explorer' },
  { key: 'search', icon: <Search className="h-5 w-5" />, label: 'Search' },
  { key: 'api-tester', icon: <Globe className="h-5 w-5" />, label: 'API Tester' },
  { key: 'browser', icon: <Compass className="h-5 w-5" />, label: 'Browser' },
  { key: 'debug', icon: <Bug className="h-5 w-5" />, label: 'Debug' },
  { key: 'extensions', icon: <Blocks className="h-5 w-5" />, label: 'Extensions' },
  { key: 'source-control', icon: <GitBranch className="h-5 w-5" />, label: 'Source Control' },
  { key: 'problems', icon: <CircleAlert className="h-5 w-5" />, label: 'Problems' },
]

export function ActivityBar() {
  const activePanel = useIdeStore((state) => state.activePanel)
  const files = useIdeStore((state) => state.files)
  const tabs = useIdeStore((state) => state.tabs)
  const gitRemoteFiles = useIdeStore((state) => state.gitRemoteFiles)
  const problemsByPath = useIdeStore((state) => state.problemsByPath)
  const dirtyCount = new Set(tabs.filter((tab) => tab.isDirty).map((tab) => tab.path)).size
  const problemCount = Object.values(problemsByPath).flat()
    .filter((problem) => problem.severity === 'error').length
  const gitStatuses = useMemo(
    () => getWorkspaceGitStatuses(files, tabs, gitRemoteFiles),
    [files, gitRemoteFiles, tabs],
  )
  const gitChangeCount = Object.keys(gitStatuses).length
  const showPanel = (panel: PanelKey, closeIfAlreadyActive = false) => {
    const state = useIdeStore.getState()
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (isMobile && closeIfAlreadyActive && state.sidebarVisible && state.activePanel === panel) {
      state.setSidebarVisible(false)
      return
    }
    state.openPanel(panel)
  }

  return (
    <div className="coding-activity-bar flex flex-col items-center w-12 bg-background border-r flex-shrink-0">
      <div className="flex flex-col flex-1 py-2 w-full">
        <Link
          href="/dashboard"
          className="coding-activity-button relative group h-12 flex items-center justify-center transition-colors w-full text-muted-foreground hover:text-foreground"
          title="Back to LynoraLink"
          aria-label="Back to LynoraLink"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="coding-activity-tooltip">
            Back to LynoraLink
          </span>
        </Link>
        {items.map((item) => {
          const isActive = activePanel === item.key
          const badge = item.key === 'problems'
            ? <BadgeNotification count={problemCount} tone="error" label="errors" />
            : item.key === 'explorer'
              ? <BadgeNotification count={dirtyCount} tone="warning" label="unsaved files" />
              : item.key === 'source-control'
                ? <BadgeNotification count={gitChangeCount} tone="info" label="changed files" />
                : null
          return (
            <button
              key={item.key}
              className={cn(
                'coding-activity-button relative group h-12 flex items-center justify-center transition-colors w-full',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={isActive}
              onClick={() => showPanel(item.key, true)}
              title={item.label}
            >
              {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500" />}
              {item.icon}
              {badge && <span className="absolute bottom-1.5 right-1.5">{badge}</span>}
              <span className="coding-activity-tooltip">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      <div className="coding-activity-settings py-2 w-full flex flex-col items-center">
        <button
          className={cn(
            'coding-activity-button relative group h-12 flex items-center justify-center transition-colors w-full',
            activePanel === 'settings'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={activePanel === 'settings'}
          title="Settings"
          onClick={() => showPanel('settings')}
        >
          {activePanel === 'settings' && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500" />}
          <Settings className="h-5 w-5" />
          <span className="coding-activity-tooltip">
            Settings
          </span>
        </button>
      </div>
    </div>
  )
}
