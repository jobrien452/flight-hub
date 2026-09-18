import { apiFetch } from './client'
import type { Role } from '../types/auth'
import type { User, UserCreateInput, UserUpdateInput } from '../types/user'

export async function listUsers(token: string, role?: Role): Promise<User[]> {
  const query = role ? `?role=${role}` : ''
  return apiFetch<User[]>(`/users${query}`, token)
}

export async function getMe(token: string): Promise<User> {
  return apiFetch<User>('/users/me', token)
}

export async function createUser(payload: UserCreateInput, token: string): Promise<User> {
  return apiFetch<User>('/users', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateUser(
  id: string,
  payload: UserUpdateInput,
  token: string,
): Promise<User> {
  return apiFetch<User>(`/users/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteUser(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/users/${id}`, token, { method: 'DELETE' })
}
