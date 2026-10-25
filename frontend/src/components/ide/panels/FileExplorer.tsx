'use client'

import { useIdeStore } from '@/store/ide-store'
import { ProjectFile } from '@/types/ide'
import { FileIconBadge } from '../FileIcon'
import {
  ChevronRight, ChevronDown, FolderPlus, FilePlus, RefreshCw,
  MoreHorizontal, Folder, FolderOpen, Copy, FileText, ExternalLink,
  Save, X, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useState } from 'react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { WorkspaceItemDialog, type WorkspaceItemType } from '@/components/ide/WorkspaceItemDialog'
import { BadgeNotification } from '../BadgeNotification'
import { getWorkspaceGitStatuses, type WorkspaceGitStatus } from '@/lib/ide/workspace-git-status'
import { useMemo } from 'react'

interface NodeProps {
  file: ProjectFile
  depth: number
  onCreateItem: (type: WorkspaceItemType, parentPath: string) => void
  dirtyPaths: Set<string>
  gitStatuses: Record<string, WorkspaceGitStatus>
}

function TreeNode({ file, depth, onCreateItem, dirtyPaths, gitStatuses }: NodeProps) {
  const expanded = useIdeStore((s) => s.expandedDirs.has(file.path))
  const selectedFileId = useIdeStore((s) => s.selectedFileId)
  const toggleDir = useIdeStore((s) => s.toggleDir)
  const openFile = useIdeStore((s) => s.openFile)
  const selectFile = useIdeStore((s) => s.selectFile)
  const deleteFile = useIdeStore((s) => s.deleteFile)
  const openTab = useIdeStore((s) => s.tabs.find((tab) => tab.path === file.path))
  const closeTab = useIdeStore((s) => s.closeTab)
  const saveTab = useIdeStore((s) => s.saveTab)

  const handleClick = () => {
    if (file.isDirectory) {
      toggleDir(file.path)
    } else {
      openFile(file)
      selectFile(file.id)
    }
  }

  const isSelected = selectedFileId === file.id
  const gitStatus = gitStatuses[file.path]

  const copyToClipboard = async (value: string, description: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${description} copied.`)
    } catch (error) {
      toast.error(error instanceof Error
        ? error.message
        : `Unable to copy ${description.toLowerCase()}.`)
    }
  }

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 h-7 cursor-pointer text-sm transition-colors',
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent/50',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {file.isDirectory ? (
          <span className="flex-shrink-0">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </span>
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <span className="flex-shrink-0">
          {file.isDirectory ? (
            expanded ? (
              <FolderOpen className="h-4 w-4 text-amber-500" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500" />
            )
          ) : (
            <FileIconBadge file={file} />
          )}
        </span>
        <span className="flex-1 truncate">{file.name}</span>
        {dirtyPaths.has(file.path) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" title="Unsaved changes" />}
        {(gitStatus === 'U' || gitStatus === 'M') && (
          <span
            className={`shrink-0 text-[10px] font-semibold ${gitStatus === 'U' ? 'text-green-500' : 'text-blue-500'}`}
            title={gitStatus === 'U' ? 'Untracked file' : 'Modified file'}
          >
            {gitStatus}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`More actions for ${file.name}`}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 hover:bg-accent p-1 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {!file.isDirectory && (
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    openFile(file)
                    selectFile(file.id)
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open
                </DropdownMenuItem>
                {openTab && dirtyPaths.has(file.path) && (
                  <DropdownMenuItem onSelect={() => void saveTab(openTab.id)}>
                    <Save className="h-3.5 w-3.5 mr-2" /> Save
                  </DropdownMenuItem>
                )}
                {openTab && (
                  <DropdownMenuItem onSelect={() => closeTab(openTab.id)}>
                    <X className="h-3.5 w-3.5 mr-2" /> Close Tab
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            {file.isDirectory && (
              <>
                <DropdownMenuItem onSelect={() => toggleDir(file.path)}>
                  {expanded
                    ? <ChevronRight className="h-3.5 w-3.5 mr-2" />
                    : <ChevronDown className="h-3.5 w-3.5 mr-2" />}
                  {expanded ? 'Collapse Folder' : 'Expand Folder'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateItem('file', file.path)}>
                  <FilePlus className="h-3.5 w-3.5 mr-2" /> New File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateItem('folder', file.path)}>
                  <FolderPlus className="h-3.5 w-3.5 mr-2" /> New Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={() => void copyToClipboard(file.name, 'Name')}>
              <FileText className="h-3.5 w-3.5 mr-2" /> Copy Name
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void copyToClipboard(file.path, 'Path')}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Copy Relative Path
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm(`Delete ${file.name}?`)) deleteFile(file.path)
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {file.isDirectory && expanded && file.children && (
        <div>
          {[...file.children]
            .sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
              return a.name.localeCompare(b.name)
            })
            .map((child) => (
              <TreeNode
                key={child.id}
                file={child}
                depth={depth + 1}
                onCreateItem={onCreateItem}
                dirtyPaths={dirtyPaths}
                gitStatuses={gitStatuses}
              />
            ))}
        </div>
      )}
    </div>
  )
}

export function FileExplorer() {
  const files = useIdeStore((s) => s.files)
  const projectName = useIdeStore((s) => s.projectName)
  const workspaceLoading = useIdeStore((s) => s.workspaceLoading)
  const tabs = useIdeStore((s) => s.tabs)
  const gitRemoteFiles = useIdeStore((s) => s.gitRemoteFiles)
  const loadWorkspace = useIdeStore((s) => s.loadWorkspace)
  const [newItem, setNewItem] = useState<{ type: WorkspaceItemType; parentPath: string } | null>(null)
  const requestNewItem = (type: WorkspaceItemType, parentPath = '') => {
    setNewItem({ type, parentPath })
  }

  const sortedFiles = [...files].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  const dirtyPaths = new Set(tabs.filter((tab) => tab.isDirty).map((tab) => tab.path))
  const gitStatuses = useMemo(
    () => getWorkspaceGitStatuses(files, tabs, gitRemoteFiles),
    [files, gitRemoteFiles, tabs],
  )
  const dirtyCount = dirtyPaths.size

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <button
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="New File"
            onClick={() => requestNewItem('file')}
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="New Folder"
            onClick={() => requestNewItem('folder')}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="Refresh"
            onClick={() => void loadWorkspace()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5 text-xs font-medium">
        <span className="flex-1 truncate">{projectName}</span>
        <BadgeNotification count={dirtyCount} tone="warning" label="unsaved files" />
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {sortedFiles.map((file) => (
          <TreeNode
            key={file.id}
            file={file}
            depth={0}
            onCreateItem={requestNewItem}
            dirtyPaths={dirtyPaths}
            gitStatuses={gitStatuses}
          />
        ))}
        {!workspaceLoading && !sortedFiles.length && (
          <div className="p-4 text-xs text-muted-foreground">
            This workspace is empty. Use File &gt; Open Folder to load a project, or create a file or folder.
          </div>
        )}
        {workspaceLoading && !sortedFiles.length && (
          <div className="p-4 text-xs text-muted-foreground">Loading workspace…</div>
        )}
      </div>
      <WorkspaceItemDialog
        type={newItem?.type ?? null}
        parentPath={newItem?.parentPath}
        onOpenChange={(open) => {
          if (!open) setNewItem(null)
        }}
      />
    </div>
  )
}
