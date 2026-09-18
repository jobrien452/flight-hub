import { API_URL, ApiError, apiFetch } from './client'
import type {
  Mission,
  MissionCreateInput,
  MissionSummary,
  MissionUpdateInput,
  Waypoint,
} from '../types/mission'

// summaries only, the route is fetched per mission by getMissionWaypoints
export async function listMissions(token: string): Promise<MissionSummary[]> {
  return apiFetch<MissionSummary[]>('/missions', token)
}

export async function exportMissionPlan(id: string, token: string): Promise<string> {
  const res = await fetch(`${API_URL}/missions/${id}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.text()
}

export async function getMissionWaypoints(id: string, token: string): Promise<Waypoint[]> {
  return apiFetch<Waypoint[]>(`/missions/${id}/waypoints`, token)
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

export async function publishMission(id: string, token: string): Promise<Mission> {
  return apiFetch<Mission>(`/missions/${id}/publish`, token, { method: 'POST' })
}

// the optional message rides along to the pilot's email
export async function assignPilot(
  id: string,
  pilotId: string,
  message: string | null,
  token: string,
): Promise<Mission> {
  return apiFetch<Mission>(`/missions/${id}/assignments`, token, {
    method: 'POST',
    body: JSON.stringify({ pilot_id: pilotId, message }),
  })
}

export async function unassignPilot(
  id: string,
  pilotId: string,
  message: string | null,
  token: string,
): Promise<Mission> {
  return apiFetch<Mission>(`/missions/${id}/assignments/${pilotId}`, token, {
    method: 'DELETE',
    body: JSON.stringify({ message }),
  })
}

// the pilot's own moves through the state machine, an admin gets a 403 on both
export async function acknowledgeMission(id: string, token: string): Promise<Mission> {
  return apiFetch<Mission>(`/missions/${id}/acknowledge`, token, { method: 'POST' })
}

export async function startMission(id: string, token: string): Promise<Mission> {
  return apiFetch<Mission>(`/missions/${id}/start`, token, { method: 'POST' })
}
