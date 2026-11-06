import type { EditorTab, ProjectFile } from '@/types/ide'
import { flattenProjectFiles } from '@/lib/workspace-files'

export type WorkspaceGitStatus = 'U' | 'M' | 'D'

export function getWorkspaceGitStatuses(
  files: ProjectFile[],
  tabs: EditorTab[],
  remoteFiles: { path: string; content: string }[] | null,
): Record<string, WorkspaceGitStatus> {
  if (!remoteFiles) return {}

  const remoteByPath = new Map(remoteFiles.map((file) => [file.path, file.content]))
  const localFiles = flattenProjectFiles(files).filter((file) => !file.isDirectory)
  const openTabsByPath = new Map(tabs.map((tab) => [tab.path, tab.content]))
  const statuses: Record<string, WorkspaceGitStatus> = {}

  for (const file of localFiles) {
    const remoteContent = remoteByPath.get(file.path)
    if (remoteContent === undefined) {
      statuses[file.path] = 'U'
      continue
    }
    if ((openTabsByPath.get(file.path) ?? file.content ?? '') !== remoteContent) {
      statuses[file.path] = 'M'
    }
  }

  const localPaths = new Set(localFiles.map((file) => file.path))
  for (const path of remoteByPath.keys()) {
    if (!localPaths.has(path)) statuses[path] = 'D'
  }

  return statuses
}
