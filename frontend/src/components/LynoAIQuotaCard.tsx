'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CircleAlert, Crown, Sparkles, Zap } from 'lucide-react'
import Link from 'next/link'
import { isLynoAIQuota, type LynoAIQuota } from '@/lib/lynoai-quota'
import { openPaddleCheckout } from '@/lib/paddle-checkout'

export function LynoAIQuotaCard({
  platform,
  locale,
  appearance = 'light',
}: {
  platform: LynoAIQuota['platform']
  locale: 'fr' | 'en'
  appearance?: 'light' | 'dark'
}) {
  const [quota, setQuota] = useState<LynoAIQuota | null>(null)
  const [error, setError] = useState('')
  const [checkoutPending, setCheckoutPending] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const isFrench = locale === 'fr'
  const dark = appearance === 'dark'

  const loadQuota = useCallback(async () => {
    try {
      const response = await fetch(`/api/ai/quota?platform=${platform}`)
      const result = await response.json() as { quota?: unknown; error?: string }
      if (response.status === 401) return
      if (!response.ok || !isLynoAIQuota(result.quota)) throw new Error(result.error ?? `HTTP_${response.status}`)
      setQuota(result.quota)
      setError('')
    } catch (cause) {
      console.error('Unable to load LynoAI quota:', cause)
      setError(isFrench ? 'Le quota LynoAI est momentanément indisponible.' : 'LynoAI quota is temporarily unavailable.')
    }
  }, [isFrench, platform])

  useEffect(() => {
    void loadQuota()
    const update = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail
      if (isLynoAIQuota(detail) && detail.platform === platform) setQuota(detail)
    }
    window.addEventListener('lynoai-quota-updated', update)
    window.addEventListener('focus', loadQuota)
    return () => {
      window.removeEventListener('lynoai-quota-updated', update)
      window.removeEventListener('focus', loadQuota)
    }
  }, [loadQuota, platform])

  if (!quota && !error) return null

  const exhausted = Boolean(quota && !quota.premium && quota.used >= quota.limit)
  const usage = quota ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0
  const remaining = quota ? Math.max(0, quota.limit - quota.used) : 0
  const approachingLimit = !exhausted && !quota?.premium && usage >= 80
  const resetDate = quota
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(quota.resetAt))
    : ''
  const shell = dark
    ? 'border-white/[0.09] bg-[#111a2a]/90 text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.16)]'
    : 'border-slate-200/90 bg-white text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.045)]'
  const muted = dark ? 'text-slate-400' : 'text-slate-500'
  const barTrack = dark ? 'bg-white/[0.08]' : 'bg-slate-100'
  const barColor = exhausted
    ? 'bg-rose-500'
    : approachingLimit
      ? 'bg-amber-400'
      : 'bg-gold'

  async function subscribeToPremium() {
    setCheckoutPending(true)
    setError('')
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'copilot_subscription', period: billingPeriod }),
      })
      const result = await response.json() as {
        transactionId?: string
        customerEmail?: string
        successUrl?: string
        error?: string
      }
      if (!response.ok) throw new Error(result.error ?? `HTTP_${response.status}`)
      if (!result.transactionId || !result.customerEmail || !result.successUrl) {
        throw new Error('INVALID_PADDLE_CHECKOUT')
      }
      await openPaddleCheckout(result.transactionId, result.customerEmail, result.successUrl)
    } catch (cause) {
      console.error('Unable to start Paddle Copilot subscription:', cause)
      setError(isFrench
        ? 'Impossible de démarrer l’abonnement Paddle. Vérifiez la configuration puis réessayez.'
        : 'Could not start the Paddle subscription. Check the configuration and try again.')
      setCheckoutPending(false)
    }
  }

  async function openSubscriptionPortal() {
    setCheckoutPending(true)
    setError('')
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error ?? `HTTP_${response.status}`)
      window.location.assign(result.url)
    } catch (cause) {
      console.error('Unable to open Paddle subscription portal:', cause)
      setError(isFrench
        ? 'Impossible d’ouvrir la gestion de votre abonnement Paddle.'
        : 'Could not open Paddle subscription management.')
      setCheckoutPending(false)
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${shell} ${exhausted ? (dark ? 'border-rose-400/25' : 'border-rose-200') : ''}`}
      aria-live="polite"
    >
      {quota ? (
        <div className="p-3.5 sm:p-4">
          <div className="flex items-start gap-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              quota.premium
                ? (dark ? 'bg-amber-300/10 text-amber-200' : 'bg-amber-50 text-amber-600')
                : exhausted
                  ? (dark ? 'bg-rose-400/10 text-rose-300' : 'bg-rose-50 text-rose-600')
                  : approachingLimit
                    ? (dark ? 'bg-amber-300/10 text-amber-200' : 'bg-amber-50 text-amber-600')
                    : (dark ? 'bg-gold/10 text-gold-soft' : 'bg-gold/10 text-gold')
            }`}>
              {quota.premium ? <Crown size={17} /> : exhausted ? <CircleAlert size={17} /> : <Zap size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="text-[13px] font-semibold tracking-[-0.01em]">
                    {quota.premium
                      ? (isFrench ? 'LynoAI Premium' : 'LynoAI Premium')
                      : (isFrench ? 'Votre quota LynoAI' : 'Your LynoAI usage')}
                  </h2>
                  {quota.premium && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${dark ? 'bg-amber-300/10 text-amber-200' : 'bg-amber-50 text-amber-700'}`}>
                      <Sparkles size={10} aria-hidden="true" />
                      Premium
                    </span>
                  )}
                  {exhausted && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${dark ? 'bg-rose-400/10 text-rose-200' : 'bg-rose-50 text-rose-700'}`}>
                      {isFrench ? 'Limite atteinte' : 'Limit reached'}
                    </span>
                  )}
                </div>
                {!quota.premium && (
                  <span className={`inline-flex items-center gap-1 text-[11px] ${muted}`}>
                    <CalendarClock size={12} aria-hidden="true" />
                    {isFrench ? `Renouvellement le ${resetDate}` : `Renews ${resetDate}`}
                  </span>
                )}
              </div>
              {quota.premium ? (
                <div className="mt-1.5">
                  <p className={`text-xs ${muted}`}>
                    {isFrench ? 'Requêtes illimitées sur LynoraLink et LynoraCoding.' : 'Unlimited requests on LynoraLink and LynoraCoding.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void openSubscriptionPortal()}
                    disabled={checkoutPending}
                    className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-current/20 px-3 py-2 text-xs font-semibold transition hover:bg-gold/10 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isFrench ? 'Gérer / annuler mon abonnement' : 'Manage or cancel subscription'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-2 flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-semibold tabular-nums">
                      {isFrench ? `${remaining} requêtes restantes` : `${remaining} requests remaining`}
                    </p>
                    <p className={`text-[11px] tabular-nums ${muted}`}>
                      {quota.used} / {quota.limit}
                    </p>
                  </div>
                  <div
                    className={`mt-2 h-1.5 overflow-hidden rounded-full ${barTrack}`}
                    role="progressbar"
                    aria-label={isFrench ? 'Utilisation mensuelle de LynoAI' : 'Monthly LynoAI usage'}
                    aria-valuemin={0}
                    aria-valuemax={quota.limit}
                    aria-valuenow={Math.min(quota.used, quota.limit)}
                  >
                    <div className={`h-full rounded-full transition-[width] duration-500 ${barColor}`} style={{ width: `${usage}%` }} />
                  </div>
                  {approachingLimit && (
                    <p className={`mt-2 text-[11px] ${dark ? 'text-amber-200/90' : 'text-amber-700'}`}>
                      {isFrench ? 'Vous approchez de votre limite mensuelle.' : 'You’re approaching your monthly limit.'}
                    </p>
                  )}
                  <fieldset className="mt-3">
                    <legend className={`mb-1.5 text-[11px] font-medium ${muted}`}>
                      {isFrench ? 'Choisissez votre facturation' : 'Choose your billing period'}
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(['monthly', 'yearly'] as const).map((period) => {
                        const selected = billingPeriod === period
                        return (
                          <button
                            key={period}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setBillingPeriod(period)}
                            className={`rounded-lg border px-2.5 py-2 text-left transition ${
                              selected
                                ? 'border-gold/60 bg-gold/10'
                                : 'border-current/15 hover:border-gold/40'
                            }`}
                          >
                            <span className="block text-xs font-semibold">
                              {period === 'monthly'
                                ? (isFrench ? '10 $ / mois' : '$10 / month')
                                : (isFrench ? '120 $ / an' : '$120 / year')}
                            </span>
                            <span className={`mt-0.5 block text-[10px] ${muted}`}>
                              {period === 'monthly'
                                ? (isFrench ? 'Facturation mensuelle' : 'Billed monthly')
                                : (isFrench ? 'Facturation annuelle' : 'Billed yearly')}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                  <button
                    type="button"
                    onClick={() => void subscribeToPremium()}
                    disabled={checkoutPending}
                    className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-midnight-deep transition hover:bg-gold-soft disabled:cursor-wait disabled:opacity-60"
                  >
                    {checkoutPending
                      ? (isFrench ? 'Ouverture de Paddle…' : 'Opening Paddle…')
                      : (isFrench ? 'S’abonner à LynoAI Premium' : 'Subscribe to LynoAI Premium')}
                  </button>
                </>
              )}
            </div>
          </div>
          {quota && (
            <Link
              href={`/copilot/usage?platform=${platform}`}
              className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-gold-soft transition-colors hover:bg-gold/10"
            >
              {isFrench ? 'Voir le suivi d’utilisation' : 'View usage analytics'}
            </Link>
          )}
        </div>
      ) : null}
      {error && (
        <p role="alert" className={`flex items-center gap-2 px-3.5 py-2.5 text-xs ${quota ? 'border-t border-rose-400/15' : ''} ${dark ? 'bg-rose-400/[0.06] text-rose-200' : 'bg-rose-50 text-rose-700'}`}>
          <CircleAlert size={14} className="shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  )
}
