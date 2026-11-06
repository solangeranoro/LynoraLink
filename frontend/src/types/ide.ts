// LynoraCoding IDE — Core types

export type FileType =
  | 'js' | 'ts' | 'tsx' | 'jsx' | 'py' | 'java' | 'cs' | 'go'
  | 'rust' | 'c' | 'cpp' | 'json' | 'md' | 'html' | 'css' | 'scss'
  | 'yml' | 'yaml' | 'sh' | 'sql' | 'xml' | 'txt' | 'env' | 'prisma'
  | 'toml' | 'dockerfile' | 'unknown'

export interface ProjectFile {
  id: string
  name: string
  path: string        // full path from project root
  type: FileType
  isDirectory: boolean
  content?: string    // for files only
  children?: ProjectFile[] // for directories only
  language?: string   // monaco language id
  size?: number
  updatedAt: number
}

export interface EditorTab {
  id: string
  fileId: string
  name: string
  path: string
  language: string
  content: string
  originalContent: string
  isDirty: boolean
  isActive: boolean
  cursor?: { line: number; column: number }
  scrollTop?: number
}

export interface ProblemDiagnostic {
  path: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
  message: string
  severity: 'error' | 'warning' | 'info' | 'hint'
  source?: string
  code?: string
  relatedInformation?: { path?: string; line?: number; column?: number; message: string }[]
}

export interface IdeOutputEntry {
  id: number
  source: 'debug' | 'extension'
  kind: 'log' | 'warning' | 'error' | 'result'
  text: string
  timestamp: number
}

export interface CodingTerminalPort {
  containerPort: number
  hostPort: number
}

export interface TerminalSession {
  id: string
  name: string
  cwd: string
  mode: 'docker' | 'simulated' | null
  architecture: string | null
  running: boolean
  connecting: boolean
  connectionId: string | null
  clearVersion: number
}

export interface SearchResult {
  fileId: string
  filePath: string
  fileName: string
  matches: SearchMatch[]
}

export interface SearchMatch {
  line: number
  column: number
  text: string
  beforeContext: string
  afterContext: string
}

export interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
}

export type PanelKey = 'assistant' | 'explorer' | 'search' | 'api-tester' | 'browser' | 'settings' | 'debug' | 'extensions' | 'source-control' | 'problems'

export type BottomPanelKey = 'terminal' | 'problems' | 'output' | 'debug-console' | 'ports'
