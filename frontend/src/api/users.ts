import { apiFetch } from './client'
import type { Role } from '../types/auth'
import type { User } from '../types/user'

export async function listUsers(token: string, role?: Role): Promise<User[]> {
  const query = role ? `?role=${role}` : ''
  return apiFetch<User[]>(`/users${query}`, token)
}

export async function getMe(token: string): Promise<User> {
  return apiFetch<User>('/users/me', token)
}
