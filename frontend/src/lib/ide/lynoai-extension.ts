import type { editor } from 'monaco-editor'
import type * as Monaco from 'monaco-editor'
import { flattenProjectFiles } from '@/lib/workspace-files'
import { useIdeStore } from '@/store/ide-store'
import { codingWorkspaceHeaders } from '@/lib/workspace-api'
import { isLynoAIQuota, publishLynoAIQuota } from '@/lib/lynoai-quota'

export class LynoaAIExtension {
  static registerInlineCompletions(
    monaco: typeof Monaco,
    editorInstance: editor.IStandaloneCodeEditor,
    filePath: string,
    language: string,
  ) {
    let lastCompletionAt = 0
    const provider = monaco.languages.registerInlineCompletionsProvider(language, {
      provideInlineCompletions: async (model, position, _context, token) => {
        if (model !== editorInstance.getModel() || token.isCancellationRequested) return { items: [] }
        const preferences = useIdeStore.getState().lynoAISettings
        if (!preferences.enabled) return { items: [] }
        const content = model.getValue()
        if (content.length > 80_000 || !content.trim()) return { items: [] }

        await new Promise((resolve) => window.setTimeout(resolve, 450))
        if (token.isCancellationRequested || Date.now() - lastCompletionAt < 1200) {
          return { items: [] }
        }
        const state = useIdeStore.getState()
        const activeFile = flattenProjectFiles(state.files).find((file) => file.path === filePath)
        if (!activeFile || activeFile.isDirectory) return { items: [] }

        lastCompletionAt = Date.now()
        const controller = new AbortController()
        const cancellation = token.onCancellationRequested(() => controller.abort())
        try {
          const workspaceHeaders = await codingWorkspaceHeaders()
          const response = await fetch('/api/ai/coding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...workspaceHeaders },
            signal: controller.signal,
            body: JSON.stringify({
              mode: 'complete',
              modelTier: useIdeStore.getState().lynoAISettings.model,
              message: 'Complete the code at the cursor.',
              conversationId: `completion-${crypto.randomUUID()}`,
              locale: 'en',
              language,
              cursor: { line: position.lineNumber, column: position.column },
              activeFile: {
                path: filePath,
                content,
                savedContent: activeFile.content ?? '',
              },
            }),
          })
          const result: unknown = await response.json()
          if (result && typeof result === 'object' && 'quota' in result && isLynoAIQuota(result.quota)) {
            publishLynoAIQuota(result.quota)
          }
          if (!response.ok) {
            console.warn(`LynoAI inline completion request failed with HTTP ${response.status}.`)
            return { items: [] }
          }
          if (!result || typeof result !== 'object' || !('reply' in result) ||
            typeof result.reply !== 'string' || token.isCancellationRequested) return { items: [] }
          const insertText = result.reply.trim().replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '')
          if (!insertText) return { items: [] }
          const explanation = 'explanation' in result && typeof result.explanation === 'string'
            ? result.explanation
            : 'Suggestion generated from the surrounding code.'
          return {
            items: [{
              insertText,
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
              warning: { message: explanation },
              command: { id: 'lynoai.completion-accepted', title: 'LynoaAI completion accepted' },
            }],
          }
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            console.error('LynoAI inline completion failed:', error)
          }
          return { items: [] }
        } finally {
          cancellation.dispose()
        }
      },
      disposeInlineCompletions: () => {},
    })
    const enterKeybinding = monaco.editor.addKeybindingRule({
      keybinding: monaco.KeyCode.Enter,
      command: 'editor.action.inlineSuggest.commit',
      when: 'inlineSuggestionVisible && editorTextFocus',
    })
    return {
      dispose: () => {
        provider.dispose()
        enterKeybinding.dispose()
      },
    }
  }
}
