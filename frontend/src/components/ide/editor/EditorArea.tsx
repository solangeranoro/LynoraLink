'use client'

import { useIdeStore } from '@/store/ide-store'
import { CodeEditor } from './CodeEditor'
import { EditorTabs } from './EditorTabs'
import { EditorWelcome } from './EditorWelcome'
import { LynoaAIToolbar } from './LynoaAIToolbar'

export function EditorArea({ teamId }: { teamId: string | null }) {
  const tabs = useIdeStore((s) => s.tabs)
  const activeTabId = useIdeStore((s) => s.activeTabId)
  const updateTabContent = useIdeStore((s) => s.updateTabContent)

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-card">
      <EditorTabs />
      <div className="flex-1 min-h-0 relative">
        {activeTab && <LynoaAIToolbar />}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${tab.id === activeTabId ? 'block' : 'hidden'}`}
          >
            <CodeEditor
              tabId={tab.id}
              value={tab.content}
              language={tab.language}
              teamId={teamId}
              onChange={(value) => updateTabContent(tab.id, value)}
            />
          </div>
        ))}
        {!activeTab && <EditorWelcome />}
      </div>
    </div>
  )
}
