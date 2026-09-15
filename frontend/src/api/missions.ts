import { apiFetch } from './client'
import type { Mission, MissionCreateInput, MissionUpdateInput } from '../types/mission'

export async function listMissions(token: string): Promise<Mission[]> {
  return apiFetch<Mission[]>('/missions', token)
}

export async function getMission(id: string, token: string): Promise<Mission> {
  return apiFetch<Mission>(`/missions/${id}`, token)
}

export async function createMission(
  payload: MissionCreateInput,
  token: string,
): Promise<Mission> {
  return apiFetch<Mission>('/missions', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateMission(
  id: string,
  payload: MissionUpdateInput,
  token: string,
): Promise<Mission> {
  return apiFetch<Mission>(`/missions/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteMission(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/missions/${id}`, token, { method: 'DELETE' })
}
