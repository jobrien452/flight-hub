import { storeSession } from '../auth/session'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// the provider listens for this and drops the session out of react state, which
// sends the app back to the sign in screen
export const SIGNED_OUT_EVENT = 'flyby:signed-out'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// small fetch wrapper, attaches bearer token and parses json or throws ApiError
export async function apiFetch<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })

  if (!res.ok) {
    // a refused sign in is about the credentials just typed, not about a session
    if (res.status === 401 && !path.startsWith('/auth/')) {
      storeSession(null)
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
    }
    throw new ApiError(res.status, await res.text())
  }

  if (res.status === 204) return undefined as T

  return (await res.json()) as T
}
