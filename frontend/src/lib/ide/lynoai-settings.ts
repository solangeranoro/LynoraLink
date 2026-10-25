export type LynoaAIModel = 'fast' | 'precise'

export interface LynoaAISettings {
  enabled: boolean
  model: LynoaAIModel
  shortcuts: {
    explain: string
    optimize: string
    tests: string
  }
}

export const DEFAULT_LYNOAI_SETTINGS: LynoaAISettings = {
  enabled: true,
  model: 'precise',
  shortcuts: {
    explain: 'Ctrl+Alt+E',
    optimize: 'Ctrl+Alt+R',
    tests: 'Ctrl+Alt+T',
  },
}

const storageKey = 'lynoracoding-lynoai-settings-v1'
const extensionInstalledKey = 'lynoracoding-lynoai-extension-installed-v1'

export function loadLynoaAISettings(): LynoaAISettings {
  if (typeof window === 'undefined') return DEFAULT_LYNOAI_SETTINGS
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')
    if (!saved || typeof saved !== 'object') return DEFAULT_LYNOAI_SETTINGS
    const value = saved as Partial<LynoaAISettings>
    return {
      enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_LYNOAI_SETTINGS.enabled,
      model: value.model === 'precise' ? 'precise' : 'fast',
      shortcuts: {
        explain: typeof value.shortcuts?.explain === 'string' ? value.shortcuts.explain : DEFAULT_LYNOAI_SETTINGS.shortcuts.explain,
        optimize: typeof value.shortcuts?.optimize === 'string' ? value.shortcuts.optimize : DEFAULT_LYNOAI_SETTINGS.shortcuts.optimize,
        tests: typeof value.shortcuts?.tests === 'string' ? value.shortcuts.tests : DEFAULT_LYNOAI_SETTINGS.shortcuts.tests,
      },
    }
  } catch (error) {
    console.error('Unable to read LynoaAI preferences from this browser:', error)
    return DEFAULT_LYNOAI_SETTINGS
  }
}

export function saveLynoaAISettings(settings: LynoaAISettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings))
  } catch (error) {
    console.error('Unable to save LynoaAI preferences in this browser:', error)
  }
}

export function loadLynoaAIExtensionInstalled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(extensionInstalledKey) !== 'false'
  } catch (error) {
    console.error('Unable to read LynoAI extension status from this browser:', error)
    return true
  }
}

export function saveLynoaAIExtensionInstalled(installed: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(extensionInstalledKey, String(installed))
}
