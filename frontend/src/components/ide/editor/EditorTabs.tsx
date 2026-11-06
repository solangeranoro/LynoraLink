'use client'

import { useIdeStore } from '@/store/ide-store'
import { X, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileIconBadge } from '../FileIcon'

export function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab, saveTab } = useIdeStore()

  if (!tabs.length) {
    return null
  }

  return (
    <div className="flex items-center bg-background border-b overflow-x-auto h-9 flex-shrink-0">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            'group flex items-center gap-1.5 px-3 h-full border-r cursor-pointer min-w-0 max-w-[200px] relative',
            tab.isActive
              ? 'bg-card text-card-foreground border-b-2 border-b-emerald-500 -mb-px'
              : 'bg-background hover:bg-accent/50 text-muted-foreground',
          )}
          onClick={() => setActiveTab(tab.id)}
        >
          <FileIconBadge file={{ id: tab.fileId, name: tab.name, path: tab.path, type: 'unknown', isDirectory: false, language: tab.language, updatedAt: 0 }} />
          <span className="text-xs truncate">{tab.name}</span>
          {tab.isDirty ? (
            <button
              className="ml-1 p-0.5 hover:bg-accent rounded"
              onClick={(e) => {
                e.stopPropagation()
                saveTab(tab.id)
              }}
              title="Save"
            >
              <Circle className="h-2.5 w-2.5 fill-current text-orange-500 group-hover:hidden" />
              <X className="h-3 w-3 hidden group-hover:block" />
            </button>
          ) : (
            <button
              className="ml-1 p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {tab.isActive && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
          )}
        </div>
      ))}
    </div>
  )
}
