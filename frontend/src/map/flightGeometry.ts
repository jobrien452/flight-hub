import type { Waypoint } from '../types/mission'

// [lng, lat, altitude in metres]
export type Position3D = [number, number, number]

export interface DropLine {
  from: Position3D
  to: Position3D
}

export interface ElevatedPoint {
  position: Position3D
  index: number
}

function altitudeOf(waypoint: Waypoint): number {
  return waypoint.alt ?? 0
}

export function toElevatedPoints(waypoints: Waypoint[]): ElevatedPoint[] {
  return waypoints.map((w, index) => ({ position: [w.lng, w.lat, altitudeOf(w)], index }))
}

// a post from the ground up to each waypoint, so altitude reads as a height
// instead of just a number in the infobox
export function toDropLines(waypoints: Waypoint[]): DropLine[] {
  return waypoints
    .filter((w) => altitudeOf(w) > 0)
    .map((w) => ({
      from: [w.lng, w.lat, 0] as Position3D,
      to: [w.lng, w.lat, altitudeOf(w)] as Position3D,
    }))
}

export function toFlightPath(waypoints: Waypoint[]): Position3D[] {
  if (waypoints.length < 2) return []
  return waypoints.map((w) => [w.lng, w.lat, altitudeOf(w)])
}
