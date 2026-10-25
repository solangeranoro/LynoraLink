'use client'

import { useIdeStore } from '@/store/ide-store'
import type { EditorSettings } from '@/lib/ide/event-bus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isValidShortcut, shortcutIdentity } from '@/lib/ide/event-bus'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const shortcutLabels = {
  save: 'Save all files',
  commandPalette: 'Command palette',
  toggleSidebar: 'Toggle sidebar',
  toggleTerminal: 'Toggle console',
} as const

export function SettingsPanel() {
  const { settings, updateSettings, resetSettings } = useIdeStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const [shortcutDrafts, setShortcutDrafts] = useState(settings.shortcuts)
  useEffect(() => {
    const shell = panelRef.current?.closest('.coding-shell')
    setPortalContainer(shell instanceof HTMLElement ? shell : null)
  }, [])
  useEffect(() => setShortcutDrafts(settings.shortcuts), [settings.shortcuts])
  const update = (patch: Partial<EditorSettings>) => {
    void updateSettings({ ...settings, ...patch })
  }

  return (
    <div ref={panelRef} className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</span>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void resetSettings()}>
          Reset defaults
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        <label className="block space-y-1.5 text-xs">
          <span className="font-medium">Color theme</span>
          <Select
            value={settings.theme}
            onValueChange={(value) => update({ theme: value as EditorSettings['theme'] })}
          >
            <SelectTrigger aria-label="Color theme" size="sm" className="w-full bg-card text-xs shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              container={portalContainer}
              align="start"
              className="min-w-[var(--radix-select-trigger-width)]"
              style={{
                backgroundColor: 'var(--coding-popover)',
                color: 'var(--coding-popover-foreground)',
                borderColor: 'var(--coding-border)',
              }}
            >
              <SelectItem value="dark" className="text-xs">Dark</SelectItem>
              <SelectItem value="light" className="text-xs">Light</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <section className="space-y-3">
          <h2 className="text-xs font-medium">Editor display</h2>
          {([
            ['minimap', 'Show minimap'],
            ['lineNumbers', 'Show line numbers'],
            ['wordWrap', 'Wrap long lines'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-2 text-xs">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={settings[key]}
                className="h-4 w-4 accent-emerald-600"
                onChange={(event) => update({ [key]: event.target.checked })}
              />
            </label>
          ))}
          <label className="block space-y-1.5 text-xs">
            <span className="font-medium">Tab size</span>
            <Select
              value={String(settings.tabSize)}
              onValueChange={(value) => update({ tabSize: Number(value) as EditorSettings['tabSize'] })}
            >
              <SelectTrigger aria-label="Tab size" size="sm" className="w-full bg-card text-xs shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                container={portalContainer}
                align="start"
                className="min-w-[var(--radix-select-trigger-width)]"
                style={{
                  backgroundColor: 'var(--coding-popover)',
                  color: 'var(--coding-popover-foreground)',
                  borderColor: 'var(--coding-border)',
                }}
              >
                {[2, 4, 8].map((size) => (
                  <SelectItem key={size} value={String(size)} className="text-xs">{size} spaces</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </section>
        <label className="block space-y-1.5 text-xs">
          <span className="font-medium">Editor font</span>
          <Select
            value={settings.fontFamily}
            onValueChange={(value) => update({ fontFamily: value as EditorSettings['fontFamily'] })}
          >
            <SelectTrigger aria-label="Editor font" size="sm" className="w-full bg-card text-xs shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              container={portalContainer}
              align="start"
              className="min-w-[var(--radix-select-trigger-width)]"
              style={{
                backgroundColor: 'var(--coding-popover)',
                color: 'var(--coding-popover-foreground)',
                borderColor: 'var(--coding-border)',
              }}
            >
              {['monospace', 'JetBrains Mono', 'Consolas', 'Fira Code'].map((font) => (
                <SelectItem key={font} value={font} className="text-xs">{font}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="block space-y-1.5 text-xs">
          <span className="flex justify-between font-medium">
            <span>Font size</span><span>{settings.fontSize}px</span>
          </span>
          <input
            type="range"
            min={10}
            max={32}
            value={settings.fontSize}
            className="w-full accent-emerald-600"
            onChange={(event) => update({ fontSize: Number(event.target.value) })}
          />
        </label>
        <section className="space-y-2">
          <h2 className="text-xs font-medium">Keyboard shortcuts</h2>
          {Object.entries(shortcutLabels).map(([key, label]) => {
            const shortcutKey = key as keyof EditorSettings['shortcuts']
            return (
              <label key={key} className="flex items-center justify-between gap-2 text-xs">
                <span>{label}</span>
                <Input
                  className="h-7 w-28 text-center font-mono text-[11px]"
                  value={shortcutDrafts[shortcutKey]}
                  aria-label={`${label} shortcut`}
                  placeholder="Ctrl+S"
                  onChange={(event) => setShortcutDrafts((drafts) => ({
                    ...drafts,
                    [shortcutKey]: event.target.value,
                  }))}
                  onBlur={(event) => {
                    const shortcut = event.target.value.trim()
                    const current = useIdeStore.getState().settings
                    const duplicate = Object.entries(current.shortcuts).some(([otherKey, value]) =>
                      otherKey !== shortcutKey && shortcutIdentity(value) === shortcutIdentity(shortcut))
                    if (!isValidShortcut(shortcut) || duplicate) {
                      toast.error(duplicate ? 'This shortcut is already assigned.' : 'Use a valid shortcut such as Ctrl+Shift+P.')
                      setShortcutDrafts((drafts) => ({ ...drafts, [shortcutKey]: current.shortcuts[shortcutKey] }))
                      return
                    }
                    void useIdeStore.getState().updateSettings({
                      ...current,
                      shortcuts: { ...current.shortcuts, [shortcutKey]: shortcut },
                    })
                  }}
                />
              </label>
            )
          })}
          <p className="text-[10px] text-muted-foreground">Use a modifier and one key, for example Ctrl+S, Ctrl+Shift+P, or Alt+K.</p>
        </section>
        <p className="text-[10px] text-muted-foreground">
          Settings are saved automatically to your account and restored on your next sign-in.
        </p>
      </div>
    </div>
  )
}
