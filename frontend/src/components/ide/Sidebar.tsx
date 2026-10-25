'use client'

import { useIdeStore } from '@/store/ide-store'
import { FileExplorer } from './panels/FileExplorer'
import { SearchPanel } from './panels/SearchPanel'
import { ApiTesterPanel } from './panels/ApiTesterPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { DebugPanel } from './panels/DebugPanel'
import { ExtensionsPanel } from './panels/ExtensionsPanel'
import { SourceControlPanel } from './panels/SourceControlPanel'
import { ProblemsPanel } from './panels/ProblemsPanel'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const activePanel = useIdeStore((s) => s.activePanel)
  const sidebarVisible = useIdeStore((s) => s.sidebarVisible)

  if (!sidebarVisible) return null

  return (
    <div className={cn(
      'coding-sidebar h-full min-h-0 flex-shrink-0 overflow-hidden border-r bg-background transition-all duration-200',
      'w-[260px]',
    )}>
      {activePanel === 'explorer' && <FileExplorer />}
      {activePanel === 'search' && <SearchPanel />}
      {activePanel === 'api-tester' && <ApiTesterPanel />}
      {activePanel === 'settings' && <SettingsPanel />}
      {activePanel === 'debug' && <DebugPanel />}
      {activePanel === 'extensions' && <ExtensionsPanel />}
      {activePanel === 'source-control' && <SourceControlPanel />}
      {activePanel === 'problems' && <ProblemsPanel />}
    </div>
  )
}
