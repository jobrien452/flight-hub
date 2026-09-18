import { apiFetch } from './client'
import type { Drone, DroneCreateInput, DroneUpdateInput } from '../types/drone'

// admins get their own fleet back, pilots get whatever they are booked to fly.
// retired aircraft are out of the working fleet, ask for them when they are wanted
export async function listDrones(token: string, includeRetired = false): Promise<Drone[]> {
  return apiFetch<Drone[]>(`/drones${includeRetired ? '?include_retired=true' : ''}`, token)
}

export async function getDrone(id: string, token: string): Promise<Drone> {
  return apiFetch<Drone>(`/drones/${id}`, token)
}

export async function createDrone(payload: DroneCreateInput, token: string): Promise<Drone> {
  return apiFetch<Drone>('/drones', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateDrone(
  id: string,
  payload: DroneUpdateInput,
  token: string,
): Promise<Drone> {
  return apiFetch<Drone>(`/drones/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteDrone(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/drones/${id}`, token, { method: 'DELETE' })
}
