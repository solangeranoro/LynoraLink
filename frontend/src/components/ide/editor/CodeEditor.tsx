'use client'

import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import { useRef, useEffect, useState } from 'react'
import { useIdeStore } from '@/store/ide-store'
import { editor } from 'monaco-editor'
import { ideEventBus } from '@/lib/ide/event-bus'
import { LynoaAIExtension } from '@/lib/ide/lynoai-extension'
import { toast } from 'sonner'
import { pythonLanguage } from '@codemirror/lang-python'
import { createCodingCollaborationSession } from '@/lib/workspace-api'

interface CodeEditorProps {
  tabId: string
  value: string
  language: string
  teamId: string | null
  onChange: (value: string) => void
}

export function CodeEditor({ tabId, value, language, teamId, onChange }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const theme = useIdeStore((s) => s.theme)
  const settings = useIdeStore((s) => s.settings)
  const lynoAIEnabled = useIdeStore((s) => s.lynoAISettings.enabled)
  const updateTabContent = useIdeStore((s) => s.updateTabContent)
  const setEditorSelection = useIdeStore((s) => s.setEditorSelection)
  const setFileProblems = useIdeStore((s) => s.setFileProblems)
  const isActiveTab = useIdeStore((s) => s.activeTabId === tabId)
  const filePath = useIdeStore((s) => s.tabs.find((tab) => tab.id === tabId)?.path)
  const [editorMounted, setEditorMounted] = useState(false)

  useEffect(() => {
    const editorInstance = editorRef.current
    const model = editorInstance?.getModel()
    if (!editorMounted || !teamId || !filePath || !editorInstance || !model) {
      editorInstance?.updateOptions({ readOnly: false })
      return
    }

    let cancelled = false
    let provider: import('y-websocket').WebsocketProvider | null = null
    let doc: import('yjs').Doc | null = null
    let binding: import('y-monaco').MonacoBinding | null = null
    let persistence: import('y-indexeddb').IndexeddbPersistence | null = null

    const connect = async () => {
      try {
        const session = await createCodingCollaborationSession(teamId, filePath)
        if (cancelled) return
        editorInstance.updateOptions({ readOnly: session.role === 'OBSERVER' })

        const [{ WebsocketProvider }, Y, { MonacoBinding }] = await Promise.all([
          import('y-websocket'),
          import('yjs'),
          import('y-monaco'),
        ])
        if (cancelled) return

        doc = new Y.Doc()
        const { IndexeddbPersistence } = await import('y-indexeddb')
        if (cancelled) return
        persistence = new IndexeddbPersistence(`${teamId}/${filePath}`, doc)
        provider = new WebsocketProvider(
          session.websocketUrl,
          `${teamId}/${encodeURIComponent(filePath)}`,
          doc,
          { params: { token: session.ticket }, disableBc: true },
        )
        const colors = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ec4899']
        const colorIndex = [...session.user.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % colors.length
        provider.awareness.setLocalStateField('user', {
          id: session.user.id,
          name: session.user.name,
          color: colors[colorIndex],
        })
        const onSync = (synced: boolean) => {
          if (cancelled || !synced || binding || !doc) return
          binding = new MonacoBinding(
            doc.getText('monaco'),
            model,
            new Set([editorInstance]),
            provider?.awareness,
          )
        }
        provider.on('sync', onSync)
        provider.on('closed', (event: { code: number }) => {
          if (event.code >= 4400 && event.code < 4500) {
            editorInstance.updateOptions({ readOnly: true })
            toast.error('Your team coding permissions changed. Reopen the workspace to continue.')
          }
        })
      } catch (error) {
        if (!cancelled) {
          editorInstance.updateOptions({ readOnly: true })
          toast.error(error instanceof Error ? error.message : 'Could not connect to the team workspace.')
        }
      }
    }

    void connect()
    return () => {
      cancelled = true
      binding?.destroy()
      provider?.destroy()
      persistence?.destroy()
      doc?.destroy()
    }
  }, [editorMounted, filePath, teamId])

  // Apply theme whenever it changes
  useEffect(() => {
    const monaco = monacoRef.current
    if (!monaco) return
    if (theme === 'dark') {
      monaco.editor.defineTheme('lynora-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
          { token: 'string', foreground: '4ade80' },
          { token: 'keyword', foreground: 'c084fc' },
          { token: 'number', foreground: 'fbbf24' },
          { token: 'type', foreground: '22d3ee' },
        ],
        colors: {
          'editor.background': '#0b0f17',
          'editor.foreground': '#e2e8f0',
          'editorLineNumber.foreground': '#475569',
          'editorLineNumber.activeForeground': '#94a3b8',
          'editor.selectionBackground': '#33415580',
          'editor.lineHighlightBackground': '#1e293b50',
          'editorCursor.foreground': '#4ade80',
          'editorIndentGuide.background': '#1e293b',
          'editorIndentGuide.activeBackground': '#334155',
          'editorWidget.background': '#0f172a',
          'editorWidget.border': '#1e293b',
          'editorSuggestWidget.background': '#0f172a',
          'editorSuggestWidget.selectedBackground': '#1e293b',
          'editorSuggestWidget.border': '#1e293b',
          'editorHoverWidget.background': '#0f172a',
          'scrollbarSlider.background': '#33415580',
        },
      })
      monaco.editor.setTheme('lynora-dark')
    } else {
      monaco.editor.setTheme('light')
    }
  }, [theme])

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      minimap: { enabled: settings.minimap },
      lineNumbers: settings.lineNumbers ? 'on' : 'off',
      wordWrap: settings.wordWrap ? 'on' : 'off',
      tabSize: settings.tabSize,
    })
  }, [settings.fontFamily, settings.fontSize, settings.lineNumbers, settings.minimap, settings.tabSize, settings.wordWrap])

  useEffect(() => {
    editorRef.current?.updateOptions({ inlineSuggest: { enabled: lynoAIEnabled } })
  }, [lynoAIEnabled])

  const editorRevealRequest = useIdeStore((state) => state.editorRevealRequest)
  const clearEditorRevealRequest = useIdeStore((state) => state.clearEditorRevealRequest)
  useEffect(() => {
    const editorInstance = editorRef.current
    if (!editorMounted || !isActiveTab || !editorInstance || !filePath ||
      !editorRevealRequest || editorRevealRequest.path !== filePath) return
    const position = {
      lineNumber: editorRevealRequest.line,
      column: editorRevealRequest.column,
    }
    editorInstance.focus()
    editorInstance.setPosition(position)
    editorInstance.revealPositionInCenter(position)
    clearEditorRevealRequest(editorRevealRequest.id)
  }, [clearEditorRevealRequest, editorMounted, editorRevealRequest, filePath, isActiveTab])

  useEffect(() => {
    const editorInstance = editorRef.current
    const monaco = monacoRef.current
    if (!editorMounted || !isActiveTab || !lynoAIEnabled || !editorInstance || !monaco || !filePath) return

    const provider = LynoaAIExtension.registerInlineCompletions(monaco, editorInstance, filePath, language)
    return () => provider.dispose()
  }, [editorMounted, filePath, isActiveTab, language, lynoAIEnabled])

  const handleMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance
    monacoRef.current = monaco
    setEditorMounted(true)
    const model = editorInstance.getModel()
    let analysisTimer: ReturnType<typeof setTimeout> | undefined
    const updateProblems = () => {
      if (!model || !filePath) return
      const problems = monaco.editor.getModelMarkers({ resource: model.uri }).map((marker: editor.IMarker) => ({
        path: filePath,
        line: marker.startLineNumber,
        column: marker.startColumn,
        endLine: marker.endLineNumber,
        endColumn: marker.endColumn,
        message: marker.message,
        source: marker.source,
        code: typeof marker.code === 'string' ? marker.code : marker.code?.value,
        relatedInformation: marker.relatedInformation?.map((related) => ({
          path: related.resource.path.replace(/^\//, ''),
          line: related.startLineNumber,
          column: related.startColumn,
          message: related.message,
        })),
        severity: marker.severity === monaco.MarkerSeverity.Error
          ? 'error' as const
          : marker.severity === monaco.MarkerSeverity.Warning
            ? 'warning' as const
            : marker.severity === monaco.MarkerSeverity.Hint
              ? 'hint' as const
              : 'info' as const,
      }))
      setFileProblems(filePath, problems)
    }
    const analyzePythonSyntax = () => {
      if (!model || language !== 'python') return
      const syntaxTree = pythonLanguage.parser.parse(model.getValue())
      const cursor = syntaxTree.cursor()
      const markers: editor.IMarkerData[] = []
      do {
        if (!cursor.type.isError) continue
        const start = model.getPositionAt(cursor.from)
        const end = model.getPositionAt(cursor.to)
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'Invalid Python syntax.',
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: Math.max(end.column, start.column + 1),
        })
      } while (cursor.next())
      monaco.editor.setModelMarkers(model, 'lynora-python-syntax', markers)
    }
    const markerListener = monaco.editor.onDidChangeMarkers((resources: readonly { toString: () => string }[]) => {
      if (model && resources.some((resource) => resource.toString() === model.uri.toString())) {
        updateProblems()
      }
    })
    const contentListener = model?.onDidChangeContent(() => {
      if (analysisTimer) clearTimeout(analysisTimer)
      analysisTimer = setTimeout(() => {
        analyzePythonSyntax()
        updateProblems()
      }, 200)
    })
    analysisTimer = setTimeout(() => {
      analyzePythonSyntax()
      updateProblems()
    }, 200)
    editorInstance.updateOptions({
      minimap: { enabled: settings.minimap },
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      glyphMargin: true,
      lineNumbers: settings.lineNumbers ? 'on' : 'off',
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? 'on' : 'off',
      inlineSuggest: { enabled: lynoAIEnabled },
    })
    const breakpoints = new Set<number>()
    let decorationIds: string[] = []
    const mouseDown = editorInstance.onMouseDown((event) => {
      if (event.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return
      const line = event.target.position?.lineNumber
      if (!line || !filePath) return
      const enabled = !breakpoints.has(line)
      if (enabled) breakpoints.add(line)
      else breakpoints.delete(line)
      ideEventBus.emit('debug:breakpoint', { path: filePath, line, enabled })
      const decorations = [...breakpoints].map((lineNumber) => ({
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: { isWholeLine: false, glyphMarginClassName: 'lynora-debug-breakpoint' },
      }))
      decorationIds = editorInstance.deltaDecorations(decorationIds, decorations)
    })
    const removeBreakpointListener = ideEventBus.on('debug:breakpoint', (event) => {
      if (event.path !== filePath) return
      if (event.enabled) breakpoints.add(event.line)
      else breakpoints.delete(event.line)
      decorationIds = editorInstance.deltaDecorations(decorationIds, [...breakpoints].map((lineNumber) => ({
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: { glyphMarginClassName: 'lynora-debug-breakpoint' },
      })))
    })
    const removeEditorCommandListener = ideEventBus.on('editor:command', ({ tabId: targetTabId, action }) => {
      if (targetTabId !== tabId) return
      editorInstance.focus()
      editorInstance.trigger('menu', action, null)
    })
    const completionAcceptedAction = editorInstance.addAction({
      id: 'lynoai.completion-accepted',
      label: 'LynoaAI: completion accepted',
      run: () => {
        toast.success('Suggestion generated by LynoaAI', {
          action: {
            label: 'Open LynoaAI',
            onClick: () => useIdeStore.getState().openPanel('assistant'),
          },
        })
      },
    })
    const removeInsertTextListener = ideEventBus.on('editor:insert-text', ({ tabId: targetTabId, text }) => {
      if (targetTabId !== tabId || !text) return
      const position = editorInstance.getPosition()
      if (!position) return
      editorInstance.executeEdits('lynoai-snippet', [{
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text,
        forceMoveMarkers: true,
      }])
      editorInstance.focus()
    })
    const selectionListener = editorInstance.onDidChangeCursorSelection((event) => {
      const selection = event.selection
      const text = editorInstance.getModel()?.getValueInRange(selection) ?? ''
      setEditorSelection(text.trim() ? { tabId, text: text.slice(0, 20_000) } : null)
    })

    // Apply theme on mount
    if (theme === 'dark') {
      monaco.editor.defineTheme('lynora-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
          { token: 'string', foreground: '4ade80' },
          { token: 'keyword', foreground: 'c084fc' },
          { token: 'number', foreground: 'fbbf24' },
          { token: 'type', foreground: '22d3ee' },
        ],
        colors: {
          'editor.background': '#0b0f17',
          'editor.foreground': '#e2e8f0',
          'editorLineNumber.foreground': '#475569',
          'editorLineNumber.activeForeground': '#94a3b8',
          'editor.selectionBackground': '#33415580',
          'editor.lineHighlightBackground': '#1e293b50',
          'editorCursor.foreground': '#4ade80',
          'editorIndentGuide.background': '#1e293b',
          'editorIndentGuide.activeBackground': '#334155',
          'editorWidget.background': '#0f172a',
          'editorWidget.border': '#1e293b',
          'editorSuggestWidget.background': '#0f172a',
          'editorSuggestWidget.selectedBackground': '#1e293b',
          'editorSuggestWidget.border': '#1e293b',
          'editorHoverWidget.background': '#0f172a',
          'scrollbarSlider.background': '#33415580',
        },
      })
      monaco.editor.setTheme('lynora-dark')
    } else {
      monaco.editor.setTheme('light')
    }

    // Configure TypeScript defaults
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      typeRoots: ['node_modules/@types'],
    })

    editorInstance.focus()
    const dispose = () => {
      mouseDown.dispose()
      markerListener.dispose()
      contentListener?.dispose()
      if (analysisTimer) clearTimeout(analysisTimer)
      if (model) {
        monaco.editor.setModelMarkers(model, 'lynora-python-syntax', [])
      }
      if (filePath) setFileProblems(filePath, [])
      removeBreakpointListener()
      removeEditorCommandListener()
      removeInsertTextListener()
      completionAcceptedAction.dispose()
      selectionListener.dispose()
    }
    editorInstance.onDidDispose(dispose)
    const editorNode = editorInstance.getDomNode()
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('text/plain')) event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      const text = event.dataTransfer?.getData('text/plain')
      if (!text) return
      event.preventDefault()
      const position = editorInstance.getTargetAtClientPoint(event.clientX, event.clientY)?.position
      if (!position) return
      editorInstance.executeEdits('lynoai-snippet', [{
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text,
        forceMoveMarkers: true,
      }])
      editorInstance.setPosition(position)
      editorInstance.focus()
    }
    editorNode?.addEventListener('dragover', onDragOver)
    editorNode?.addEventListener('drop', onDrop)
    editorInstance.onDidDispose(() => {
      editorNode?.removeEventListener('dragover', onDragOver)
      editorNode?.removeEventListener('drop', onDrop)
    })
  }

  const handleChange: OnChange = (value) => {
    onChange(value ?? '')
    updateTabContent(tabId, value ?? '')
  }

  return (
    <Editor
      height="100%"
      width="100%"
      language={language}
      value={value}
      onMount={handleMount}
      onChange={handleChange}
      theme={theme === 'dark' ? 'lynora-dark' : 'light'}
      loading={<div className="flex items-center justify-center h-full text-xs text-muted-foreground">Loading editor…</div>}
      options={{
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        lineNumbers: settings.lineNumbers ? 'on' : 'off',
        minimap: { enabled: settings.minimap, scale: 1, renderCharacters: false },
        tabSize: settings.tabSize,
        wordWrap: settings.wordWrap ? 'on' : 'off',
        glyphMargin: true,
        lineHeight: 20,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        roundedSelection: true,
        automaticLayout: true,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: 'active', indentation: true },
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        inlineSuggest: { enabled: lynoAIEnabled },
        quickSuggestions: { other: true, comments: false, strings: true },
        stickyScroll: { enabled: true },
        renderLineHighlight: 'all',
        renderWhitespace: 'selection',
        fontLigatures: true,
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  )
}
