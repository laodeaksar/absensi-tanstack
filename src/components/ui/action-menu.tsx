import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { EllipsisVertical } from 'lucide-react'

export function ActionMenu({ 
  children, 
  label = 'Aksi' 
}: { 
  children: ReactNode;
  label?: string
}) {
  // useId berisi karakter yang tidak valid untuk nama anchor CSS, jadi dibersihkan
  const key = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const popoverId = `menu-${key}`
  const anchor = `--anchor-${key}`

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-square"
        aria-label={label}
        popoverTarget={popoverId}
        style={{ anchorName: anchor } as CSSProperties}
      >
        <EllipsisVertical className="size-4" />
      </button>
      <ul
        id={popoverId}
        popover="auto"
        className="dropdown dropdown-end menu w-48 rounded-box bg-base-100 p-1 shadow-lg"
        style={{ positionAnchor: anchor } as CSSProperties}
        onClick={(e) => e.currentTarget.hidePopover()}
      >
        {children}
      </ul>
    </>
  )
}