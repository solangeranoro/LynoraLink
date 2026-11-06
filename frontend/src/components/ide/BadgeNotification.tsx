'use client'

type BadgeNotificationProps = {
  count: number
  tone: 'error' | 'warning' | 'info'
  label: string
}

const toneClasses = {
  error: 'bg-emerald-600 text-white',
  warning: 'bg-emerald-600 text-white',
  info: 'bg-emerald-600 text-white',
}

export function BadgeNotification({ count, tone, label }: BadgeNotificationProps) {
  if (count <= 0) return null

  return (
    <span
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${toneClasses[tone]}`}
      aria-label={`${count} ${label}`}
      title={`${count} ${label}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
