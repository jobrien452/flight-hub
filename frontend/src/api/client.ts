export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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
    throw new ApiError(res.status, await res.text())
  }

  if (res.status === 204) return undefined as T

  return (await res.json()) as T
}
