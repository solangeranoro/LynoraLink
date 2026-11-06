'use client'

import { useCallback, useState } from 'react'
import {
  Check, CheckCircle2, ChevronDown, Circle, FileText, ListChecks, LoaderCircle,
  PackageCheck, Pencil, Search, Sparkles, Terminal, XCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type WorkflowStepId = 'read' | 'analyze' | 'todo' | 'edit' | 'execute' | 'commit'
export type WorkflowStepStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed'

export type WorkflowTodo = {
  id: string
  title: string
  completed: boolean
}

export type WorkflowLog = {
  id: string
  kind: 'stdout' | 'stderr'
  text: string
}

export type WorkflowStep = {
  id: WorkflowStepId
  title: string
  status: WorkflowStepStatus
  details: string
}

const workflowDefinitions: { id: WorkflowStepId; title: string; icon: LucideIcon }[] = [
  { id: 'read', title: 'Read', icon: FileText },
  { id: 'analyze', title: 'Analyze', icon: Search },
  { id: 'todo', title: 'TODO', icon: ListChecks },
  { id: 'edit', title: 'Edit', icon: Pencil },
  { id: 'execute', title: 'Execute', icon: Terminal },
  { id: 'commit', title: 'Commit', icon: PackageCheck },
]

function emptySteps(): WorkflowStep[] {
  return workflowDefinitions.map(({ id, title }) => ({
    id,
    title,
    status: 'idle',
    details: '',
  }))
}

export function useWorkflowSteps() {
  const [steps, setSteps] = useState<WorkflowStep[]>(emptySteps)
  const [todos, setTodos] = useState<WorkflowTodo[]>([])
  const [logs, setLogs] = useState<WorkflowLog[]>([])

  const start = useCallback((filePath: string | undefined, prompt: string) => {
    setSteps(emptySteps().map((step) => step.id === 'read'
      ? {
        ...step,
        status: 'running',
        details: filePath ? `Opening ${filePath}` : `Indexing workspace for: ${prompt.slice(0, 90)}`,
      }
      : step))
    setTodos([])
    setLogs([])
  }, [])

  const setStep = useCallback((
    id: WorkflowStepId,
    status: WorkflowStepStatus,
    details: string,
  ) => {
    setSteps((current) => current.map((step) => step.id === id
      ? { ...step, status, details }
      : step))
  }, [])

  const updateForProgress = useCallback((stage: string) => {
    const progressSteps: Record<string, WorkflowStepId> = {
      analyzing: 'analyze',
      reading: 'read',
      analyzing_context: 'analyze',
      editing: 'edit',
      preparing_changes: 'todo',
    }
    const currentStep = progressSteps[stage]
    if (!currentStep) return
    const currentIndex = workflowDefinitions.findIndex((step) => step.id === currentStep)
    setSteps((current) => current.map((step, index) => {
      if (index < currentIndex && step.status !== 'completed') {
        return { ...step, status: 'completed' }
      }
      if (step.id === currentStep) {
        return { ...step, status: 'running' }
      }
      return step
    }))
  }, [])

  const setPlan = useCallback((items: string[]) => {
    const nextTodos = items.map((title, index) => ({
      id: `todo-${index}-${title.slice(0, 24)}`,
      title,
      completed: false,
    }))
    setTodos(nextTodos)
    setSteps((current) => current.map((step) => step.id === 'todo'
      ? {
        ...step,
        status: nextTodos.length ? 'running' : 'completed',
        details: nextTodos.length ? `${nextTodos.length} tasks awaiting your review` : 'No tasks required',
      }
      : step))
  }, [])

  const toggleTodo = useCallback((id: string) => {
    const next = todos.map((todo) => todo.id === id
      ? { ...todo, completed: !todo.completed }
      : todo)
    const completed = next.filter((todo) => todo.completed).length
    setTodos(next)
    setSteps((stepsCurrent) => stepsCurrent.map((step) => step.id === 'todo'
      ? {
        ...step,
        status: next.length > 0 && completed === next.length ? 'completed' : 'running',
        details: `${completed}/${next.length} tasks checked`,
      }
      : step))
  }, [todos])

  const addOutput = useCallback((output: string) => {
    if (!output) return
    const entries = output.split(/\r?\n/).filter(Boolean).map((line, index) => {
      const isError = /\x1b\[(?:0;)?31m/.test(line)
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        kind: isError ? 'stderr' as const : 'stdout' as const,
        text: line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ''),
      }
    })
    if (!entries.length) return
    setLogs((current) => [...current, ...entries].slice(-200))
  }, [])

  const clear = useCallback(() => {
    setSteps(emptySteps())
    setTodos([])
    setLogs([])
  }, [])

  return {
    steps,
    todos,
    logs,
    start,
    setStep,
    updateForProgress,
    setPlan,
    toggleTodo,
    addOutput,
    clear,
    allTodosComplete: todos.length > 0 && todos.every((todo) => todo.completed),
  }
}

export function TodoList({
  todos,
  isFrench,
  onToggle,
}: {
  todos: WorkflowTodo[]
  isFrench: boolean
  onToggle: (id: string) => void
}) {
  if (!todos.length) {
    return (
      <p className="px-1 py-1 text-[10px] text-muted-foreground">
        {isFrench ? 'Le plan apparaîtra après l’analyse.' : 'The plan will appear after analysis.'}
      </p>
    )
  }
  return (
    <ul className="space-y-1">
      {todos.map((todo) => (
        <li key={todo.id}>
          <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-[10px] leading-relaxed hover:bg-accent/50">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#00c2c7]"
              checked={todo.completed}
              onChange={() => onToggle(todo.id)}
            />
            <span className={cn(todo.completed && 'text-muted-foreground line-through')}>
              {todo.title}
            </span>
          </label>
        </li>
      ))}
    </ul>
  )
}

export function LogViewer({
  logs,
  isFrench,
}: {
  logs: WorkflowLog[]
  isFrench: boolean
}) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-700/60 bg-[#0b1020]" aria-label={isFrench ? 'Journaux d’exécution' : 'Execution logs'}>
      <header className="flex h-7 items-center gap-2 border-b border-white/[0.08] px-2.5 text-[9px] text-slate-400">
        <Terminal className="h-3 w-3 text-[#00c2c7]" aria-hidden="true" />
        {isFrench ? 'Sortie d’exécution' : 'Execution output'}
        <span className="ml-auto">{logs.length} {isFrench ? 'lignes' : 'lines'}</span>
      </header>
      <pre className="max-h-36 overflow-auto p-2 font-mono text-[9px] leading-relaxed">
        {logs.length ? logs.map((log) => (
          <span key={log.id} className={cn(
            'block whitespace-pre-wrap break-all',
            log.kind === 'stderr' ? 'text-rose-400' : 'text-slate-200',
          )}>{log.text}{'\n'}</span>
        )) : (
          <span className="text-slate-500">{isFrench ? 'Aucune sortie pour le moment.' : 'No output yet.'}</span>
        )}
      </pre>
    </section>
  )
}

export function WorkflowSidebar({
  steps,
  todos,
  logs,
  isFrench,
  onToggleTodo,
}: {
  steps: WorkflowStep[]
  todos: WorkflowTodo[]
  logs: WorkflowLog[]
  isFrench: boolean
  onToggleTodo: (id: string) => void
}) {
  const completed = steps.filter((step) => step.status === 'completed').length
  const activeStep = steps.find((step) => step.status === 'running')
  const activeIndex = activeStep ? steps.findIndex((step) => step.id === activeStep.id) : -1
  const currentStepNumber = activeIndex >= 0 ? activeIndex + 1 : completed
  const progress = steps.length ? Math.round((currentStepNumber / steps.length) * 100) : 0
  const todoStep = steps.find((step) => step.id === 'todo')
  const executeStep = steps.find((step) => step.id === 'execute')
  const commitStep = steps.find((step) => step.id === 'commit')
  const stepTitle = activeStep
    ? isFrench
      ? ({
        read: 'Lecture de votre espace de travail',
        analyze: 'Analyse de votre demande',
        todo: 'Préparation du plan',
        edit: 'Préparation des modifications',
        execute: 'Exécution de la commande approuvée',
        commit: 'Vérification du résultat',
      } as const)[activeStep.id]
      : ({
        read: 'Reading your workspace',
        analyze: 'Analyzing your request',
        todo: 'Preparing a plan',
        edit: 'Preparing code changes',
        execute: 'Running the approved command',
        commit: 'Checking the result',
      } as const)[activeStep.id]
    : isFrench
      ? 'Préparation de la réponse'
      : 'Preparing a response'

  return (
    <aside
      className="coding-workflow-sidebar shrink-0"
      aria-label={isFrench ? 'Progression de LynoAI' : 'LynoAI activity'}
    >
      <div className="coding-agent-activity" role="status" aria-live="polite">
        <div className="coding-agent-activity-heading">
          <span className="coding-agent-activity-icon" aria-hidden="true">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="coding-agent-activity-copy">
            <strong>{isFrench ? 'LynoAI travaille' : 'LynoAI is working'}</strong>
            <span>{stepTitle}</span>
            {activeStep?.details && (
              <span className="coding-agent-activity-context" title={activeStep.details}>
                {activeStep.details}
              </span>
            )}
          </span>
          <LoaderCircle className="coding-agent-activity-spinner h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        </div>
        <div
          className="coding-agent-activity-progress"
          role="progressbar"
          aria-label={isFrench ? 'Progression des étapes' : 'Workflow progress'}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={currentStepNumber}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <details className="coding-agent-activity-details">
          <summary>
            <span>
              {isFrench ? 'Afficher les étapes' : 'Show activity'}
              <span className="coding-agent-activity-count">
                {currentStepNumber}/{steps.length}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </summary>
          <div className="coding-agent-activity-body">
            <ol className="coding-agent-activity-steps">
              {steps.map((step) => {
                const definition = workflowDefinitions.find((item) => item.id === step.id)!
                const Icon = definition.icon
                const title = isFrench
                  ? ({
                    read: 'Lecture',
                    analyze: 'Analyse',
                    todo: 'Plan',
                    edit: 'Modifications',
                    execute: 'Exécution',
                    commit: 'Résultat',
                  } as const)[step.id]
                  : ({
                    read: 'Read',
                    analyze: 'Analyze',
                    todo: 'Plan',
                    edit: 'Changes',
                    execute: 'Run',
                    commit: 'Result',
                  } as const)[step.id]
                const StatusIcon = step.status === 'running'
                  ? LoaderCircle
                  : step.status === 'completed'
                    ? CheckCircle2
                    : step.status === 'failed'
                      ? XCircle
                      : Circle

                return (
                  <li key={step.id} className={`coding-agent-activity-step is-${step.status}`}>
                    <span className="coding-agent-activity-step-icon">
                      <StatusIcon className={step.status === 'running' ? 'animate-spin' : ''} aria-hidden="true" />
                    </span>
                    <span className="coding-agent-activity-step-copy">
                      <span>{title}</span>
                      {step.details && <small title={step.details}>{step.details}</small>}
                    </span>
                    <Icon className="coding-agent-activity-step-kind" aria-hidden="true" />
                  </li>
                )
              })}
            </ol>
            {todos.length > 0 && (
              <section className="coding-agent-plan" aria-label={isFrench ? 'Plan de travail' : 'Work plan'}>
                <header>
                  <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isFrench ? 'Plan' : 'Plan'}</span>
                  <span className="coding-agent-activity-count">
                    {todos.filter((todo) => todo.completed).length}/{todos.length}
                  </span>
                </header>
                <TodoList todos={todos} isFrench={isFrench} onToggle={onToggleTodo} />
                {todoStep?.status === 'running' && (
                  <p className="coding-agent-plan-hint">
                    {isFrench
                      ? 'Terminez les tâches pour autoriser l’exécution.'
                      : 'Complete the tasks to enable execution.'}
                  </p>
                )}
              </section>
            )}
            {(executeStep?.status !== 'idle' || logs.length > 0) && (
              <LogViewer logs={logs} isFrench={isFrench} />
            )}
            {commitStep?.details && commitStep.status !== 'idle' && (
              <p className="coding-agent-result">
                <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                {commitStep.details}
              </p>
            )}
          </div>
        </details>
      </div>
    </aside>
  )
}
