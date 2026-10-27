import { Check, X } from 'lucide-react'
import { evaluatePassword } from '~/lib/password-policy'
import type { PolicyContext } from '~/lib/password-policy'

const TONE = {
  Lemah: 'progress-error text-error',
  Sedang: 'progress-warning text-warning',
  Kuat: 'progress-success text-success',
  'Sangat kuat': 'progress-success text-success',
} as const

/** Indikator kekuatan + daftar syarat yang berubah saat mengetik. */
export function PasswordStrength({ value, forbidden }: { value: string } & PolicyContext) {
  if (!value) return null
  const { rules, score, level } = evaluatePassword(value, { forbidden })
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center gap-2">
        <progress className={`progress h-1.5 flex-1 ${TONE[level]}`} value={score} max={rules.length} />
        <span className={`text-xs font-medium ${TONE[level].split(' ')[1]}`}>{level}</span>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
        {rules.map((r) => (
          <li key={r.id} className={`flex items-center gap-1 ${r.ok ? 'text-success' : 'text-base-content/60'}`}>
            {r.ok ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  )
}