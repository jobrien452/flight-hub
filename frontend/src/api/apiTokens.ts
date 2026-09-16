import { apiFetch, API_URL } from './client'
import type { ApiToken, ApiTokenCreated } from '../types/apiToken'

export async function listApiTokens(token: string): Promise<ApiToken[]> {
  return apiFetch<ApiToken[]>('/api-tokens', token)
}

export async function createApiToken(name: string, token: string): Promise<ApiTokenCreated> {
  return apiFetch<ApiTokenCreated>('/api-tokens', token, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function revokeApiToken(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/api-tokens/${id}`, token, { method: 'DELETE' })
}

// the spec is admin only, so it cannot be handed to swagger as a plain url
export async function getOpenApiSpec(token: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>('/openapi.json', token)
}

export { API_URL }
