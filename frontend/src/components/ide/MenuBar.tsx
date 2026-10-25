'use client'

import { useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Braces, Clipboard, ClipboardCopy, ClipboardPaste, FilePlus, FolderPlus,
  FolderOpen, PanelsTopLeft, PanelLeft, PanelRight, PanelBottom, Search, Settings, Sun, Moon, Terminal,
  Trash2, X, Save, SaveAll, Undo2, Redo2, ListStart, ChevronRight,
  Keyboard, Info, Files, Globe, Bug, Blocks, GitBranch, CircleAlert, Code2, Sparkles, Menu,
} from 'lucide-react'
import { toast } from 'sonner'
import { useIdeStore } from '@/store/ide-store'
import type { PanelKey } from '@/types/ide'
import { ideEventBus, type EditorMenuAction } from '@/lib/ide/event-bus'
import { WorkspaceItemDialog, type WorkspaceItemType } from '@/components/ide/WorkspaceItemDialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type MenuItem = {
  label: string
  icon: ReactNode
  onSelect: () => void
  shortcut?: string
  disabled?: boolean
}

type MenuDefinition = {
  name: string
  groups: MenuItem[][]
}

const runEditorAction = (tabId: string | null, action: EditorMenuAction) => {
  if (tabId) ideEventBus.emit('editor:command', { tabId, action })
}

const MAX_PROJECT_FILES = 5_000
const MAX_PROJECT_ENTRIES = 10_000
const MAX_PROJECT_FILE_SIZE = 2_000_000
const MAX_PROJECT_SIZE = 2_000_000_000
const IGNORED_PROJECT_DIRECTORIES = new Set([
  '.git', '.next', '.turbo', '.vercel', '.cache', 'node_modules',
  'dist', 'build', 'coverage',
])

export function openCodingFolderPicker() {
  const input = document.getElementById('coding-open-folder')
  if (!(input instanceof HTMLInputElement)) return
  if (!('webkitdirectory' in input)) {
    toast.info('This browser cannot select a folder. Use Open File to choose files instead.')
    document.getElementById('coding-open-file')?.click()
    return
  }
  input.setAttribute('webkitdirectory', '')
  input.click()
}

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [newItemType, setNewItemType] = useState<WorkspaceItemType | null>(null)
  const {
    activeTabId, activePanel, assistantSidebarVisible, bottomPanel, tabs, settings, theme,
    activeTerminalId, terminals, sidebarVisible,
    closeTab, saveAll, saveTab, setActivePanel, setActiveTab,
    setBottomPanel, toggleSidebar, toggleAssistantSidebar, toggleTerminal, toggleTheme,
    addTerminal, clearTerminal, setCommandPaletteOpen, importFiles,
  } = useIdeStore()

  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const hasUnsavedChanges = tabs.some((tab) => tab.isDirty)
  const save = () => {
    if (activeTabId) void saveTab(activeTabId)
  }
  const newWorkspaceItem = (isDirectory: boolean) => {
    setNewItemType(isDirectory ? 'folder' : 'file')
  }
  const openLocalFiles = () => document.getElementById('coding-open-file')?.click()
  const openLocalFolder = openCodingFolderPicker
  const importLocalFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const selectedFiles = Array.from(input.files ?? [])
    input.value = ''
    if (!selectedFiles.length) return

    try {
      const isFolderImport = input.id === 'coding-open-folder'
      const projectName = isFolderImport
        ? selectedFiles[0].webkitRelativePath.split('/')[0]
        : undefined
      if (isFolderImport) {
        if (!projectName || selectedFiles.some((file) => (
          !file.webkitRelativePath.startsWith(`${projectName}/`)
        ))) {
          throw new Error('The selected folder did not provide valid relative file paths.')
        }
        const state = useIdeStore.getState()
        if ((state.files.length > 0 || state.tabs.some((tab) => tab.isDirty)) &&
          !window.confirm(`Open "${projectName}" and replace the current workspace? Unsaved changes will be discarded.`)) {
          return
        }
      }

      let skippedFiles = 0
      const eligibleFiles = selectedFiles.filter((file) => {
        if (isFolderImport) {
          const pathParts = file.webkitRelativePath.split('/')
          if (pathParts.length < 2) {
            throw new Error('A selected file has an invalid relative path.')
          }
          if (pathParts.slice(1, -1).some((part) => IGNORED_PROJECT_DIRECTORIES.has(part.toLowerCase()))) {
            skippedFiles += 1
            return false
          }
        }
        if (file.size > MAX_PROJECT_FILE_SIZE) {
          skippedFiles += 1
          return false
        }
        return true
      })
      if (eligibleFiles.length > MAX_PROJECT_FILES) {
        throw new Error(`The selected project contains more than ${MAX_PROJECT_FILES.toLocaleString()} importable files.`)
      }
      if (eligibleFiles.reduce((total, file) => total + file.size, 0) > MAX_PROJECT_SIZE) {
        throw new Error('The selected project exceeds the 2,000 MB import limit.')
      }

      const importedFileResults = await Promise.all(eligibleFiles.map(async (file) => {
        const relativePath = isFolderImport ? file.webkitRelativePath : file.name
        const pathParts = relativePath.split('/')
        const path = (isFolderImport ? pathParts.slice(1) : pathParts).join('/')
        if (!path) throw new Error('A selected file has an invalid name.')
        const buffer = await file.arrayBuffer()
        let content: string
        try {
          content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
        } catch (error) {
          if (!(error instanceof TypeError)) throw error
          return null
        }
        if (content.includes('\0')) return null
        return { path, isDirectory: false, content }
      }))
      const importedFiles = importedFileResults.filter((file) => file !== null)
      skippedFiles += importedFileResults.length - importedFiles.length
      if (!importedFiles.length) {
        throw new Error('The selected project contains no readable text files.')
      }

      const directories = new Set<string>()
      for (const file of importedFiles) {
        const parts = file.path.split('/')
        for (let index = 1; index < parts.length; index += 1) {
          directories.add(parts.slice(0, index).join('/'))
        }
      }
      const importEntries = [
        ...Array.from(directories, (path) => ({ path, isDirectory: true, content: '' })),
        ...importedFiles,
      ].sort((left, right) => left.path.split('/').length - right.path.split('/').length)
      if (importEntries.length > MAX_PROJECT_ENTRIES) {
        throw new Error(`The selected project contains more than ${MAX_PROJECT_ENTRIES.toLocaleString()} files and folders.`)
      }
      await importFiles(importEntries, isFolderImport, projectName, skippedFiles)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read the selected files.')
    }
  }
  const moveTab = (direction: -1 | 1) => {
    if (!activeTabId || tabs.length < 2) return
    const index = tabs.findIndex((tab) => tab.id === activeTabId)
    const nextIndex = (index + direction + tabs.length) % tabs.length
    setActiveTab(tabs[nextIndex].id)
  }
  const showPanel = (panel: PanelKey) => {
    if (panel === 'assistant') {
      useIdeStore.getState().openPanel('assistant')
      return
    }
    setActivePanel(panel)
    if (!sidebarVisible) toggleSidebar()
  }
  const clearActiveTerminal = () => {
    const terminalId = activeTerminalId ?? terminals[0]?.id
    if (terminalId) clearTerminal(terminalId)
    setBottomPanel('terminal')
  }

  const menus: MenuDefinition[] = [
    {
      name: 'File',
      groups: [
        [
          { label: 'New Window', icon: <PanelsTopLeft />, onSelect: () => { window.open('/coding', '_blank', 'noopener,noreferrer') } },
          { label: 'New File...', icon: <FilePlus />, onSelect: () => newWorkspaceItem(false) },
          { label: 'New Folder...', icon: <FolderPlus />, onSelect: () => newWorkspaceItem(true) },
          { label: 'Open File...', icon: <FolderOpen />, onSelect: openLocalFiles },
          { label: 'Open Folder...', icon: <FolderOpen />, onSelect: openLocalFolder },
        ],
        [
          { label: 'Save', icon: <Save />, onSelect: save, shortcut: settings.shortcuts.save, disabled: !activeTab },
          { label: 'Save All', icon: <SaveAll />, onSelect: () => void saveAll(), disabled: !hasUnsavedChanges },
        ],
        [
          { label: 'Close Editor', icon: <X />, onSelect: () => activeTabId && closeTab(activeTabId), disabled: !activeTab },
        ],
      ],
    },
    {
      name: 'Edit',
      groups: [
        [
          { label: 'Undo', icon: <Undo2 />, onSelect: () => runEditorAction(activeTabId, 'undo'), shortcut: 'Ctrl+Z', disabled: !activeTab },
          { label: 'Redo', icon: <Redo2 />, onSelect: () => runEditorAction(activeTabId, 'redo'), shortcut: 'Ctrl+Y', disabled: !activeTab },
        ],
        [
          { label: 'Cut', icon: <Clipboard />, onSelect: () => runEditorAction(activeTabId, 'editor.action.clipboardCutAction'), shortcut: 'Ctrl+X', disabled: !activeTab },
          { label: 'Copy', icon: <ClipboardCopy />, onSelect: () => runEditorAction(activeTabId, 'editor.action.clipboardCopyAction'), shortcut: 'Ctrl+C', disabled: !activeTab },
          { label: 'Paste', icon: <ClipboardPaste />, onSelect: () => runEditorAction(activeTabId, 'editor.action.clipboardPasteAction'), shortcut: 'Ctrl+V', disabled: !activeTab },
        ],
      ],
    },
    {
      name: 'Selection',
      groups: [
        [
          { label: 'Select All', icon: <Braces />, onSelect: () => runEditorAction(activeTabId, 'editor.action.selectAll'), shortcut: 'Ctrl+A', disabled: !activeTab },
          { label: 'Expand Selection', icon: <ListStart />, onSelect: () => runEditorAction(activeTabId, 'editor.action.smartSelect.expand'), shortcut: 'Shift+Alt+Right', disabled: !activeTab },
          { label: 'Shrink Selection', icon: <ListStart className="rotate-180" />, onSelect: () => runEditorAction(activeTabId, 'editor.action.smartSelect.shrink'), shortcut: 'Shift+Alt+Left', disabled: !activeTab },
        ],
        [
          { label: 'Add Cursor Above', icon: <Braces />, onSelect: () => runEditorAction(activeTabId, 'editor.action.insertCursorAbove'), shortcut: 'Ctrl+Alt+Up', disabled: !activeTab },
          { label: 'Add Cursor Below', icon: <Braces />, onSelect: () => runEditorAction(activeTabId, 'editor.action.insertCursorBelow'), shortcut: 'Ctrl+Alt+Down', disabled: !activeTab },
        ],
      ],
    },
    {
      name: 'View',
      groups: [
        [
          { label: 'LynoAI Assistant', icon: <Sparkles />, onSelect: () => showPanel('assistant'), disabled: assistantSidebarVisible },
          { label: 'Explorer', icon: <Files />, onSelect: () => showPanel('explorer'), disabled: activePanel === 'explorer' && sidebarVisible },
          { label: 'Search', icon: <Search />, onSelect: () => showPanel('search'), disabled: activePanel === 'search' && sidebarVisible },
          { label: 'API Tester', icon: <Globe />, onSelect: () => showPanel('api-tester'), disabled: activePanel === 'api-tester' && sidebarVisible },
          { label: 'Debug', icon: <Bug />, onSelect: () => showPanel('debug'), disabled: activePanel === 'debug' && sidebarVisible },
          { label: 'Extensions', icon: <Blocks />, onSelect: () => showPanel('extensions'), disabled: activePanel === 'extensions' && sidebarVisible },
          { label: 'Source Control', icon: <GitBranch />, onSelect: () => showPanel('source-control'), disabled: activePanel === 'source-control' && sidebarVisible },
          { label: 'Problems', icon: <CircleAlert />, onSelect: () => showPanel('problems'), disabled: activePanel === 'problems' && sidebarVisible },
          { label: 'Settings', icon: <Settings />, onSelect: () => showPanel('settings'), disabled: activePanel === 'settings' && sidebarVisible },
        ],
        [
          { label: sidebarVisible ? 'Hide Left Sidebar' : 'Show Left Sidebar', icon: <PanelLeft />, onSelect: toggleSidebar, shortcut: settings.shortcuts.toggleSidebar },
          { label: assistantSidebarVisible ? 'Hide LynoAI Right Sidebar' : 'Show LynoAI Right Sidebar', icon: <PanelRight />, onSelect: toggleAssistantSidebar },
          { label: bottomPanel ? 'Hide Terminal' : 'Show Terminal', icon: <PanelBottom />, onSelect: toggleTerminal, shortcut: settings.shortcuts.toggleTerminal },
          { label: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme', icon: theme === 'dark' ? <Sun /> : <Moon />, onSelect: toggleTheme },
        ],
      ],
    },
    {
      name: 'Go',
      groups: [
        [
          { label: 'Go to File...', icon: <FolderOpen />, onSelect: () => setCommandPaletteOpen(true), shortcut: settings.shortcuts.commandPalette },
          { label: 'Go to Line...', icon: <ListStart />, onSelect: () => runEditorAction(activeTabId, 'editor.action.gotoLine'), shortcut: 'Ctrl+G', disabled: !activeTab },
        ],
        [
          { label: 'Previous Editor', icon: <ChevronRight className="rotate-180" />, onSelect: () => moveTab(-1), shortcut: 'Ctrl+PageUp', disabled: tabs.length < 2 },
          { label: 'Next Editor', icon: <ChevronRight />, onSelect: () => moveTab(1), shortcut: 'Ctrl+PageDown', disabled: tabs.length < 2 },
        ],
      ],
    },
    {
      name: 'Terminal',
      groups: [
        [
          { label: 'New Terminal', icon: <Terminal />, onSelect: () => { addTerminal(); setBottomPanel('terminal') } },
          { label: 'Clear Terminal', icon: <Trash2 />, onSelect: clearActiveTerminal, disabled: terminals.length === 0 },
        ],
        [
          { label: bottomPanel ? 'Hide Terminal' : 'Show Terminal', icon: <PanelBottom />, onSelect: () => setBottomPanel(bottomPanel ? null : 'terminal'), shortcut: settings.shortcuts.toggleTerminal },
        ],
      ],
    },
  ]

  const renderItem = (item: MenuItem) => (
    <DropdownMenuItem
      key={item.label}
      disabled={item.disabled}
      onSelect={item.onSelect}
      className="coding-menu-item"
    >
      {item.icon}
      <span>{item.label}</span>
      {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  )

  return (
    <nav className="coding-menubar" aria-label="Editor menus">
      <input
        id="coding-open-file"
        type="file"
        className="hidden"
        onChange={importLocalFiles}
      />
      <input
        id="coding-open-folder"
        type="file"
        className="hidden"
        multiple
        onChange={importLocalFiles}
      />
      <div className="coding-menubar-desktop">
        {menus.map((menu) => (
          <DropdownMenu
            key={menu.name}
            modal={false}
            open={openMenu === menu.name}
            onOpenChange={(open) => setOpenMenu((current) => (
              open ? menu.name : current === menu.name ? null : current
            ))}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="coding-menubar-trigger"
                data-coding-menu-trigger=""
              >
                {menu.name}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="coding-menu-content"
              onInteractOutside={(event) => {
                if (event.target instanceof Element && event.target.closest('[data-coding-menu-trigger]')) {
                  event.preventDefault()
                }
              }}
            >
              <DropdownMenuLabel className="coding-menu-heading">{menu.name}</DropdownMenuLabel>
              {menu.groups.map((group, groupIndex) => (
                <div key={`${menu.name}-${groupIndex}`}>
                  {groupIndex > 0 && <DropdownMenuSeparator />}
                  {group.map(renderItem)}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}

        <DropdownMenu
          modal={false}
          open={openMenu === 'Help'}
          onOpenChange={(open) => setOpenMenu((current) => (
            open ? 'Help' : current === 'Help' ? null : current
          ))}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="coding-menubar-trigger"
              data-coding-menu-trigger=""
            >
              Help
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={4}
            className="coding-menu-content"
            onInteractOutside={(event) => {
              if (event.target instanceof Element && event.target.closest('[data-coding-menu-trigger]')) {
                event.preventDefault()
              }
            }}
          >
            <DropdownMenuLabel className="coding-menu-heading">Help</DropdownMenuLabel>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="coding-menu-item">
                <Keyboard />
                <span>Keyboard Shortcuts</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="coding-menu-content">
                <DropdownMenuLabel className="coding-menu-heading">Editor shortcuts</DropdownMenuLabel>
                <DropdownMenuLabel className="coding-shortcut-row">
                  <span>Command Palette</span>
                  <DropdownMenuShortcut>{settings.shortcuts.commandPalette}</DropdownMenuShortcut>
                </DropdownMenuLabel>
                <DropdownMenuLabel className="coding-shortcut-row">
                  <span>Save</span>
                  <DropdownMenuShortcut>{settings.shortcuts.save}</DropdownMenuShortcut>
                </DropdownMenuLabel>
                <DropdownMenuLabel className="coding-shortcut-row">
                  <span>Toggle Sidebar</span>
                  <DropdownMenuShortcut>{settings.shortcuts.toggleSidebar}</DropdownMenuShortcut>
                </DropdownMenuLabel>
                <DropdownMenuLabel className="coding-shortcut-row">
                  <span>Toggle Terminal</span>
                  <DropdownMenuShortcut>{settings.shortcuts.toggleTerminal}</DropdownMenuShortcut>
                </DropdownMenuLabel>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="coding-menu-item"
              onSelect={() => toast.info('LynoraCoding', {
                description: 'A lightweight workspace editor built into LynoraLink.',
              })}
            >
              <Info />
              <span>About LynoraCoding</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="coding-menu-item"
              onSelect={() => setCommandPaletteOpen(true)}
            >
              <Code2 />
              <span>Open Command Palette</span>
              <DropdownMenuShortcut>{settings.shortcuts.commandPalette}</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="coding-mobile-menubar-trigger"
            aria-label="Open editor menu"
            title="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="coding-mobile-menu-content">
          {menus.map((menu) => (
            <DropdownMenuSub key={`mobile-${menu.name}`}>
              <DropdownMenuSubTrigger className="coding-menu-item">
                {menu.name}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                align="start"
                className="coding-menu-content coding-mobile-submenu-content"
              >
                <DropdownMenuLabel className="coding-menu-heading">{menu.name}</DropdownMenuLabel>
                {menu.groups.map((group, groupIndex) => (
                  <div key={`mobile-${menu.name}-${groupIndex}`}>
                    {groupIndex > 0 && <DropdownMenuSeparator />}
                    {group.map(renderItem)}
                  </div>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="coding-menu-item">Help</DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              align="start"
              className="coding-menu-content coding-mobile-submenu-content"
            >
              <DropdownMenuLabel className="coding-menu-heading">Help</DropdownMenuLabel>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="coding-menu-item">
                  <Keyboard />
                  <span>Keyboard Shortcuts</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="coding-menu-content coding-mobile-submenu-content">
                  <DropdownMenuLabel className="coding-menu-heading">Editor shortcuts</DropdownMenuLabel>
                  <DropdownMenuLabel className="coding-shortcut-row">
                    <span>Command Palette</span>
                    <DropdownMenuShortcut>{settings.shortcuts.commandPalette}</DropdownMenuShortcut>
                  </DropdownMenuLabel>
                  <DropdownMenuLabel className="coding-shortcut-row">
                    <span>Save</span>
                    <DropdownMenuShortcut>{settings.shortcuts.save}</DropdownMenuShortcut>
                  </DropdownMenuLabel>
                  <DropdownMenuLabel className="coding-shortcut-row">
                    <span>Toggle Sidebar</span>
                    <DropdownMenuShortcut>{settings.shortcuts.toggleSidebar}</DropdownMenuShortcut>
                  </DropdownMenuLabel>
                  <DropdownMenuLabel className="coding-shortcut-row">
                    <span>Toggle Terminal</span>
                    <DropdownMenuShortcut>{settings.shortcuts.toggleTerminal}</DropdownMenuShortcut>
                  </DropdownMenuLabel>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="coding-menu-item"
                onSelect={() => toast.info('LynoraCoding', {
                  description: 'A lightweight workspace editor built into LynoraLink.',
                })}
              >
                <Info />
                <span>About LynoraCoding</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <WorkspaceItemDialog
        type={newItemType}
        onOpenChange={(open) => {
          if (!open) setNewItemType(null)
        }}
      />
    </nav>
  )
}
