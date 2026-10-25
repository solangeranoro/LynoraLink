'use client'

import { FormEvent, useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { getCodingTeamId } from '@/lib/workspace-api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TeamMessage = {
  id: string
  content: string
  createdAt: string
  author: { id: string; name: string | null; image: string | null }
}

type CodingTeam = {
  id: string
  name: string
  role: 'LEADER' | 'CONTRIBUTOR' | 'OBSERVER'
}

type TeamCodingMember = {
  id: string
  name: string | null
  image: string | null
  role: 'LEADER' | 'CONTRIBUTOR' | 'OBSERVER'
}

export function TeamWorkspaceBar() {
  const [teams, setTeams] = useState<CodingTeam[]>([])
  const [teamId, setTeamId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [discussionOpen, setDiscussionOpen] = useState(false)
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [members, setMembers] = useState<TeamCodingMember[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setTeamId(getCodingTeamId())
    const loadTeams = async () => {
      try {
        const response = await fetch('/api/teams/coding', { cache: 'no-store' })
        const result = await response.json() as { teams?: CodingTeam[]; error?: string }
        if (!response.ok) throw new Error(result.error ?? 'Could not load team workspaces.')
        setTeams(result.teams ?? [])
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load team workspaces.')
      }
    }
    void loadTeams()
  }, [])

  const selectedTeam = teams.find((team) => team.id === teamId)

  useEffect(() => {
    if (!teamId || !discussionOpen) return
    let active = true
    const loadMessages = async () => {
      try {
        const [messagesResponse, membersResponse] = await Promise.all([
          fetch(`/api/teams/${encodeURIComponent(teamId)}/coding/messages`, { cache: 'no-store' }),
          fetch(`/api/teams/${encodeURIComponent(teamId)}/coding/members`, { cache: 'no-store' }),
        ])
        const [messageResult, memberResult] = await Promise.all([
          messagesResponse.json() as Promise<{ messages?: TeamMessage[]; error?: string }>,
          membersResponse.json() as Promise<{ members?: TeamCodingMember[]; error?: string }>,
        ])
        if (!messagesResponse.ok) throw new Error(messageResult.error ?? 'Could not load team discussion.')
        if (!membersResponse.ok) throw new Error(memberResult.error ?? 'Could not load team members.')
        if (active) {
          setMessages(messageResult.messages ?? [])
          setMembers(memberResult.members ?? [])
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load team discussion.')
      }
    }
    void loadMessages()
    const timer = window.setInterval(() => void loadMessages(), 5_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [discussionOpen, teamId])

  const updateRole = async (member: TeamCodingMember, role: 'CONTRIBUTOR' | 'OBSERVER') => {
    if (!teamId) return
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/coding/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, role }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Could not update member role.')
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, role } : item))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update member role.')
    }
  }

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!teamId || !draft.trim() || sending) return
    setSending(true)
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/coding/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      })
      const result = await response.json() as { message?: TeamMessage; error?: string }
      if (!response.ok || !result.message) throw new Error(result.error ?? 'Could not send discussion message.')
      setMessages((current) => [...current, result.message!].slice(-50))
      setDraft('')
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send discussion message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="coding-team-bar relative flex h-11 shrink-0 items-center gap-3 border-b px-4 text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</span>
      <Select
        value={teamId ?? 'personal'}
        onValueChange={(value) => {
          const next = new URL(window.location.href)
          if (value !== 'personal') next.searchParams.set('teamId', value)
          else next.searchParams.delete('teamId')
          window.location.assign(next.toString())
        }}
      >
        <SelectTrigger
          aria-label="Choose a LynoraCoding workspace"
          className="coding-team-select h-8 w-52 max-w-[45vw] rounded-md border-border/70 bg-card/60 px-2.5 text-xs font-medium shadow-sm transition-colors hover:border-emerald-500/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-emerald-500/20"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" className="min-w-52">
          <SelectItem value="personal" className="py-2">Personal workspace</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id} className="py-2">
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedTeam && (
        <span className="coding-team-role rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold capitalize text-emerald-600 dark:text-emerald-300">
          {selectedTeam.role.toLowerCase()}
        </span>
      )}
      {selectedTeam && <span className="hidden text-muted-foreground sm:inline">Live team workspace</span>}
      {selectedTeam && (
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-expanded={discussionOpen}
          onClick={() => setDiscussionOpen((open) => !open)}
        >
          <MessageCircle aria-hidden="true" className="size-3.5" />
          Discussion
        </button>
      )}
      {error && <span className="ml-auto truncate text-destructive" role="status">{error}</span>}
      {selectedTeam && discussionOpen && (
        <section
          className="coding-team-discussion absolute right-2 top-full z-50 flex h-80 w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-md border shadow-xl"
          style={{
            backgroundColor: 'var(--coding-card)',
            color: 'var(--coding-card-foreground)',
            borderColor: 'var(--coding-border)',
          }}
          aria-label="Team coding discussion"
        >
          <header className="border-b px-3 py-2 font-medium">{selectedTeam.name} · Discussion</header>
          {selectedTeam.role === 'LEADER' && (
            <div className="space-y-2 border-b px-3 py-2">
              <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">Workspace permissions</h3>
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{member.name || 'Team member'}</span>
                  {member.role === 'LEADER'
                    ? <span className="text-muted-foreground">Leader</span>
                    : (
                      <select
                        aria-label={`Coding role for ${member.name || 'team member'}`}
                        className="rounded border border-input bg-background px-1 py-0.5 text-[11px]"
                        value={member.role}
                        onChange={(event) => void updateRole(member, event.target.value as 'CONTRIBUTOR' | 'OBSERVER')}
                      >
                        <option value="CONTRIBUTOR">Contributor</option>
                        <option value="OBSERVER">Observer</option>
                      </select>
                    )}
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && <p className="text-muted-foreground">Start the team code discussion.</p>}
            {messages.map((message) => (
              <article key={message.id}>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate font-medium text-foreground">{message.author.name || 'Team member'}</span>
                  <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                <p className="whitespace-pre-wrap break-words pt-0.5">{message.content}</p>
              </article>
            ))}
          </div>
          <form className="flex gap-2 border-t p-2" onSubmit={sendMessage}>
            <input
              aria-label="Write a team discussion message"
              className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-xs"
              maxLength={2000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Discuss the code…"
            />
            <button
              type="submit"
              aria-label="Send discussion message"
              disabled={sending || !draft.trim()}
              className="rounded bg-emerald-600 p-2 text-white disabled:opacity-50"
            >
              <Send aria-hidden="true" className="size-3.5" />
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
