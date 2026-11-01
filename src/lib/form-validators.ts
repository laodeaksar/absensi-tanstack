/**
 * Validator yang sama dipakai saat mengetik dan saat submit.
 * Catatan: setelah semua form memakai skema zod, helper ini tidak lagi dipakai di route mana pun
 * dan aman dihapus bila proyek Anda juga tidak memakainya.
 */
export const vString = (fn: (a: { value: string }) => string | undefined) => ({ onChange: fn, onSubmit: fn })