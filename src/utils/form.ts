import type { AnyFieldApi } from '@tanstack/react-form'
import { firstMessage } from '~/lib/validation'

/** Pesan error field yang ditampilkan: kosong sampai field disentuh (atau form disubmit). */
export const errorText = (field: AnyFieldApi): string =>
  field.state.meta.isTouched ? firstMessage(field.state.meta.errors) : ''

export const hasError = (field: AnyFieldApi) => !!errorText(field)