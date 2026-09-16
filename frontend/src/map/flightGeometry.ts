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

// waypoint altitudes are above ground, but the map places geometry against sea
// level, so the ground height under each waypoint has to be added back on or a
// plan over high ground ends up buried inside the hill
function groundAt(ground: number[], index: number): number {
  return ground[index] ?? 0
}

export function toElevatedPoints(waypoints: Waypoint[], ground: number[] = []): ElevatedPoint[] {
  return waypoints.map((w, index) => ({
    position: [w.lng, w.lat, groundAt(ground, index) + altitudeOf(w)],
    index,
  }))
}

// a post from the ground up to each waypoint, so altitude reads as a height
// instead of just a number in the infobox
export function toDropLines(waypoints: Waypoint[], ground: number[] = []): DropLine[] {
  return waypoints
    .map((w, index) => ({ w, index }))
    .filter(({ w }) => altitudeOf(w) > 0)
    .map(({ w, index }) => ({
      from: [w.lng, w.lat, groundAt(ground, index)] as Position3D,
      to: [w.lng, w.lat, groundAt(ground, index) + altitudeOf(w)] as Position3D,
    }))
}

export function toFlightPath(waypoints: Waypoint[], ground: number[] = []): Position3D[] {
  if (waypoints.length < 2) return []
  return waypoints.map((w, index) => [w.lng, w.lat, groundAt(ground, index) + altitudeOf(w)])
}
