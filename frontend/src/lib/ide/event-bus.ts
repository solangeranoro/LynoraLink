export type IdeEventMap = {
  'workspace:loaded': { fileCount: number }
  'file:created': { path: string }
  'file:saved': { path: string }
  'file:deleted': { path: string }
  'editor:active-file-changed': { path: string | null }
  'editor:command': { tabId: string; action: EditorMenuAction }
  'editor:insert-text': { tabId: string; text: string }
  'settings:changed': { settings: EditorSettings }
  'debug:output': { kind: 'log' | 'error' | 'result'; text: string }
  'output:line': { source: 'debug' | 'extension'; kind: 'log' | 'warning' | 'error' | 'result'; text: string; timestamp: number }
  'debug:breakpoint': { path: string; line: number; enabled: boolean }
  'debug:run': { path: string; source: string; breakpoints: number[] }
  'extension:message': { extensionId: string; event: string; payload: unknown }
  'git:status': { provider: 'github' | 'gitlab'; repository: string; branch: string; message: string }
}

export type EditorMenuAction =
  | 'undo'
  | 'redo'
  | 'editor.action.clipboardCutAction'
  | 'editor.action.clipboardCopyAction'
  | 'editor.action.clipboardPasteAction'
  | 'editor.action.selectAll'
  | 'editor.action.smartSelect.expand'
  | 'editor.action.smartSelect.shrink'
  | 'editor.action.insertCursorAbove'
  | 'editor.action.insertCursorBelow'
  | 'editor.action.gotoLine'
  | 'editor.action.inlineSuggest.trigger'

export interface EditorSettings {
  theme: 'light' | 'dark'
  fontFamily: 'monospace' | 'JetBrains Mono' | 'Consolas' | 'Fira Code'
  fontSize: number
  minimap: boolean
  lineNumbers: boolean
  wordWrap: boolean
  tabSize: 2 | 4 | 8
  shortcuts: {
    save: string
    commandPalette: string
    toggleSidebar: string
    toggleTerminal: string
  }
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  theme: 'dark',
  fontFamily: 'monospace',
  fontSize: 13,
  minimap: true,
  lineNumbers: true,
  wordWrap: false,
  tabSize: 2,
  shortcuts: {
    save: 'Ctrl+S',
    commandPalette: 'Ctrl+K',
    toggleSidebar: 'Ctrl+B',
    toggleTerminal: 'Ctrl+`',
  },
}

export function normalizeEditorSettings(value: unknown): EditorSettings {
  const settings = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const shortcuts = settings.shortcuts && typeof settings.shortcuts === 'object'
    ? settings.shortcuts as Record<string, unknown>
    : {}
  const fontFamilies = ['monospace', 'JetBrains Mono', 'Consolas', 'Fira Code'] as const
  const fontFamily = fontFamilies.find((font) => font === settings.fontFamily)
  const normalizeShortcut = (key: keyof EditorSettings['shortcuts']) => {
    const shortcut = shortcuts[key]
    return typeof shortcut === 'string' && isValidShortcut(shortcut)
      ? shortcut
      : DEFAULT_EDITOR_SETTINGS.shortcuts[key]
  }
  return {
    ...DEFAULT_EDITOR_SETTINGS,
    theme: settings.theme === 'light' ? 'light' : 'dark',
    fontFamily: fontFamily ?? DEFAULT_EDITOR_SETTINGS.fontFamily,
    fontSize: typeof settings.fontSize === 'number' && Number.isInteger(settings.fontSize) && settings.fontSize >= 10 && settings.fontSize <= 32
      ? settings.fontSize
      : DEFAULT_EDITOR_SETTINGS.fontSize,
    minimap: typeof settings.minimap === 'boolean' ? settings.minimap : DEFAULT_EDITOR_SETTINGS.minimap,
    lineNumbers: typeof settings.lineNumbers === 'boolean' ? settings.lineNumbers : DEFAULT_EDITOR_SETTINGS.lineNumbers,
    wordWrap: typeof settings.wordWrap === 'boolean' ? settings.wordWrap : DEFAULT_EDITOR_SETTINGS.wordWrap,
    tabSize: settings.tabSize === 4 || settings.tabSize === 8
      ? settings.tabSize
      : DEFAULT_EDITOR_SETTINGS.tabSize,
    shortcuts: {
      save: normalizeShortcut('save'),
      commandPalette: normalizeShortcut('commandPalette'),
      toggleSidebar: normalizeShortcut('toggleSidebar'),
      toggleTerminal: normalizeShortcut('toggleTerminal'),
    },
  }
}

export function isValidShortcut(shortcut: string): boolean {
  const parts = shortcut.split('+').map((part) => part.trim())
  if (parts.length < 2 || parts.some((part) => !part)) return false
  const modifiers = parts.slice(0, -1).map((part) => part.toLowerCase())
  const key = parts.at(-1)!
  const validModifiers = new Set(['ctrl', 'cmd', 'alt', 'shift'])
  if (modifiers.some((modifier) => !validModifiers.has(modifier))) return false
  if (new Set(modifiers).size !== modifiers.length) return false
  if (modifiers.includes('ctrl') && modifiers.includes('cmd')) return false
  return /^[a-z0-9]$|^f(?:[1-9]|1[0-2])$|^(?:backspace|delete|enter|escape|tab|arrowup|arrowdown|arrowleft|arrowright|`)$/i.test(key)
}

export function shortcutIdentity(shortcut: string): string {
  const parts = shortcut.toLowerCase().split('+').map((part) => part.trim())
  return [...parts.slice(0, -1).sort(), parts.at(-1)].join('+')
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const keys = shortcut.toLowerCase().split('+').map((key) => key.trim())
  const key = keys.at(-1)
  if (!key) return false
  const modifiers = new Set(keys.slice(0, -1))
  const alt = modifiers.has('alt')
  const shift = modifiers.has('shift')
  const eventKey = event.key.toLowerCase()
  const normalizedKey = key === 'esc' ? 'escape' : key
  return eventKey === normalizedKey &&
    event.ctrlKey === modifiers.has('ctrl') &&
    event.metaKey === modifiers.has('cmd') &&
    event.altKey === alt &&
    event.shiftKey === shift
}

type Listener<T> = (payload: T) => void

class IdeEventBus {
  private listeners = new Map<keyof IdeEventMap, Set<Listener<never>>>()

  on<K extends keyof IdeEventMap>(event: K, listener: Listener<IdeEventMap[K]>): () => void {
    const listeners = this.listeners.get(event) ?? new Set<Listener<never>>()
    listeners.add(listener as Listener<never>)
    this.listeners.set(event, listeners)
    return () => {
      listeners.delete(listener as Listener<never>)
      if (listeners.size === 0) this.listeners.delete(event)
    }
  }

  emit<K extends keyof IdeEventMap>(event: K, payload: IdeEventMap[K]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload as never)
  }
}

export const ideEventBus = new IdeEventBus()
