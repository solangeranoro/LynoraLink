import type { FileType, ProjectFile } from '@/types/ide'

export interface WorkspaceFileRecord {
  id: string
  path: string
  isDirectory: boolean
  content: string
  updatedAt: string
}

const languageByExtension: Record<string, string> = {
  c: 'c', cc: 'cpp', cpp: 'cpp', cs: 'csharp', css: 'css', go: 'go',
  h: 'c', hpp: 'cpp', html: 'html', java: 'java', js: 'javascript',
  jsx: 'javascript', json: 'json', md: 'markdown', mjs: 'javascript',
  prisma: 'prisma', py: 'python', rs: 'rust', scss: 'scss', sh: 'shell',
  sql: 'sql', ts: 'typescript', tsx: 'typescript', txt: 'plaintext',
  xml: 'xml', yaml: 'yaml', yml: 'yaml',
}

function fileType(name: string): FileType {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  const known: FileType[] = [
    'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cs', 'c', 'cpp', 'json', 'md',
    'html', 'css', 'scss', 'yml', 'yaml', 'sh', 'sql', 'xml', 'txt', 'env',
    'prisma', 'go', 'rust', 'toml',
  ]
  return known.includes(extension as FileType) ? extension as FileType : 'unknown'
}

export function toProjectFiles(records: WorkspaceFileRecord[]): ProjectFile[] {
  const roots: ProjectFile[] = []
  const nodes = new Map<string, ProjectFile>()

  for (const record of records) {
    const name = record.path.split('/').pop() ?? record.path
    const extension = name.split('.').pop()?.toLowerCase() ?? ''
    const node: ProjectFile = {
      id: record.id,
      name,
      path: record.path,
      type: record.isDirectory ? 'unknown' : fileType(name),
      isDirectory: record.isDirectory,
      content: record.isDirectory ? undefined : record.content,
      children: record.isDirectory ? [] : undefined,
      language: name.toLowerCase() === 'dockerfile'
        ? 'dockerfile'
        : name.toLowerCase().startsWith('.env')
          ? 'ini'
          : languageByExtension[extension] ?? 'plaintext',
      size: record.content.length,
      updatedAt: new Date(record.updatedAt).getTime(),
    }
    nodes.set(record.path, node)

    const parentPath = record.path.includes('/')
      ? record.path.slice(0, record.path.lastIndexOf('/'))
      : ''
    const parent = nodes.get(parentPath)
    if (parent?.isDirectory) parent.children?.push(node)
    else roots.push(node)
  }

  return roots
}

export function flattenProjectFiles(files: ProjectFile[]): ProjectFile[] {
  return files.flatMap((file) => [
    file,
    ...(file.children ? flattenProjectFiles(file.children) : []),
  ])
}
