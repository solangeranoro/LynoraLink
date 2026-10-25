'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, CircleHelp, FlaskConical, Settings2, Sparkles, WandSparkles, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useIdeStore } from '@/store/ide-store'
import { ideEventBus } from '@/lib/ide/event-bus'
import { matchesShortcut } from '@/lib/ide/event-bus'
import { useTranslation } from '@/lib/i18n'

export function LynoaAIToolbar() {
  const { locale } = useTranslation()
  const isFrench = locale === 'fr'
  const activeTabId = useIdeStore((state) => state.activeTabId)
  const activeTab = useIdeStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId))
  const selection = useIdeStore((state) => state.editorSelection)
  const preferences = useIdeStore((state) => state.lynoAISettings)
  const updateSettings = useIdeStore((state) => state.updateLynoAISettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [actionsVisible, setActionsVisible] = useState(true)

  const runQuickAction = useCallback((kind: 'explain' | 'optimize' | 'tests') => {
    const selectedCode = selection?.tabId === activeTabId ? selection.text : ''
    const prompts = {
      explain: 'Explain the selected code, including its behavior and important edge cases.',
      optimize: 'Refactor and optimize the selected code while preserving its behavior. Propose changes for review.',
      tests: 'Generate or suggest tests for the selected code, following this workspace’s conventions. Propose changes for review.',
    }
    useIdeStore.getState().queueLynoAICommand(prompts[kind], selectedCode)
  }, [activeTabId, selection])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeTabId || !preferences.enabled) return
      const target = event.target
      if (target instanceof HTMLElement && (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
        !target.closest('.monaco-editor')
      )) return
      const actions = [
        { shortcut: preferences.shortcuts.explain, type: 'explain' },
        { shortcut: preferences.shortcuts.optimize, type: 'optimize' },
        { shortcut: preferences.shortcuts.tests, type: 'tests' },
      ] as const
      const action = actions.find((item) => matchesShortcut(event, item.shortcut))
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      runQuickAction(action.type)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [activeTabId, preferences, runQuickAction])

  const enabledLabel = isFrench ? 'LynoAI activé' : 'LynoAI is active'
  const disabledLabel = isFrench ? 'LynoAI désactivé' : 'LynoAI is inactive'

  return (
    <div className="coding-lynoai-toolbar" onMouseDown={(event) => event.stopPropagation()}>
      {actionsVisible ? (
      <>
      <div className="coding-lynoai-toolbar-main">
        <span className={`coding-lynoai-status ${preferences.enabled ? 'is-active' : ''}`} title={preferences.enabled ? enabledLabel : disabledLabel}>
          <span className="coding-lynoai-status-dot" />
          <span className="coding-lynoai-brand">LynoaAI</span>
        </span>
        <span className="coding-lynoai-toolbar-divider" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="coding-lynoai-tool-button"
          title={isFrench ? 'Demander une suggestion inline' : 'Request an inline suggestion'}
          disabled={!preferences.enabled || !activeTab}
          onClick={() => {
            if (activeTabId) ideEventBus.emit('editor:command', { tabId: activeTabId, action: 'editor.action.inlineSuggest.trigger' })
          }}
        >
          <Sparkles />
          <span>{isFrench ? 'Suggestion' : 'Suggest'}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="coding-lynoai-tool-button"
          disabled={!preferences.enabled || !activeTab}
          title={isFrench ? 'Expliquer la sélection' : 'Explain selected code'}
          onClick={() => runQuickAction('explain')}
        >
          <CircleHelp />
          <span>{isFrench ? 'Expliquer' : 'Explain'}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="coding-lynoai-tool-button"
          disabled={!preferences.enabled || !activeTab}
          title={isFrench ? 'Optimiser la sélection' : 'Optimize selected code'}
          onClick={() => runQuickAction('optimize')}
        >
          <WandSparkles />
          <span>{isFrench ? 'Optimiser' : 'Optimize'}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="coding-lynoai-tool-button coding-lynoai-tests-button"
          disabled={!preferences.enabled || !activeTab}
          title={isFrench ? 'Générer des tests' : 'Generate tests'}
          onClick={() => runQuickAction('tests')}
        >
          <FlaskConical />
          <span>{isFrench ? 'Tests' : 'Tests'}</span>
        </Button>
        <span className="coding-lynoai-toolbar-divider" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={`coding-lynoai-toggle ${preferences.enabled ? 'is-enabled' : ''}`}
          title={preferences.enabled ? (isFrench ? 'Désactiver LynoaAI' : 'Disable LynoaAI') : (isFrench ? 'Activer LynoaAI' : 'Enable LynoaAI')}
          aria-label={preferences.enabled ? 'Disable LynoaAI' : 'Enable LynoaAI'}
          aria-pressed={preferences.enabled}
          onClick={() => updateSettings({ ...preferences, enabled: !preferences.enabled })}
        >
          <Zap />
        </Button>
        <div className="coding-lynoai-settings-wrap">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="coding-lynoai-toggle"
            aria-label={isFrench ? 'Paramètres LynoaAI' : 'LynoaAI settings'}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Settings2 />
            <ChevronDown className={settingsOpen ? 'rotate-180' : ''} />
          </Button>
          {settingsOpen && (
            <div className="coding-lynoai-settings-popover" role="region" aria-label={isFrench ? 'Paramètres LynoaAI' : 'LynoaAI settings'}>
              <div className="coding-lynoai-settings-heading">
                <div>
                  <p>{isFrench ? 'Paramètres LynoaAI' : 'LynoaAI settings'}</p>
                  <span>{isFrench ? 'Préférences enregistrées sur cet appareil' : 'Preferences saved on this device'}</span>
                </div>
                <Settings2 />
              </div>
              <label className="coding-lynoai-preference-row">
                <span>
                  <strong>{isFrench ? 'Assistant activé' : 'Assistant enabled'}</strong>
                  <small>{isFrench ? 'Complétions et commandes rapides' : 'Inline completions and quick actions'}</small>
                </span>
                <input
                  type="checkbox"
                  checked={preferences.enabled}
                  onChange={(event) => updateSettings({ ...preferences, enabled: event.target.checked })}
                />
              </label>
              <label className="coding-lynoai-model-row">
                <span>
                  <strong>{isFrench ? 'Modèle' : 'Model'}</strong>
                  <small>{isFrench ? 'Rapide pour les complétions, précis pour les tâches complexes' : 'Fast for completions, precise for complex tasks'}</small>
                </span>
                <select
                  value={preferences.model}
                  onChange={(event) => updateSettings({ ...preferences, model: event.target.value === 'precise' ? 'precise' : 'fast' })}
                >
                  <option value="fast">{isFrench ? 'Rapide' : 'Fast'}</option>
                  <option value="precise">{isFrench ? 'Précis' : 'Precise'}</option>
                </select>
              </label>
              <div className="coding-lynoai-shortcuts">
                <strong>{isFrench ? 'Raccourcis' : 'Keyboard shortcuts'}</strong>
                {([
                  ['explain', isFrench ? 'Expliquer' : 'Explain'],
                  ['optimize', isFrench ? 'Optimiser' : 'Optimize'],
                  ['tests', isFrench ? 'Générer des tests' : 'Generate tests'],
                ] as const).map(([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <Input
                      aria-label={`${label} shortcut`}
                      value={preferences.shortcuts[key]}
                      onChange={(event) => updateSettings({
                        ...preferences,
                        shortcuts: { ...preferences.shortcuts, [key]: event.target.value },
                      })}
                    />
                  </label>
                ))}
              </div>
              <div className="coding-lynoai-quota">
                <Check />
                <p>
                  {isFrench
                    ? 'L’accès et les quotas sont gérés par LynoraLink.'
                    : 'Access and quotas are managed by LynoraLink.'}
                </p>
              </div>
            </div>
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="coding-lynoai-toolbar-close"
          title={isFrench ? 'Masquer les actions LynoaAI' : 'Hide LynoaAI actions'}
          aria-label={isFrench ? 'Masquer les actions LynoaAI' : 'Hide LynoaAI actions'}
          onClick={() => setActionsVisible(false)}
        >
          <X />
        </Button>
      </div>
      {activeTab && (
        <div className="coding-lynoai-toolbar-hint">
          {isFrench ? 'Tab accepter · Échap ignorer · Survoler une suggestion pour son contexte' : 'Tab to accept · Esc to dismiss · Hover a suggestion for context'}
        </div>
      )}
      </>
      ) : (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="coding-lynoai-toolbar-reopen"
          title={isFrench ? 'Afficher les actions LynoaAI' : 'Show LynoaAI actions'}
          aria-label={isFrench ? 'Afficher les actions LynoaAI' : 'Show LynoaAI actions'}
          onClick={() => setActionsVisible(true)}
        >
          <Sparkles />
        </Button>
      )}
    </div>
  )
}
