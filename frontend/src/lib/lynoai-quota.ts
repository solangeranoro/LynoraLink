export type LynoAIQuota = {
  platform: 'lynoralink' | 'lynoracoding'
  used: number
  limit: number
  resetAt: string
  premium: boolean
}

export type LynoAIPlatform = LynoAIQuota['platform']

export function isLynoAIQuota(value: unknown): value is LynoAIQuota {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'platform' in value &&
    (value.platform === 'lynoralink' || value.platform === 'lynoracoding') &&
    'used' in value &&
    typeof value.used === 'number' &&
    'limit' in value &&
    typeof value.limit === 'number' &&
    'resetAt' in value &&
    typeof value.resetAt === 'string' &&
    'premium' in value &&
    typeof value.premium === 'boolean',
  )
}

export function publishLynoAIQuota(quota: LynoAIQuota) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<LynoAIQuota>('lynoai-quota-updated', { detail: quota }))
  }
}
