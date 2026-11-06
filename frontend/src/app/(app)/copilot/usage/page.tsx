import { LynoAIUsagePage } from '@/components/LynoAIUsagePage'
import type { LynoAIPlatform } from '@/lib/lynoai-quota'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>
}) {
  const { platform } = await searchParams
  const selectedPlatform: LynoAIPlatform = platform === 'lynoracoding'
    ? 'lynoracoding'
    : 'lynoralink'

  return <LynoAIUsagePage platform={selectedPlatform} />
}
