import type { ReactNode } from 'react'

export function Tip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <div className="tooltip tooltip-left" data-tip={tip}>
      {children}
    </div>
  )
}