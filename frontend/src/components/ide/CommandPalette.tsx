'use client'

import { useIdeStore } from '@/store/ide-store'
import { useEffect, useState } from 'react'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'
import { flattenProjectFiles } from '@/lib/workspace-files'
import { matchesShortcut } from '@/lib/ide/event-bus'
import {
  FileCode, Sun, Moon, Terminal, Search, Globe, Compass, Save, FolderPlus, FilePlus, Settings,
  WandSparkles,
} from 'lucide-react'
import { useIdeStore as store } from '@/store/ide-store'
import { WorkspaceItemDialog, type WorkspaceItemType } from '@/components/ide/WorkspaceItemDialog'

export function CommandPalette() {
  const open = useIdeStore((s) => s.commandPaletteOpen)
  const setOpen = useIdeStore((s) => s.setCommandPaletteOpen)
  const {
    theme, toggleTheme, toggleTerminal, setActivePanel,
    saveAll, setBottomPanel, setTheme, toggleSidebar, files,
  } = useIdeStore()
  const [query, setQuery] = useState('')
  const [newItemType, setNewItemType] = useState<WorkspaceItemType | null>(null)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery('')
  }

  // Keyboard shortcut to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcuts = store.getState().settings.shortcuts
      if (matchesShortcut(e, shortcuts.commandPalette)) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(true)
      } else if (matchesShortcut(e, shortcuts.toggleSidebar)) {
        e.preventDefault()
        e.stopPropagation()
        toggleSidebar()
      } else if (matchesShortcut(e, shortcuts.toggleTerminal)) {
        e.preventDefault()
        e.stopPropagation()
        toggleTerminal()
      } else if (matchesShortcut(e, shortcuts.save)) {
        e.preventDefault()
        e.stopPropagation()
        void saveAll()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [setOpen, toggleSidebar, toggleTerminal, saveAll])

  const allFiles = flattenProjectFiles(files).filter((file) => !file.isDirectory)
  const matchingFiles = query
    ? allFiles.filter((f) => f.path.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : allFiles.slice(0, 8)

  const run = (fn: () => void) => {
    fn()
    setOpen(false)
  }
  const runLynoAICommand = (kind: 'generate' | 'explain' | 'refactor' | 'tests') => {
    const state = store.getState()
    const selection = state.editorSelection?.tabId === state.activeTabId
      ? state.editorSelection.text
      : ''
    const prompts = {
      generate: 'Generate a useful function at the current cursor location in the active file. Propose the complete file update for review.',
      explain: 'Explain the selected code clearly, including its behavior and any important edge cases.',
      refactor: 'Refactor the selected code to improve readability and performance while preserving behavior. Propose the complete file update for review.',
      tests: 'Suggest meaningful tests for the selected code, using the testing conventions already present in this workspace. Propose new or updated test files for review.',
    }
    state.queueLynoAICommand(prompts[kind], selection)
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <CommandInput placeholder="Type a command or search files..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

        {matchingFiles.length > 0 && (
          <CommandGroup heading="Files">
            {matchingFiles.map((f) => (
              <CommandItem
                key={f.id}
                value={`file ${f.path} ${f.name}`}
                onSelect={() => run(() => store.getState().openFile(f))}
              >
                <FileCode className="mr-2 h-4 w-4" />
                <span className="flex-1">{f.name}</span>
                <span className="text-xs text-muted-foreground">{f.path}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="LynoAI">
          <CommandItem value="LynoAI Generate Function" onSelect={() => run(() => runLynoAICommand('generate'))}>
            <WandSparkles className="mr-2 h-4 w-4" /> LynoaAI: Generate Function
          </CommandItem>
          <CommandItem value="LynoAI Explain Selection" onSelect={() => run(() => runLynoAICommand('explain'))}>
            <WandSparkles className="mr-2 h-4 w-4" /> LynoaAI: Explain Selection
          </CommandItem>
          <CommandItem value="LynoAI Refactor Code" onSelect={() => run(() => runLynoAICommand('refactor'))}>
            <WandSparkles className="mr-2 h-4 w-4" /> LynoaAI: Refactor Code
          </CommandItem>
          <CommandItem value="LynoAI Suggest Tests" onSelect={() => run(() => runLynoAICommand('tests'))}>
            <WandSparkles className="mr-2 h-4 w-4" /> LynoaAI: Suggest Tests
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="View">
          <CommandItem onSelect={() => run(() => setActivePanel('explorer'))}>
            <FileCode className="mr-2 h-4 w-4" /> Show Explorer
          </CommandItem>
          <CommandItem onSelect={() => run(() => setActivePanel('search'))}>
            <Search className="mr-2 h-4 w-4" /> Find in Files
          </CommandItem>
          <CommandItem onSelect={() => run(() => setActivePanel('api-tester'))}>
            <Globe className="mr-2 h-4 w-4" /> API Tester
          </CommandItem>
          <CommandItem value="Browser Open Browser" onSelect={() => run(() => setActivePanel('browser'))}>
            <Compass className="mr-2 h-4 w-4" /> Browser
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Workspace">
          <CommandItem onSelect={() => run(() => setBottomPanel('terminal'))}>
            <Terminal className="mr-2 h-4 w-4" /> Open Workspace Console
          </CommandItem>
          <CommandItem onSelect={() => run(() => saveAll())}>
            <Save className="mr-2 h-4 w-4" /> Save All Files
          </CommandItem>
          <CommandItem onSelect={() => run(() => {
            setNewItemType('file')
          })}>
            <FilePlus className="mr-2 h-4 w-4" /> New File
          </CommandItem>
          <CommandItem onSelect={() => run(() => {
            setNewItemType('folder')
          })}>
            <FolderPlus className="mr-2 h-4 w-4" /> New Folder
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Preferences">
          <CommandItem onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Switch to {theme === 'dark' ? 'Light' : 'Dark'} Theme
          </CommandItem>
          <CommandItem onSelect={() => run(() => toggleSidebar())}>
            <Settings className="mr-2 h-4 w-4" /> Toggle Sidebar
          </CommandItem>
        </CommandGroup>
        </CommandList>
      </CommandDialog>
      <WorkspaceItemDialog
        type={newItemType}
        onOpenChange={(isOpen) => {
          if (!isOpen) setNewItemType(null)
        }}
      />
    </>
  )
}
