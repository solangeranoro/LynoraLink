'use client'

import { useState } from 'react'
import { GitBranch, GitCommitHorizontal, GitMerge, GitPullRequestArrow, RefreshCw, Sparkles, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  connectGit,
  createGitBranch,
  getGitSessionToken,
  listGitCommits,
  listGitBranches,
  mergeGitBranch,
  pullGitWorkspace,
  pushGitWorkspace,
  setGitSessionToken,
  type GitBranch as Branch,
  type GitCommit,
  type GitProvider,
} from '@/lib/ide/git-client'
import { ideEventBus } from '@/lib/ide/event-bus'
import { flattenProjectFiles } from '@/lib/workspace-files'
import { loadWorkspaceFiles, replaceWorkspaceFiles } from '@/lib/workspace-api'
import { useIdeStore } from '@/store/ide-store'

export function SourceControlPanel() {
  const [provider, setProvider] = useState<GitProvider>('github')
  const [token, setToken] = useState(getGitSessionToken)
  const [repository, setRepository] = useState('')
  const [branch, setBranch] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [newBranch, setNewBranch] = useState('')
  const [mergeSource, setMergeSource] = useState('')
  const [commitMessage, setCommitMessage] = useState('')
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Not connected')

  const setStatusMessage = (message: string) => {
    setStatus(message)
    ideEventBus.emit('git:status', { provider, repository, branch, message })
  }

  const disconnect = () => {
    setToken('')
    setGitSessionToken('')
    setRepository('')
    setBranch('')
    setBranches([])
    setCommits([])
    useIdeStore.getState().setGitRemoteFiles(null)
    setConnected(false)
    useIdeStore.getState().setGitRemoteFiles(null)
    setStatusMessage('Disconnected; access token cleared from memory.')
  }

  const refresh = async (nextBranch = branch) => {
    if (!token || !repository || !nextBranch) return
    const [nextBranches, nextCommits] = await Promise.all([
      listGitBranches(provider, token, repository),
      listGitCommits(provider, token, repository, nextBranch),
    ])
    if (!nextBranches.some((item) => item.name === nextBranch)) {
      throw new Error(`Branch "${nextBranch}" is not available in this repository.`)
    }
    const remoteFiles = await pullGitWorkspace(provider, token, repository, nextBranch)
    setBranches(nextBranches)
    setCommits(nextCommits)
    useIdeStore.getState().setGitRemoteFiles(remoteFiles)
    setStatusMessage(`Connected to ${provider === 'github' ? 'GitHub' : 'GitLab'} · ${repository} · ${nextBranch}`)
  }

  const connect = async () => {
    setBusy(true)
    try {
      const result = await connectGit(provider, token, repository)
      setBranches(result.branches)
      setBranch(result.defaultBranch)
      setConnected(true)
      await refresh(result.defaultBranch)
      toast.success('Remote repository connected.')
    } catch (error) {
      setConnected(false)
      toast.error(error instanceof Error ? error.message : 'Unable to connect to the repository.')
      setStatusMessage('Connection failed.')
    } finally {
      setBusy(false)
    }
  }

  const refreshHistory = async () => {
    setBusy(true)
    try {
      await refresh()
      toast.success('Repository status refreshed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to refresh repository status.')
    } finally {
      setBusy(false)
    }
  }

  const createBranch = async () => {
    setBusy(true)
    try {
      await createGitBranch(provider, token, repository, newBranch, branch)
      setBranch(newBranch.trim())
      setNewBranch('')
      await refresh(newBranch.trim())
      toast.success('Branch created.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create branch.')
    } finally {
      setBusy(false)
    }
  }

  const push = async () => {
    if (!window.confirm(
      'Push the complete workspace to this branch? Files missing from your workspace may be deleted from the remote repository.',
    )) return
    setBusy(true)
    try {
      const store = useIdeStore.getState()
      await store.saveAll()
      const current = useIdeStore.getState()
      if (current.tabs.some((tab) => tab.isDirty)) {
        throw new Error('Some editor files could not be saved. Resolve those errors before pushing.')
      }
      const workspace = flattenProjectFiles(current.files)
      const files = workspace
        .filter((file) => !file.isDirectory)
        .map((file) => ({ path: file.path, content: file.content ?? '' }))
      const sha = await pushGitWorkspace(
        provider, token, repository, branch, commitMessage, files, true,
      )
      setCommitMessage('')
      await refresh()
      setStatusMessage(`Pushed commit ${sha.slice(0, 12)} to ${branch}.`)
      toast.success('Workspace pushed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to push workspace.')
    } finally {
      setBusy(false)
    }
  }

  const pull = async () => {
    if (!window.confirm(
      'Replace every file in this workspace with the selected remote branch? This discards unsaved editor changes and local-only files.',
    )) return
    setBusy(true)
    try {
      const remoteFiles = await pullGitWorkspace(provider, token, repository, branch)
      const directories = new Set<string>()
      for (const file of remoteFiles) {
        const parts = file.path.split('/')
        for (let index = 1; index < parts.length; index += 1) {
          directories.add(parts.slice(0, index).join('/'))
        }
      }
      const records = [
        ...[...directories].map((path) => ({ path, isDirectory: true, content: '' })),
        ...remoteFiles.map((file) => ({ ...file, isDirectory: false })),
      ].sort((left, right) =>
        left.path.split('/').length - right.path.split('/').length || left.path.localeCompare(right.path))
      await replaceWorkspaceFiles(records)
      useIdeStore.setState({
        tabs: [],
        activeTabId: null,
        selectedFileId: null,
        problemsByPath: {},
      })
      useIdeStore.getState().setGitRemoteFiles(remoteFiles)
      await useIdeStore.getState().loadWorkspace()
      await refresh()
      setStatusMessage(`Pulled ${remoteFiles.length} text files from ${branch}.`)
      toast.success(`Pulled ${remoteFiles.length} files.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to pull remote workspace.')
    } finally {
      setBusy(false)
    }
  }

  const merge = async () => {
    if (!window.confirm(`Merge ${mergeSource} into ${branch} on ${provider}?`)) return
    setBusy(true)
    try {
      const sha = await mergeGitBranch(provider, token, repository, mergeSource, branch)
      setMergeSource('')
      await refresh()
      setStatusMessage(`Merged ${mergeSource} into ${branch} · ${sha.slice(0, 12)}`)
      toast.success('Remote branches merged.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Merge failed. Resolve any conflicts on the remote provider.')
      setStatusMessage('Merge failed; inspect the provider response and resolve conflicts remotely.')
    } finally {
      setBusy(false)
    }
  }

  const changeBranch = async (nextBranch: string) => {
    setBranch(nextBranch)
    useIdeStore.getState().setGitRemoteFiles(null)
    setBusy(true)
    try {
      await refresh(nextBranch)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load branch.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source Control</span>
        {connected && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[10px]"
              onClick={() => useIdeStore.getState().queueLynoAICommand(
                `Review this source-control context and advise on the current branch and recent history. Do not perform repository actions.\nProvider: ${provider}\nRepository: ${repository}\nBranch: ${branch}\nStatus: ${status}\nRecent commits:\n${commits.slice(0, 8).map((commit) => `${commit.sha.slice(0, 8)} ${commit.message}`).join('\n')}`,
              )}
            >
              <Sparkles className="mr-1 h-3 w-3" /> Ask LynoAI
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!connected ? (
          <div className="space-y-2">
            <label className="block space-y-1 text-[11px]">
              <span>Provider</span>
              <Select value={provider} onValueChange={(value) => {
                if (value === 'github' || value === 'gitlab') {
                  setProvider(value)
                  setToken('')
                  setGitSessionToken('')
                  setConnected(false)
                  setBranches([])
                  setCommits([])
                  useIdeStore.getState().setGitRemoteFiles(null)
                }
              }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="gitlab">GitLab.com</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <Input aria-label="Git repository" value={repository} onChange={(event) => setRepository(event.target.value)}
              placeholder={provider === 'github' ? 'owner/repository' : 'group/project'} className="h-8 text-xs" />
            <Input aria-label="Personal access token" type="password" autoComplete="off" value={token}
              onChange={(event) => {
                setToken(event.target.value)
                setGitSessionToken(event.target.value)
              }} placeholder="Personal access token" className="h-8 text-xs" />
            <p className="text-[10px] text-muted-foreground">
              Token is kept only in this panel’s memory and sent directly to the selected provider. It is never saved.
            </p>
            <p className="text-[10px] text-muted-foreground">
              Grant repository read/write access only. GitLab.com is supported, not self-hosted GitLab.
            </p>
            <Button size="sm" className="h-8 w-full text-xs" disabled={busy || !repository.trim() || !token.trim()}
              onClick={() => void connect()}>
              <GitBranch className="mr-1 h-3.5 w-3.5" />{busy ? 'Connecting…' : 'Connect repository'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{repository}</p>
                <p className="text-[10px] text-muted-foreground">{provider === 'github' ? 'GitHub' : 'GitLab'}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={busy}
                title="Refresh branches and history" onClick={() => void refreshHistory()}>
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <label className="block space-y-1 text-[11px]">
              <span>Branch</span>
              <Select value={branch} onValueChange={(value) => void changeBranch(value)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {branches.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <div className="space-y-1 border-t pt-2">
              <div className="flex items-center gap-1 text-[11px] font-medium"><GitBranch className="h-3.5 w-3.5" />Create branch</div>
              <Input aria-label="New branch name" value={newBranch} onChange={(event) => setNewBranch(event.target.value)}
                placeholder="feature/name" className="h-8 text-xs" />
              <Button size="sm" variant="outline" className="h-7 w-full text-[10px]" disabled={busy || !newBranch.trim()}
                onClick={() => void createBranch()}>Create from {branch}</Button>
            </div>

            <div className="space-y-1 border-t pt-2">
              <div className="flex items-center gap-1 text-[11px] font-medium"><GitCommitHorizontal className="h-3.5 w-3.5" />Commit & push workspace</div>
              <Input aria-label="Commit message" value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)}
                placeholder="Commit message" className="h-8 text-xs" />
              <div className="grid grid-cols-2 gap-1">
                <Button size="sm" className="h-7 text-[10px]" disabled={busy || !commitMessage.trim()} onClick={() => void push()}>
                  <Upload className="mr-1 h-3 w-3" />Push
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={busy} onClick={() => void pull()}>
                  <GitPullRequestArrow className="mr-1 h-3 w-3" />Pull
                </Button>
              </div>
              <p className="text-[9px] leading-4 text-muted-foreground">
                Push synchronizes the whole text workspace; pull replaces it. Both require confirmation.
              </p>
            </div>

            <div className="space-y-1 border-t pt-2">
              <div className="flex items-center gap-1 text-[11px] font-medium"><GitMerge className="h-3.5 w-3.5" />Merge into {branch}</div>
              <Select value={mergeSource} onValueChange={setMergeSource}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Source branch" /></SelectTrigger>
                <SelectContent>
                  {branches.filter((item) => item.name !== branch).map((item) =>
                    <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-7 w-full text-[10px]"
                disabled={busy || !mergeSource} onClick={() => void merge()}>Merge branches remotely</Button>
            </div>

            <section className="space-y-1 border-t pt-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent commits</h2>
              {commits.map((commit) => (
                <article key={commit.sha} className="border-b py-1.5">
                  <p className="line-clamp-2 text-[10px]">{commit.message}</p>
                  <p className="truncate font-mono text-[9px] text-muted-foreground">
                    {commit.sha.slice(0, 8)} · {commit.author} · {commit.date ? new Date(commit.date).toLocaleString() : ''}
                  </p>
                </article>
              ))}
              {commits.length === 0 && <p className="text-[10px] text-muted-foreground">No commit history available.</p>}
            </section>
          </>
        )}
      </div>
      <div className="border-t px-3 py-2 text-[10px] text-muted-foreground" role="status">{status}</div>
    </div>
  )
}
