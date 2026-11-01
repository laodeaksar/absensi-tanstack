import { CircleCheck, CircleX, Info } from 'lucide-react'
import { useToasts } from '~/lib/toast'

const ICONS = { success: CircleCheck, error: CircleX, info: Info }

export function Toaster() {
  const items = useToasts()
  return (
    <div className="toast toast-end z-[9999] no-print">
      {items.map((t) => {
        const Icon = ICONS[t.type]
        return (
          <div key={t.id} role="alert" className={`alert alert-${t.type} max-w-sm shadow-lg`}>
            <Icon className="size-5 shrink-0" />
            <span>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}