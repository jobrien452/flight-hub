import { apiFetch } from './client'
import type { LoginResponse } from '../types/auth'

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function acceptInvite(token: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/accept-invite', undefined, {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch<{ status: string }>('/auth/request-password-reset', undefined, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiFetch<{ status: string }>('/auth/reset-password', undefined, {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}
