import { distance as turfDistance } from '@turf/turf'
import type { Waypoint } from '../types/mission'

// no per-waypoint speed is set by either tool yet, so legs fall back to this
export const CRUISE_SPEED_MPS = 10

export interface MissionStats {
  waypointCount: number
  distanceMeters: number
  durationSeconds: number
  minAltitude: number
  maxAltitude: number
}

// ground distance only, climb and descent between altitudes are ignored
export function summarisePlan(waypoints: Waypoint[]): MissionStats {
  let distanceMeters = 0
  let durationSeconds = 0

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i]
    const to = waypoints[i + 1]
    const leg = turfDistance([from.lng, from.lat], [to.lng, to.lat], { units: 'meters' })
    distanceMeters += leg
    durationSeconds += leg / (to.speed ?? CRUISE_SPEED_MPS)
  }

  const altitudes = waypoints.map((w) => w.alt ?? 0)

  return {
    waypointCount: waypoints.length,
    distanceMeters,
    durationSeconds,
    minAltitude: altitudes.length ? Math.min(...altitudes) : 0,
    maxAltitude: altitudes.length ? Math.max(...altitudes) : 0,
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  if (total < 60) return `${total}s`
  if (total < 3600) return `${Math.floor(total / 60)}m ${total % 60}s`
  return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`
}
