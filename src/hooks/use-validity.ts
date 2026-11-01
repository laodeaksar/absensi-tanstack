import { useEffect, useRef } from 'react'

/**
 * Teruskan pesan error (mis. dari TanStack Form) ke Constraint Validation API milik elemen,
 * sehingga kelas `validator` daisyUI ikut aktif. Pesan kosong = valid.
 */
export function useValidity<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(message: string) {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.setCustomValidity(message)
  }, [message])
  return ref
}