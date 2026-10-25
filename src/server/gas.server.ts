// Hanya berjalan di server. Menjembatani Start -> Apps Script (doPost di Api.gs).
export async function callGas<T = any>(fn: string, args: unknown[] = []): Promise<T> {
  const url = process.env.APPS_SCRIPT_URL
  const secret = process.env.API_SECRET
  if (!url || !secret) {
    throw new Error('Server belum dikonfigurasi (APPS_SCRIPT_URL / API_SECRET).')
  }

  const res = await fetch(url, {
    method: 'POST',
    // text/plain menghindari preflight; Apps Script tetap membaca isi body-nya
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret, fn, args }),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Apps Script membalas HTTP ${res.status}`)

  let json: any
  try {
    json = await res.json()
  } catch {
    throw new Error('Respons Apps Script tidak valid. Pastikan deployment Web App diakses oleh "Anyone".')
  }
  if (!json || json.success === false) {
    throw new Error((json && json.message) || 'Permintaan gagal')
  }
  return json as T
}