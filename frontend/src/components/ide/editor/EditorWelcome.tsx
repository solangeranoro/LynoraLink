'use client'

import { useIdeStore } from '@/store/ide-store'
import Image from 'next/image'
import {
  FilePlus, Terminal, Search, Globe, Settings, Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { WorkspaceItemDialog } from '@/components/ide/WorkspaceItemDialog'

export function EditorWelcome() {
  const [showNewFileDialog, setShowNewFileDialog] = useState(false)
  const setActivePanel = useIdeStore((s) => s.setActivePanel)
  const setBottomPanel = useIdeStore((s) => s.setBottomPanel)
  const sidebarVisible = useIdeStore((s) => s.sidebarVisible)
  const toggleSidebar = useIdeStore((s) => s.toggleSidebar)
  const settings = useIdeStore((s) => s.settings)
  const workspaceLoading = useIdeStore((s) => s.workspaceLoading)
  const files = useIdeStore((s) => s.files)
  const showSettings = () => {
    setActivePanel('settings')
    if (!sidebarVisible) toggleSidebar()
  }

  const quickStart = [
    { icon: <FilePlus className="h-4 w-4" />, label: 'New File', desc: 'Create a file in this workspace' },
    { icon: <Search className="h-4 w-4" />, label: 'Find in Files', desc: 'Search across the project' },
  ]

  const features = [
    { icon: <Terminal className="h-4 w-4" />, title: 'Workspace Console', desc: 'Inspect saved files with read-only commands', action: () => setBottomPanel('terminal') },
    { icon: <Globe className="h-4 w-4" />, title: 'API Tester', desc: 'Send real HTTP requests from your browser', action: () => setActivePanel('api-tester') },
    { icon: <Search className="h-4 w-4" />, title: 'Find in Files', desc: 'Search saved workspace files', action: () => setActivePanel('search') },
    { icon: <Settings className="h-4 w-4" />, title: 'Preferences', desc: 'Theme and editor shortcuts', action: showSettings },
  ]

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
            <Image
              src="/logo_lynoracoding.svg"
              alt="LynoraCoding"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold mb-1">
            Lynora<span className="text-emerald-500">Coding</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit and save workspace files through the LynoraCoding API.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Start
            </h2>
            <div className="space-y-1">
              {quickStart.map((item) => (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left"
                  onClick={() => {
                    if (item.label === 'Find in Files') setActivePanel('search')
                    else if (item.label === 'New File') setShowNewFileDialog(true)
                  }}
                >
                  <span className="text-emerald-500">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-3">
              Workspace
            </h2>
            <p className="px-3 text-xs text-muted-foreground">
              {workspaceLoading ? 'Loading saved files…' : files.length ? 'Open a file from Explorer to start editing.' : 'No files yet. Use File > Open Folder to load a project, or create a file.'}
            </p>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Explore
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {features.map((feat) => (
                <button
                  key={feat.title}
                  className="p-3 rounded-md border hover:border-emerald-500 hover:bg-accent/30 text-left transition-colors"
                  onClick={feat.action}
                >
                  <div className="text-emerald-500 mb-1.5">{feat.icon}</div>
                  <div className="text-xs font-medium">{feat.title}</div>
                  <div className="text-[10px] text-muted-foreground">{feat.desc}</div>
                </button>
              ))}
            </div>

            <div className="mt-6 p-3 rounded-md bg-muted/40 text-xs">
              <div className="font-medium mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-emerald-500" /> Integration tip
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Files are stored in the configured database and managed through
                <code className="text-emerald-500 font-mono"> /api/coding</code>.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-[10px]">{settings.shortcuts.commandPalette}</kbd>{' '}
          to open the command palette
        </div>
      </div>
      <WorkspaceItemDialog
        type={showNewFileDialog ? 'file' : null}
        onOpenChange={setShowNewFileDialog}
      />
    </div>
  )
}
