import { useSyncExternalStore } from 'react'

export type ToastType = 'success' | 'error' | 'info'
export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

const EMPTY: ToastItem[] = []
let items: ToastItem[] = EMPTY
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function push(type: ToastType, message: string) {
  const id = nextId++
  items = [...items, { id, type, message }]
  emit()
  setTimeout(() => {
    items = items.filter((t) => t.id !== id)
    emit()
  }, 4000)
}

export const toast = {
  success: (m: string) => push('success', m),
  error: (m: string) => push('error', m),
  info: (m: string) => push('info', m),
}

export function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => items,
    () => EMPTY,
  )
}