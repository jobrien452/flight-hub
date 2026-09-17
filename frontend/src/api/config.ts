import { apiFetch } from './client'

// the mapbox token is not in the bundle, the server hands it to signed in users
export async function getMapToken(token: string): Promise<string> {
  const { token: mapToken } = await apiFetch<{ token: string }>('/config/map-token', token)
  return mapToken
}
