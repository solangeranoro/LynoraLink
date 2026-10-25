'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowLeft, ArrowRight, CalendarDays, CheckCheck, Clock3, Code2, Crown, FolderPlus, Gauge, MessageCircle,
  Moon, Send, ShieldCheck, Sparkles, Sun, TrendingUp, Zap,
} from 'lucide-react'
import { LynoAIQuotaCard } from '@/components/LynoAIQuotaCard'
import { useTranslation } from '@/lib/i18n'
import { readAppearancePreferences, saveAppearancePreferences } from '@/lib/appearance'
import { isLynoAIQuota, type LynoAIPlatform, type LynoAIQuota } from '@/lib/lynoai-quota'

type UsageAnalytics = {
  platform: LynoAIPlatform
  quota: LynoAIQuota
  quotas: Record<LynoAIPlatform, LynoAIQuota>
  actionUsage: { actionType: string; platform: LynoAIPlatform; count: number }[]
  recentActivity: { id: string; actionType: string; platform: LynoAIPlatform; countsTowardQuota: boolean; createdAt: string }[]
  daily: { date: string; lynoralink: number; lynoracoding: number }[]
  trackingSince: string | null
  generatedAt: string
}

function getChartScale(values: number[]) {
  const peak = Math.max(0, ...values)
  const step = Math.max(1, Math.ceil(peak / 4))
  return { step, max: step * 4 }
}

function isUsageAnalytics(value: unknown, platform: LynoAIPlatform): value is UsageAnalytics {
  if (!value || typeof value !== 'object') return false
  if (!('platform' in value) || value.platform !== platform) return false
  if (!('quota' in value) || !isLynoAIQuota(value.quota)) return false
  if (!('quotas' in value) || !value.quotas || typeof value.quotas !== 'object') return false
  if (!('lynoralink' in value.quotas) || !isLynoAIQuota(value.quotas.lynoralink)) return false
  if (!('lynoracoding' in value.quotas) || !isLynoAIQuota(value.quotas.lynoracoding)) return false
  if (!('actionUsage' in value) || !Array.isArray(value.actionUsage) || !value.actionUsage.every((item: unknown) =>
    Boolean(item && typeof item === 'object' &&
      'actionType' in item && typeof item.actionType === 'string' &&
      'platform' in item && (item.platform === 'lynoralink' || item.platform === 'lynoracoding') &&
      'count' in item && typeof item.count === 'number'),
  )) return false
  if (!('recentActivity' in value) || !Array.isArray(value.recentActivity) || !value.recentActivity.every((item: unknown) =>
    Boolean(item && typeof item === 'object' &&
      'id' in item && typeof item.id === 'string' &&
      'actionType' in item && typeof item.actionType === 'string' &&
      'platform' in item && (item.platform === 'lynoralink' || item.platform === 'lynoracoding') &&
      'countsTowardQuota' in item && typeof item.countsTowardQuota === 'boolean' &&
      'createdAt' in item && typeof item.createdAt === 'string'),
  )) return false
  if (!('daily' in value) || !Array.isArray(value.daily)) return false
  if (!value.daily.every((point: unknown) =>
    Boolean(
      point &&
      typeof point === 'object' &&
      'date' in point &&
      typeof point.date === 'string' &&
      'lynoralink' in point &&
      typeof point.lynoralink === 'number' &&
      'lynoracoding' in point &&
      typeof point.lynoracoding === 'number',
    ))) return false
  if (!('trackingSince' in value) || (value.trackingSince !== null && typeof value.trackingSince !== 'string')) return false
  if (!('generatedAt' in value) || typeof value.generatedAt !== 'string') return false

  return true
}

export function LynoAIUsagePage({ platform }: { platform: LynoAIPlatform }) {
  const { locale, setLocale } = useTranslation()
  const isFrench = locale === 'fr'
  const [isLightTheme, setIsLightTheme] = useState(true)
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null)
  const [analyticsError, setAnalyticsError] = useState(false)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'overview' | 'usage' | 'quota'>('overview')
  const isCoding = platform === 'lynoracoding'
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/ai/usage?platform=${platform}`, { cache: 'no-store' })
      const result: unknown = await response.json()
      if (!response.ok || !isUsageAnalytics(result, platform)) {
        throw new Error(
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : `HTTP_${response.status}`,
        )
      }
      setAnalytics(result)
      setAnalyticsError(false)
    } catch (error) {
      console.error('Unable to load LynoAI usage analytics:', error)
      setAnalyticsError(true)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [platform])

  useEffect(() => {
    const root = document.documentElement
    const syncTheme = () => setIsLightTheme(root.dataset.theme === 'light')
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    void loadAnalytics()
    const refresh = () => { void loadAnalytics() }
    window.addEventListener('focus', refresh)
    window.addEventListener('lynoai-quota-updated', refresh)
    const interval = window.setInterval(refresh, 30_000)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('lynoai-quota-updated', refresh)
      window.clearInterval(interval)
    }
  }, [loadAnalytics])

  function toggleTheme() {
    const current = readAppearancePreferences()
    saveAppearancePreferences({ ...current, theme: isLightTheme ? 'dark' : 'light' })
  }

  const muted = isLightTheme ? 'text-slate-600' : 'text-slate-400'
  const backHref = isCoding ? '/coding' : '/copilot'
  const trackedDays = useMemo(() => analytics?.daily ?? [], [analytics?.daily])
  const peakDay = useMemo(() => {
    return trackedDays.reduce((peak, item) => {
      const total = item.lynoralink + item.lynoracoding
      return total > peak.requests ? { date: item.date, requests: total } : peak
    }, { date: '', requests: 0 })
  }, [trackedDays])
  const totalMonthRequests = analytics
    ? analytics.quotas.lynoralink.used + analytics.quotas.lynoracoding.used
    : 0
  const remainingRequests = analytics?.quota.premium
    ? null
    : Math.max(0, (analytics?.quota.limit ?? 0) - (analytics?.quota.used ?? 0))
  const usagePercent = analytics?.quota.premium
    ? null
    : analytics?.quota.limit
      ? Math.min(100, Math.round((analytics.quota.used / analytics.quota.limit) * 100))
      : 0
  const lastUpdated = analytics
    ? new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(analytics.generatedAt))
    : null
  const actionTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const item of analytics?.actionUsage ?? []) {
      totals.set(item.actionType, (totals.get(item.actionType) ?? 0) + item.count)
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [analytics?.actionUsage])
  const actionLabels: Record<string, { fr: string; en: string; icon: typeof MessageCircle }> = {
    chat_message: { fr: 'Messages LynoAI', en: 'LynoAI messages', icon: MessageCircle },
    code_generation: { fr: 'Requêtes de génération de code', en: 'Code generation requests', icon: Code2 },
    inline_completion: { fr: 'Complétions de code', en: 'Inline completions', icon: Zap },
    code_changes_applied: { fr: 'Modifications appliquées', en: 'Code changes applied', icon: CheckCheck },
    project_created: { fr: 'Projets créés', en: 'Projects created', icon: FolderPlus },
    post_published: { fr: 'Publications créées', en: 'Posts published', icon: Send },
    legacy_usage: { fr: 'Anciennes requêtes non catégorisées', en: 'Earlier uncategorized requests', icon: Activity },
  }
  const actionLabel = (actionType: string) => actionLabels[actionType]?.[isFrench ? 'fr' : 'en']
    ?? (isFrench ? 'Autre activité LynoAI' : 'Other LynoAI activity')
  const actionIcon = (actionType: string) => actionLabels[actionType]?.icon ?? Activity
  const actionColors: Record<string, string> = {
    chat_message: 'rgb(var(--brand-accent))',
    code_generation: '#0ea5e9',
    inline_completion: '#14b8a6',
    code_changes_applied: '#10b981',
    project_created: '#f59e0b',
    post_published: '#ec4899',
    legacy_usage: '#a78bfa',
  }
  const activityTotal = actionTotals.reduce((total, [, count]) => total + count, 0)
  let activityOffset = 0
  const activitySegments = actionTotals.map(([actionType, count]) => {
    const percent = activityTotal ? (count / activityTotal) * 100 : 0
    const segment = {
      actionType,
      count,
      percent,
      offset: activityOffset,
      color: actionColors[actionType] ?? '#a78bfa',
    }
    activityOffset += percent
    return segment
  })
  const overviewDays = trackedDays.slice(-7)
  const overviewChartWidth = 600
  const overviewChartHeight = 190
  const overviewChartLeft = 36
  const overviewChartRight = 590
  const overviewChartTop = 16
  const overviewChartBottom = 146
  const overviewScale = getChartScale(overviewDays.flatMap((day) => [day.lynoralink, day.lynoracoding]))
  const overviewChartX = (index: number) => overviewDays.length <= 1
    ? (overviewChartLeft + overviewChartRight) / 2
    : overviewChartLeft + (index * (overviewChartRight - overviewChartLeft)) / (overviewDays.length - 1)
  const overviewChartY = (value: number) => overviewChartBottom - ((value / overviewScale.max) * (overviewChartBottom - overviewChartTop))
  const overviewLinkPoints = overviewDays.map((day, index) => ({ x: overviewChartX(index), y: overviewChartY(day.lynoralink), ...day }))
  const overviewCodingPoints = overviewDays.map((day, index) => ({ x: overviewChartX(index), y: overviewChartY(day.lynoracoding), ...day }))
  const buildSmoothLine = (points: { x: number; y: number }[]) => points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const midpoint = (previous.x + point.x) / 2
    return `${path} Q ${midpoint} ${previous.y}, ${point.x} ${point.y}`
  }, '')
  const buildSmoothArea = (points: { x: number; y: number }[]) => points.length
    ? `${buildSmoothLine(points)} L ${points[points.length - 1].x} ${overviewChartBottom} L ${points[0].x} ${overviewChartBottom} Z`
    : ''
  const countActions = (...types: string[]) => (analytics?.actionUsage ?? [])
    .filter((item) => types.includes(item.actionType))
    .reduce((total, item) => total + item.count, 0)
  const lastSevenDays = trackedDays.slice(-7)
  const lastSevenDaysTotal = lastSevenDays.reduce((total, day) => total + day.lynoralink + day.lynoracoding, 0)
  const recentActivity = analytics?.recentActivity.slice(0, 5) ?? []
  const chartWidth = 720
  const chartHeight = 220
  const chartLeft = 42
  const chartRight = 708
  const chartTop = 16
  const chartBottom = 172
  const usageScale = getChartScale(trackedDays.flatMap((point) => [point.lynoralink, point.lynoracoding]))
  const chartX = (index: number) => trackedDays.length <= 1
    ? (chartLeft + chartRight) / 2
    : chartLeft + (index * (chartRight - chartLeft)) / (trackedDays.length - 1)
  const chartY = (value: number) => chartBottom - ((value / usageScale.max) * (chartBottom - chartTop))
  const linkPoints = trackedDays.map((point, index) => ({ x: chartX(index), y: chartY(point.lynoralink), ...point }))
  const codingPoints = trackedDays.map((point, index) => ({ x: chartX(index), y: chartY(point.lynoracoding), ...point }))
  const buildLine = (points: typeof linkPoints) => points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const midpoint = (previous.x + point.x) / 2
    return `${path} Q ${midpoint} ${previous.y}, ${point.x} ${point.y}`
  }, '')
  const buildArea = (points: typeof linkPoints) => points.length
    ? `${buildLine(points)} L ${points.at(-1)!.x} ${chartBottom} L ${points[0].x} ${chartBottom} Z`
    : ''
  const dateTickIndexes = trackedDays.length > 1
    ? [...new Set([0, Math.floor((trackedDays.length - 1) / 3), Math.floor(((trackedDays.length - 1) * 2) / 3), trackedDays.length - 1])]
    : trackedDays.length ? [0] : []

  return (
    <main className="min-h-[100dvh] bg-midnight-deep text-ink">
      <header className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl ${isLightTheme ? 'border-slate-200 bg-white/95' : 'border-white/10 bg-[#0b1220]/95'}`}>
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
          <Link
            href={backHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-ink-muted transition hover:bg-midnight-card hover:text-ink"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {isFrench ? 'Retour à LynoAI' : 'Back to LynoAI'}
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex h-9 items-center rounded-lg border border-midnight-border bg-midnight-card/60 p-0.5" role="group" aria-label={isFrench ? 'Langue' : 'Language'}>
              {(['en', 'fr'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLocale(option)}
                  aria-pressed={locale === option}
                  className={`h-8 min-w-9 rounded-md px-2 text-[11px] font-semibold uppercase transition ${locale === option ? 'bg-gold/15 text-gold-soft shadow-sm' : 'text-ink-muted hover:text-ink'}`}
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isLightTheme ? (isFrench ? 'Activer le thème sombre' : 'Switch to dark theme') : (isFrench ? 'Activer le thème clair' : 'Switch to light theme')}
              className="grid h-9 w-9 place-items-center rounded-lg border border-midnight-border bg-midnight-card/60 text-ink-muted transition hover:bg-midnight-card hover:text-ink"
            >
              {isLightTheme ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1800px] pt-16 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className={`hidden border-r lg:block ${isLightTheme ? 'border-slate-200 bg-white/50' : 'border-white/[0.08] bg-[#0b1220]/40'}`}>
          <nav className="sticky top-16 flex flex-col gap-1 p-5" aria-label={isFrench ? 'Navigation LynoAI' : 'LynoAI navigation'}>
            {([
              { id: 'overview', label: isFrench ? 'Vue d’ensemble' : 'Overview', icon: Activity },
              { id: 'usage', label: isFrench ? 'Consommation' : 'Usage', icon: Gauge },
              { id: 'quota', label: isFrench ? 'Quota' : 'Quota', icon: Gauge },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={activeSection === id ? 'page' : undefined}
                onClick={() => {
                  setActiveSection(id)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  activeSection === id
                    ? 'bg-gold/10 text-gold-soft'
                    : 'text-ink-muted hover:bg-midnight-card/70 hover:text-ink'
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </button>
            ))}
            <div className={`mt-5 border-t pt-4 ${isLightTheme ? 'border-slate-200' : 'border-white/[0.08]'}`}>
              <p className={`px-3 text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}>
                {isFrench ? 'Espace LynoAI' : 'LynoAI workspace'}
              </p>
              <p className={`mt-2 px-3 text-xs leading-5 ${muted}`}>
                {isFrench ? 'Suivi centralisé de votre consommation sur LynoraLink et LynoraCoding.' : 'A unified view of your usage across LynoraLink and LynoraCoding.'}
              </p>
            </div>
          </nav>
        </aside>

        <div className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
          {activeSection === 'overview' && <section id="overview" className="space-y-6 pb-7 sm:space-y-7 sm:pb-9">
            <div className={`relative isolate overflow-hidden rounded-3xl border p-5 sm:p-8 ${isLightTheme ? 'border-gold/15 bg-gradient-to-br from-white via-emerald-50/70 to-teal-50/60' : 'border-white/[0.08] bg-gradient-to-br from-[#111a2a] via-[#111a2a] to-emerald-950/30'}`}>
              <div className="absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
              <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold-soft">
                    <Sparkles size={14} aria-hidden="true" />
                    {isFrench ? 'Vue d’ensemble LynoAI' : 'LynoAI overview'}
                  </div>
                  <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    {isFrench ? 'Votre activité IA, pilotée en un coup d’œil.' : 'Your AI activity, clearly in view.'}
                  </h1>
                  <p className={`mt-3 max-w-xl text-sm leading-6 sm:text-base ${muted}`}>
                    {isFrench
                      ? 'Suivez les messages, la génération de code et l’utilisation des deux plateformes. Les compteurs se mettent à jour automatiquement.'
                      : 'Monitor messages, code generation, and usage across both platforms. Activity and quota refresh automatically.'}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => setActiveSection('usage')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gold px-4 text-xs font-semibold text-white transition hover:bg-gold-bright">
                      {isFrench ? 'Explorer les analytics' : 'Explore analytics'}
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setActiveSection('quota')} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${isLightTheme ? 'border-slate-200 bg-white/80 text-slate-700 hover:bg-white' : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'}`}>
                      <Gauge size={14} aria-hidden="true" />
                      {isFrench ? 'Voir mon quota' : 'View my quota'}
                    </button>
                  </div>
                </div>

                <div className={`flex min-w-[230px] items-center gap-4 rounded-2xl border p-4 sm:p-5 ${isLightTheme ? 'border-white/80 bg-white/75 shadow-sm' : 'border-white/10 bg-black/10'}`}>
                  <div
                    className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-full p-[7px]"
                    style={{ background: analytics?.quota.premium ? 'conic-gradient(rgb(var(--brand-accent)) 100%, transparent 0)' : `conic-gradient(rgb(var(--brand-accent)) ${usagePercent ?? 0}%, ${isLightTheme ? '#e2e8f0' : '#334155'} 0)` }}
                    role="img"
                    aria-label={analytics?.quota.premium
                      ? (isFrench ? 'Quota LynoAI Premium illimité' : 'Unlimited LynoAI Premium quota')
                      : (isFrench ? `${usagePercent ?? 0}% du quota consommé` : `${usagePercent ?? 0}% of quota used`)}
                  >
                    <div className={`grid h-full w-full place-items-center rounded-full ${isLightTheme ? 'bg-white' : 'bg-[#111a2a]'}`}>
                      <span className="text-xl font-semibold tabular-nums">{analytics?.quota.premium ? '∞' : `${usagePercent ?? 0}%`}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${muted}`}>{isFrench ? 'Quota de la plateforme active' : 'Active platform quota'}</p>
                    <p className="mt-1 text-sm font-semibold">{isCoding ? 'LynoraCoding' : 'LynoraLink'}</p>
                    <p className={`mt-1 text-xs ${muted}`}>
                      {analyticsLoading && !analytics
                        ? (isFrench ? 'Chargement des données…' : 'Loading data…')
                        : analytics?.quota.premium
                          ? (isFrench ? 'Accès Premium sans limite' : 'Unlimited Premium access')
                          : analytics
                            ? `${analytics.quota.used} / ${analytics.quota.limit} ${isFrench ? 'requêtes utilisées' : 'requests used'}`
                            : (isFrench ? 'Données indisponibles' : 'Data unavailable')}
                    </p>
                    {analytics && !analytics.quota.premium && (
                      <p className={`mt-1 text-[10px] ${muted}`}>
                        {isFrench ? `${remainingRequests} restantes · renouvellement le ` : `${remainingRequests} remaining · resets `}
                        {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(analytics.quota.resetAt))}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {analyticsError && !analytics && (
                <p role="alert" className="mt-4 text-xs text-rose-500">
                  {isFrench ? 'Les données de synthèse sont temporairement indisponibles.' : 'Summary data is temporarily unavailable.'}
                  <button type="button" onClick={() => { setAnalyticsLoading(true); void loadAnalytics() }} className="ml-2 font-semibold underline underline-offset-2">
                    {isFrench ? 'Réessayer' : 'Retry'}
                  </button>
                </p>
              )}
            </div>

            {analyticsLoading && !analytics ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((item) => <div key={item} className={`h-28 animate-pulse rounded-2xl ${isLightTheme ? 'bg-slate-100' : 'bg-white/[0.05]'}`} />)}
              </div>
            ) : analytics ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: isFrench ? 'Requêtes ce mois' : 'Requests this month', value: totalMonthRequests, detail: isFrench ? 'Toutes les plateformes' : 'Across both platforms', icon: Gauge, color: 'text-gold-soft', bg: 'bg-gold/10' },
                    { label: isFrench ? 'Messages LynoAI' : 'LynoAI messages', value: countActions('chat_message'), detail: isFrench ? 'Conversations LynoraLink' : 'LynoraLink conversations', icon: MessageCircle, color: 'text-blue-500', bg: isLightTheme ? 'bg-blue-50' : 'bg-blue-400/10' },
                    { label: isFrench ? 'Actions de code' : 'Code actions', value: countActions('code_generation', 'inline_completion', 'code_changes_applied'), detail: isFrench ? 'Générations, complétions, applications' : 'Generations, completions, applied changes', icon: Code2, color: 'text-sky-500', bg: isLightTheme ? 'bg-sky-50' : 'bg-sky-400/10' },
                    { label: isFrench ? 'Activité sur 7 jours' : '7-day activity', value: lastSevenDaysTotal, detail: isFrench ? 'Requêtes enregistrées' : 'Recorded requests', icon: TrendingUp, color: 'text-emerald-500', bg: isLightTheme ? 'bg-emerald-50' : 'bg-emerald-400/10' },
                  ].map(({ label, value, detail, icon: Icon, color, bg }) => (
                    <article key={label} className={`rounded-2xl border p-4 sm:p-5 ${isLightTheme ? 'border-slate-200/80 bg-white shadow-sm' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-medium ${muted}`}>{label}</p>
                        <span className={`grid h-9 w-9 place-items-center rounded-xl ${color} ${bg}`}><Icon size={17} aria-hidden="true" /></span>
                      </div>
                      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
                      <p className={`mt-1 text-[10px] ${muted}`}>{detail}</p>
                    </article>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <section className={`rounded-2xl border p-4 sm:p-5 ${isLightTheme ? 'border-slate-200/80 bg-white shadow-sm' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">{isFrench ? 'Activité récente' : 'Recent activity'}</h2>
                        <p className={`mt-1 text-[11px] ${muted}`}>{isFrench ? 'Les dernières actions LynoAI enregistrées' : 'Latest recorded LynoAI actions'}</p>
                      </div>
                      <button type="button" onClick={() => setActiveSection('usage')} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-gold-soft">
                        {isFrench ? 'Tout voir' : 'View all'} <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    </div>
                    {recentActivity.length ? (
                      <ul className="mt-3 divide-y divide-midnight-border/70">
                        {recentActivity.map((item) => {
                          const Icon = actionIcon(item.actionType)
                          return (
                            <li key={item.id} className="flex items-center gap-3 py-3">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold-soft"><Icon size={15} aria-hidden="true" /></span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">{actionLabel(item.actionType)}</p>
                                <p className={`mt-0.5 text-[10px] ${muted}`}>
                                  {item.platform === 'lynoralink' ? 'LynoraLink' : 'LynoraCoding'} · {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}
                                </p>
                              </div>
                              <span className={`h-2 w-2 shrink-0 rounded-full ${item.countsTowardQuota ? 'bg-gold' : 'bg-emerald-500'}`} aria-label={item.countsTowardQuota ? (isFrench ? 'Consomme le quota' : 'Counts toward quota') : (isFrench ? 'Action enregistrée' : 'Action recorded')} />
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className={`mt-4 rounded-xl border border-dashed p-5 text-xs leading-5 ${isLightTheme ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                        {isFrench ? 'Aucune activité LynoAI enregistrée pour le moment. Vos messages et générations apparaîtront ici.' : 'No LynoAI activity recorded yet. Your messages and generations will appear here.'}
                      </p>
                    )}
                  </section>

                  <section className={`rounded-2xl border p-4 sm:p-5 ${isLightTheme ? 'border-slate-200/80 bg-white shadow-sm' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">{isFrench ? 'Répartition par activité' : 'Activity breakdown'}</h2>
                        <p className={`mt-1 text-[11px] ${muted}`}>{isFrench ? 'Types d’actions LynoAI enregistrées ce mois-ci' : 'Types of LynoAI actions recorded this month'}</p>
                      </div>
                      <button type="button" onClick={() => setActiveSection('usage')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-soft">
                        {isFrench ? 'Voir le détail' : 'View details'} <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    </div>
                    {activitySegments.length ? (
                      <div key={`overview-activity-${analytics.generatedAt}`} className="mt-5 grid items-center gap-5 sm:grid-cols-[170px_minmax(0,1fr)]">
                        <div className="relative mx-auto h-40 w-40">
                          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={isFrench ? `Répartition de ${activityTotal} actions par activité` : `Breakdown of ${activityTotal} actions by activity`}>
                            <circle cx="60" cy="60" r="43" fill="none" stroke={isLightTheme ? '#e2e8f0' : '#27364a'} strokeWidth="12" />
                            {activitySegments.map((segment) => (
                              <circle
                                key={segment.actionType}
                                cx="60"
                                cy="60"
                                r="43"
                                fill="none"
                                stroke={segment.color}
                                strokeWidth="12"
                                strokeLinecap="butt"
                                strokeDasharray={`${segment.percent} 100`}
                                strokeDashoffset={-segment.offset}
                                pathLength="100"
                              >
                                <animate
                                  attributeName="stroke-dasharray"
                                  from="0 100"
                                  to={`${segment.percent} 100`}
                                  dur="900ms"
                                  begin="0s"
                                  fill="freeze"
                                />
                              </circle>
                            ))}
                          </svg>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-semibold tabular-nums">{activityTotal}</span>
                            <span className={`mt-0.5 text-[9px] ${muted}`}>{isFrench ? 'actions' : 'actions'}</span>
                          </div>
                        </div>
                        <ul className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                          {activitySegments.map((segment) => {
                            const Icon = actionIcon(segment.actionType)
                            return (
                              <li key={segment.actionType} className="flex min-w-0 items-center gap-2.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                                <Icon size={14} className={`shrink-0 ${muted}`} aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{actionLabel(segment.actionType)}</span>
                                <span className={`shrink-0 text-[10px] tabular-nums ${muted}`}>{segment.count} · {Math.round(segment.percent)}%</span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : (
                      <p className={`mt-4 rounded-xl border border-dashed p-5 text-xs leading-5 ${isLightTheme ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                        {isFrench ? 'La répartition apparaîtra après vos premières actions LynoAI.' : 'The breakdown will appear after your first LynoAI actions.'}
                      </p>
                    )}
                  </section>

                  <section className={`rounded-2xl border p-4 sm:p-5 ${isLightTheme ? 'border-slate-200/80 bg-white shadow-sm' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">{isFrench ? 'Tendance d’utilisation' : 'Usage trend'}</h2>
                        <p className={`mt-1 text-[11px] ${muted}`}>{isFrench ? 'Volume quotidien par plateforme · 7 derniers jours' : 'Daily volume by platform · last 7 days'}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isLightTheme ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-slate-300'}`}>
                        {isFrench ? '7 jours' : '7 days'}
                      </span>
                    </div>
                    {overviewDays.length ? (
                      <div key={`overview-chart-${analytics?.generatedAt}`} className="mt-4">
                        <div className="flex items-center justify-between">
                          <p className={`text-[10px] ${muted}`}>{isFrench ? 'Requêtes / jour' : 'Requests / day'}</p>
                          <p className={`text-[10px] ${muted}`}>{isFrench ? 'Total 7 jours' : '7-day total'} <span className="ml-1 font-semibold tabular-nums text-ink">{lastSevenDaysTotal}</span></p>
                        </div>
                        <svg viewBox={`0 0 ${overviewChartWidth} ${overviewChartHeight}`} className="mt-2 h-40 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label={isFrench ? 'Courbe de consommation quotidienne sur 7 jours' : 'Daily usage trend over 7 days'}>
                          <defs>
                            <linearGradient id="overviewLinkFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgb(var(--brand-accent))" stopOpacity={isLightTheme ? 0.2 : 0.24} />
                              <stop offset="100%" stopColor="rgb(var(--brand-accent))" stopOpacity="0.01" />
                            </linearGradient>
                            <linearGradient id="overviewCodingFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={isLightTheme ? 0.16 : 0.2} />
                              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.01" />
                            </linearGradient>
                          </defs>
                          {Array.from({ length: 5 }, (_, index) => {
                            const value = overviewScale.max - (overviewScale.step * index)
                            const y = overviewChartTop + (((overviewChartBottom - overviewChartTop) / 4) * index)
                            return (
                              <g key={value}>
                                <line x1={overviewChartLeft} y1={y} x2={overviewChartRight} y2={y} stroke={isLightTheme ? '#e2e8f0' : '#334155'} strokeDasharray="3 5" />
                                <text x={overviewChartLeft - 8} y={y + 3} textAnchor="end" fill={isLightTheme ? '#64748b' : '#94a3b8'} fontSize="9">{value}</text>
                              </g>
                            )
                          })}
                          <path d={buildSmoothArea(overviewLinkPoints)} fill="url(#overviewLinkFill)" className="analytics-chart-area" />
                          <path d={buildSmoothArea(overviewCodingPoints)} fill="url(#overviewCodingFill)" className="analytics-chart-area" />
                          <path pathLength={1} d={buildSmoothLine(overviewLinkPoints)} fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="analytics-chart-line" />
                          <path pathLength={1} d={buildSmoothLine(overviewCodingPoints)} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="analytics-chart-line [animation-delay:220ms]" />
                          {overviewLinkPoints.map((point) => (
                            <circle key={`overview-link-${point.date}`} cx={point.x} cy={point.y} r="3.5" fill="rgb(var(--brand-accent))" stroke={isLightTheme ? '#fff' : '#111a2a'} strokeWidth="2">
                              <title>{`${point.date} · LynoraLink: ${point.lynoralink}`}</title>
                            </circle>
                          ))}
                          {overviewCodingPoints.map((point) => (
                            <circle key={`overview-coding-${point.date}`} cx={point.x} cy={point.y} r="3.5" fill="#0ea5e9" stroke={isLightTheme ? '#fff' : '#111a2a'} strokeWidth="2">
                              <title>{`${point.date} · LynoraCoding: ${point.lynoracoding}`}</title>
                            </circle>
                          ))}
                          {overviewDays.map((day, index) => (
                            <text key={day.date} x={overviewChartX(index)} y={overviewChartHeight - 10} textAnchor={index === 0 ? 'start' : index === overviewDays.length - 1 ? 'end' : 'middle'} fill={isLightTheme ? '#64748b' : '#94a3b8'} fontSize="9">
                              {new Intl.DateTimeFormat(dateLocale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00.000Z`))}
                            </text>
                          ))}
                        </svg>
                      </div>
                    ) : (
                      <div className={`mt-5 flex h-36 items-center justify-center rounded-xl border border-dashed text-xs ${isLightTheme ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                        {isFrench ? 'Les premières requêtes alimenteront cette tendance.' : 'Your first requests will populate this trend.'}
                      </div>
                    )}
                    <div className={`mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-[10px] ${isLightTheme ? 'border-slate-100 text-slate-500' : 'border-white/[0.07] text-slate-400'}`}>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" />LynoraLink</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />LynoraCoding</span>
                      <span className="ml-auto inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{lastUpdated ? `${isFrench ? 'Actualisé' : 'Updated'} ${lastUpdated}` : (isFrench ? 'En attente des données' : 'Waiting for data')}</span>
                    </div>
                  </section>
                </div>

                <section className={`rounded-2xl border p-4 sm:p-5 ${isLightTheme ? 'border-slate-200/80 bg-white shadow-sm' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">{isFrench ? 'Répartition par plateforme' : 'Platform breakdown'}</h2>
                      <p className={`mt-1 text-[11px] ${muted}`}>{isFrench ? 'Utilisation du quota depuis la dernière réinitialisation mensuelle' : 'Quota usage since the latest monthly reset'}</p>
                    </div>
                    <button type="button" onClick={() => setActiveSection('quota')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-soft">
                      {isFrench ? 'Détails du quota' : 'Quota details'} <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    {([
                      { id: 'lynoralink', name: 'LynoraLink', color: 'bg-gold', text: 'text-gold-soft' },
                      { id: 'lynoracoding', name: 'LynoraCoding', color: 'bg-sky-500', text: isLightTheme ? 'text-sky-700' : 'text-sky-200' },
                    ] as const).map(({ id, name, color, text }) => {
                      const quota = analytics.quotas[id]
                      const percent = quota.premium ? 100 : quota.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0
                      return (
                        <div key={id}>
                          <div className="flex items-center justify-between gap-3">
                            <span className={`inline-flex items-center gap-2 text-xs font-semibold ${text}`}><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{name}</span>
                            <span className="text-xs font-semibold tabular-nums">{quota.used}{quota.premium ? ' / ∞' : ` / ${quota.limit}`}</span>
                          </div>
                          <div className={`mt-2 h-2 overflow-hidden rounded-full ${isLightTheme ? 'bg-slate-100' : 'bg-white/[0.08]'}`}>
                            <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${percent}%` }} />
                          </div>
                          <p className={`mt-1.5 text-[10px] ${muted}`}>
                            {quota.premium
                              ? (isFrench ? 'Accès Premium illimité' : 'Unlimited Premium access')
                              : `${Math.max(0, quota.limit - quota.used)} ${isFrench ? 'requêtes restantes' : 'requests remaining'} · ${percent}%`}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </>
            ) : (
              <div className={`rounded-2xl border p-6 text-sm ${isLightTheme ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-rose-300/15 bg-rose-400/[0.06] text-rose-200'}`}>
                {isFrench ? 'Impossible de charger les indicateurs LynoAI.' : 'Unable to load LynoAI metrics.'}
                <button type="button" onClick={() => { setAnalyticsLoading(true); void loadAnalytics() }} className="ml-2 font-semibold underline underline-offset-2">
                  {isFrench ? 'Réessayer' : 'Retry'}
                </button>
              </div>
            )}
          </section>}

          <div className="space-y-8 py-7 sm:py-9">
            {activeSection === 'usage' && <section id="usage" aria-labelledby="lynoai-analytics-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">
                    <Activity size={14} aria-hidden="true" />
                    {isFrench ? 'Analyse d’utilisation' : 'Usage analytics'}
                  </div>
                  <h2 id="lynoai-analytics-title" className="mt-1 text-2xl font-semibold tracking-tight">
                    {isFrench ? 'Consommation LynoAI' : 'LynoAI consumption'}
                  </h2>
                  <p className={`mt-1 max-w-2xl text-sm leading-6 ${muted}`}>
                    {isFrench ? 'Comparez votre quota sur la plateforme active et le volume global des deux produits. Les indicateurs se synchronisent automatiquement.' : 'Compare quota on the active platform with combined activity across both products. Metrics refresh automatically.'}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${isLightTheme ? 'border-slate-200 bg-white/80 text-slate-600' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
                  <CalendarDays size={12} aria-hidden="true" />
                  {isFrench ? '30 derniers jours' : 'Last 30 days'}
                </span>
              </div>

              {analyticsLoading && !analytics ? (
                <div className={`mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4`}>
                  {[0, 1, 2, 3].map((item) => <div key={item} className={`h-24 animate-pulse rounded-2xl ${isLightTheme ? 'bg-slate-100' : 'bg-white/[0.05]'}`} />)}
                </div>
              ) : analyticsError && !analytics ? (
                <div role="alert" className={`mt-4 rounded-2xl border p-4 text-sm ${isLightTheme ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-rose-300/15 bg-rose-400/[0.06] text-rose-200'}`}>
                  {isFrench ? 'Les statistiques LynoAI sont momentanément indisponibles.' : 'LynoAI analytics are temporarily unavailable.'}
                  <button type="button" onClick={() => { setAnalyticsLoading(true); void loadAnalytics() }} className="ml-2 font-semibold underline underline-offset-2">
                    {isFrench ? 'Réessayer' : 'Retry'}
                  </button>
                </div>
              ) : analytics ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: isFrench ? 'Utilisées ce mois' : 'Used this month',
                        value: String(analytics.quota.used),
                        detail: isFrench ? (isCoding ? 'Dans LynoraCoding' : 'Dans LynoraLink') : (isCoding ? 'In LynoraCoding' : 'In LynoraLink'),
                        icon: Gauge,
                        accent: 'brand',
                      },
                      {
                        label: isFrench ? 'Disponibles' : 'Remaining',
                        value: remainingRequests === null ? '∞' : String(remainingRequests),
                        detail: analytics.quota.premium
                          ? (isFrench ? 'Accès Premium actif' : 'Premium access active')
                          : (isFrench ? `Sur ${analytics.quota.limit} requêtes` : `Of ${analytics.quota.limit} requests`),
                        icon: Zap,
                        accent: 'emerald',
                      },
                      {
                        label: isFrench ? 'Total des deux plateformes' : 'Across both platforms',
                        value: String(totalMonthRequests),
                        detail: isFrench ? 'Requêtes consommées ce mois' : 'Requests used this month',
                        icon: Sparkles,
                        accent: 'blue',
                      },
                      {
                        label: isFrench ? 'Jour le plus actif' : 'Most active day',
                        value: peakDay.requests ? String(peakDay.requests) : '—',
                        detail: peakDay.date
                          ? new Intl.DateTimeFormat(dateLocale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${peakDay.date}T00:00:00.000Z`))
                          : (isFrench ? 'Pas encore de données' : 'No activity recorded yet'),
                        icon: TrendingUp,
                        accent: 'amber',
                      },
                    ].map(({ label, value, detail, icon: Icon, accent }) => (
                      <article key={label} className={`rounded-2xl border p-4 ${isLightTheme ? 'border-slate-200/80 bg-white' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-[11px] font-medium ${muted}`}>{label}</p>
                          <span className={`grid h-7 w-7 place-items-center rounded-lg ${
                            accent === 'brand' ? 'bg-gold/10 text-gold-soft'
                              : accent === 'emerald' ? (isLightTheme ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-400/10 text-emerald-200')
                                : accent === 'blue' ? (isLightTheme ? 'bg-blue-50 text-blue-700' : 'bg-blue-400/10 text-blue-200')
                                  : (isLightTheme ? 'bg-amber-50 text-amber-700' : 'bg-amber-400/10 text-amber-200')
                          }`}>
                            <Icon size={14} aria-hidden="true" />
                          </span>
                        </div>
                        <p className="mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</p>
                        <p className={`mt-2 truncate text-[10px] ${muted}`}>{detail}</p>
                      </article>
                    ))}
                  </div>

                  <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" aria-label={isFrench ? 'Détail des actions LynoAI' : 'LynoAI action details'}>
                    <div className={`rounded-2xl border p-4 sm:p-5 ${isLightTheme ? 'border-slate-200/80 bg-white' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">{isFrench ? 'Actions du mois' : 'Actions this month'}</h3>
                          <p className={`mt-1 text-[11px] leading-5 ${muted}`}>
                            {isFrench ? 'Détail par type d’activité LynoAI, toutes plateformes confondues.' : 'LynoAI activity by type across both platforms.'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-semibold text-gold-soft">
                          {actionTotals.reduce((total, [, count]) => total + count, 0)}
                        </span>
                      </div>
                      {actionTotals.length ? (
                        <ul className="mt-4 space-y-3">
                          {actionTotals.map(([actionType, count]) => {
                            const Icon = actionIcon(actionType)
                            const maxCount = Math.max(1, ...actionTotals.map(([, value]) => value))
                            return (
                              <li key={actionType}>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="inline-flex min-w-0 items-center gap-2 text-xs font-medium">
                                    <Icon size={14} className="shrink-0 text-gold-soft" aria-hidden="true" />
                                    <span className="truncate">{actionLabel(actionType)}</span>
                                  </span>
                                  <span className="text-xs font-semibold tabular-nums">{count}</span>
                                </div>
                                <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${isLightTheme ? 'bg-slate-100' : 'bg-white/[0.08]'}`}>
                                  <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className={`mt-4 rounded-xl border border-dashed p-4 text-xs leading-5 ${isLightTheme ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                          {isFrench ? 'Aucune action enregistrée ce mois-ci.' : 'No actions recorded this month.'}
                        </p>
                      )}
                    </div>

                    <div className={`rounded-2xl border p-4 sm:p-5 ${isLightTheme ? 'border-slate-200/80 bg-white' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                      <div>
                        <h3 className="text-sm font-semibold">{isFrench ? 'Activité récente' : 'Recent activity'}</h3>
                        <p className={`mt-1 text-[11px] leading-5 ${muted}`}>
                          {isFrench ? 'Les 20 dernières actions, sans contenu de message ni code privé.' : 'The 20 latest actions, without message content or private code.'}
                        </p>
                      </div>
                      {analytics.recentActivity.length ? (
                        <ul className="mt-3 divide-y divide-midnight-border/70">
                          {analytics.recentActivity.map((item) => {
                            const Icon = actionIcon(item.actionType)
                            const createdAt = new Date(item.createdAt)
                            return (
                              <li key={item.id} className="flex items-center gap-3 py-3">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold-soft">
                                  <Icon size={15} aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium">{actionLabel(item.actionType)}</p>
                                  <p className={`mt-0.5 text-[10px] ${muted}`}>
                                    {item.platform === 'lynoralink' ? 'LynoraLink' : 'LynoraCoding'}
                                    {' · '}
                                    {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(createdAt)}
                                  </p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-medium ${
                                  item.countsTowardQuota
                                    ? (isLightTheme ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-slate-300')
                                    : (isLightTheme ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-400/10 text-emerald-200')
                                }`}>
                                  {item.countsTowardQuota
                                    ? (isFrench ? 'Quota' : 'Quota')
                                    : (isFrench ? 'Action' : 'Action')}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className={`mt-4 rounded-xl border border-dashed p-4 text-xs leading-5 ${isLightTheme ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                          {isFrench ? 'Les messages, générations de code et actions exécutées apparaîtront ici.' : 'Messages, code generations, and completed actions will appear here.'}
                        </p>
                      )}
                    </div>
                  </section>

                  <div className={`mt-3 rounded-2xl border p-4 ${isLightTheme ? 'border-slate-200/80 bg-white' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold">{isFrench ? 'Répartition par plateforme' : 'Usage by platform'}</h3>
                        <p className={`mt-1 text-[10px] ${muted}`}>{isFrench ? 'Consommation depuis le renouvellement mensuel' : 'Usage since the monthly reset'}</p>
                      </div>
                      <span className={`text-[10px] ${muted}`}>{isFrench ? 'Ce mois-ci' : 'This month'}</span>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {([
                        { id: 'lynoralink', name: 'LynoraLink', color: 'bg-gold', text: 'text-gold-soft' },
                        { id: 'lynoracoding', name: 'LynoraCoding', color: 'bg-sky-500', text: isLightTheme ? 'text-sky-700' : 'text-sky-200' },
                      ] as const).map(({ id, name, color, text }) => {
                        const count = analytics.quotas[id].used
                        const share = totalMonthRequests ? Math.round((count / totalMonthRequests) * 100) : 0
                        return (
                          <div key={id}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`inline-flex items-center gap-2 text-xs font-medium ${text}`}>
                                <span className={`h-2 w-2 rounded-full ${color}`} />
                                {name}
                              </span>
                              <span className="text-xs font-semibold tabular-nums">{count} <span className={`font-normal ${muted}`}>· {share}%</span></span>
                            </div>
                            <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${isLightTheme ? 'bg-slate-100' : 'bg-white/[0.08]'}`}>
                              <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${share}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <section className={`mt-4 rounded-2xl border p-4 sm:p-5 ${isLightTheme ? 'border-slate-200/80 bg-white' : 'border-white/[0.08] bg-white/[0.025]'}`} aria-labelledby="lynoai-chart-title">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 id="lynoai-chart-title" className="text-sm font-semibold">
                          {isFrench ? 'Requêtes quotidiennes' : 'Daily requests'}
                        </h3>
                        <p className={`mt-1 text-[11px] ${muted}`}>
                          {isFrench ? 'Activité enregistrée sur LynoraLink et LynoraCoding' : 'Recorded activity across LynoraLink and LynoraCoding'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] ${muted}`}>
                          <span className="h-2 w-2 rounded-full bg-gold" />LynoraLink
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-[10px] ${muted}`}>
                          <span className="h-2 w-2 rounded-full bg-sky-500" />LynoraCoding
                        </span>
                      </div>
                    </div>
                    {trackedDays.length ? (
                      <div key={`usage-chart-${analytics.generatedAt}`} className="mt-4 w-full" role="img" aria-label={isFrench ? 'Graphique des requêtes quotidiennes LynoAI sur 30 jours' : 'LynoAI daily requests chart for the last 30 days'}>
                        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full overflow-visible sm:h-64" preserveAspectRatio="none" aria-hidden="true">
                          <defs>
                            <linearGradient id="linkUsageFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgb(var(--brand-accent))" stopOpacity={0.22} />
                              <stop offset="100%" stopColor="rgb(var(--brand-accent))" stopOpacity={0.01} />
                            </linearGradient>
                            <linearGradient id="codingUsageFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.18} />
                              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.01} />
                            </linearGradient>
                          </defs>
                          {Array.from({ length: 5 }, (_, index) => {
                            const value = usageScale.max - (usageScale.step * index)
                            const y = chartTop + (((chartBottom - chartTop) / 4) * index)
                            return (
                              <g key={value}>
                                <line x1={chartLeft} y1={y} x2={chartRight} y2={y} stroke={isLightTheme ? '#e2e8f0' : '#334155'} strokeDasharray="3 5" />
                                <text x={chartLeft - 10} y={y + 3} textAnchor="end" fill={isLightTheme ? '#64748b' : '#94a3b8'} fontSize="10">{value}</text>
                              </g>
                            )
                          })}
                          <path d={buildArea(linkPoints)} fill="url(#linkUsageFill)" className="analytics-chart-area" />
                          <path d={buildArea(codingPoints)} fill="url(#codingUsageFill)" className="analytics-chart-area" />
                          <path pathLength={1} d={buildLine(linkPoints)} fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="analytics-chart-line" />
                          <path pathLength={1} d={buildLine(codingPoints)} fill="none" stroke="#0ea5e9" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="analytics-chart-line [animation-delay:320ms]" />
                          {linkPoints.map((point) => (
                            <circle key={`link-${point.date}`} cx={point.x} cy={point.y} r="3" fill="rgb(var(--brand-accent))" stroke={isLightTheme ? '#fff' : '#111a2a'} strokeWidth="1.5">
                              <title>{`${new Intl.DateTimeFormat(dateLocale, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${point.date}T00:00:00.000Z`))} · LynoraLink: ${point.lynoralink}`}</title>
                            </circle>
                          ))}
                          {codingPoints.map((point) => (
                            <circle key={`coding-${point.date}`} cx={point.x} cy={point.y} r="3" fill="#0ea5e9" stroke={isLightTheme ? '#fff' : '#111a2a'} strokeWidth="1.5">
                              <title>{`${new Intl.DateTimeFormat(dateLocale, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${point.date}T00:00:00.000Z`))} · LynoraCoding: ${point.lynoracoding}`}</title>
                            </circle>
                          ))}
                          {dateTickIndexes.map((index) => {
                            const point = trackedDays[index]
                            return (
                              <text key={point.date} x={chartX(index)} y={chartHeight - 9} textAnchor={index === 0 ? 'start' : index === trackedDays.length - 1 ? 'end' : 'middle'} fill={isLightTheme ? '#64748b' : '#94a3b8'} fontSize="10">
                                {new Intl.DateTimeFormat(dateLocale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${point.date}T00:00:00.000Z`))}
                              </text>
                            )
                          })}
                        </svg>
                      </div>
                    ) : (
                      <div className={`mt-4 flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center ${isLightTheme ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'}`}>
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold-soft"><Activity size={18} aria-hidden="true" /></span>
                        <p className="mt-3 text-xs font-semibold">{isFrench ? 'Le suivi détaillé commence maintenant' : 'Detailed tracking starts now'}</p>
                        <p className={`mt-1 max-w-sm text-[11px] leading-5 ${muted}`}>
                          {isFrench ? 'Les prochaines requêtes alimenteront votre courbe. Les compteurs de quota affichent déjà votre consommation mensuelle réelle.' : 'Your next requests will populate this chart. Quota counters already show your actual monthly usage.'}
                        </p>
                      </div>
                    )}
                    <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[10px] ${isLightTheme ? 'border-slate-100 text-slate-500' : 'border-white/[0.07] text-slate-400'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={12} aria-hidden="true" />
                        {analytics.trackingSince
                          ? (isFrench ? `Suivi détaillé depuis le ${new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(analytics.trackingSince))}` : `Detailed tracking since ${new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(analytics.trackingSince))}`)
                          : (isFrench ? 'Aucune requête détaillée enregistrée pour le moment' : 'No detailed requests recorded yet')}
                      </span>
                      <span>{isFrench ? 'Fuseau horaire : UTC' : 'Time zone: UTC'}</span>
                    </div>
                  </section>
                </>
              ) : null}
            </section>}

            {activeSection === 'quota' && <section id="quota" className="border-t border-midnight-border pt-7 sm:pt-9">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">
                    <Gauge size={14} aria-hidden="true" />
                    {isFrench ? 'Suivi du quota' : 'Quota usage'}
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                    {isFrench ? 'Votre quota LynoAI' : 'Your LynoAI quota'}
                  </h2>
                  <p className={`mt-1 max-w-2xl text-sm leading-6 ${muted}`}>
                    {isFrench ? 'Consultez votre utilisation et la date de réinitialisation mensuelle.' : 'Review your usage and monthly quota reset date.'}
                  </p>
                </div>
                {analytics && (
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${analytics.quota.premium
                    ? (isLightTheme ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-300/20 bg-amber-300/10 text-amber-100')
                    : (isLightTheme ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-white/[0.04] text-slate-300')
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${analytics.quota.premium ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {analytics.quota.premium
                      ? (isFrench ? 'Premium actif' : 'Premium active')
                      : (isFrench ? 'Quota gratuit' : 'Free quota')}
                  </span>
                )}
              </div>
              {analytics && (
                <div className={`mb-4 grid gap-3 sm:grid-cols-3`}>
                  <div className="border-l-2 border-gold bg-gold/5 px-4 py-3">
                    <p className={`text-[11px] font-medium ${muted}`}>{isFrench ? 'Quota mensuel utilisé' : 'Monthly quota used'}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {analytics.quota.used}{analytics.quota.premium ? '' : ` / ${analytics.quota.limit}`}
                    </p>
                  </div>
                  <div className={`border-l-2 ${usagePercent !== null && usagePercent >= 80 ? 'border-amber-400' : 'border-sky-500'} px-4 py-3 ${isLightTheme ? 'bg-slate-50' : 'bg-white/[0.025]'}`}>
                    <p className={`text-[11px] font-medium ${muted}`}>{isFrench ? 'Capacité restante' : 'Capacity remaining'}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {remainingRequests === null ? '∞' : remainingRequests}
                      <span className={`ml-2 text-xs font-normal ${muted}`}>{usagePercent === null ? (isFrench ? '· sans limite' : '· unlimited') : `· ${usagePercent}% ${isFrench ? 'utilisé' : 'used'}`}</span>
                    </p>
                  </div>
                  <div className={`border-l-2 border-emerald-500 px-4 py-3 ${isLightTheme ? 'bg-slate-50' : 'bg-white/[0.025]'}`}>
                    <p className={`text-[11px] font-medium ${muted}`}>{isFrench ? 'Prochaine réinitialisation' : 'Next reset'}</p>
                    <p className="mt-1 text-lg font-semibold">
                      {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(analytics.quota.resetAt))}
                    </p>
                  </div>
                </div>
              )}
              <LynoAIQuotaCard
                platform={platform}
                locale={locale}
                appearance={isLightTheme ? 'light' : 'dark'}
              />
            </section>}
          </div>
        </div>
      </div>
    </main>
  )
}
