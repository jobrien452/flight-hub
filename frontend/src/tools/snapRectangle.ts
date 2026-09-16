import { destination, distance } from '@turf/turf'
import type { Waypoint } from '../types/mission'
import type { LngLat } from './MapTool'

const DEFAULT_STEP_METERS = 10

// bounding box of the raw clicks, dimensions rounded to a clean number of
// meters, so 4 rough clicks give a tidy box instead of whatever imprecise
// numbers the clicks landed on. Returns [SW, SE, NE, NW].
export function snapToRectangle(points: LngLat[], stepMeters = DEFAULT_STEP_METERS): Waypoint[] {
  const south = Math.min(...points.map((p) => p.lat))
  const north = Math.max(...points.map((p) => p.lat))
  const west = Math.min(...points.map((p) => p.lng))
  const east = Math.max(...points.map((p) => p.lng))

  const sw: [number, number] = [west, south]
  const rawWidth = distance(sw, [east, south], { units: 'meters' })
  const rawHeight = distance(sw, [west, north], { units: 'meters' })

  const width = Math.max(stepMeters, Math.round(rawWidth / stepMeters) * stepMeters)
  const height = Math.max(stepMeters, Math.round(rawHeight / stepMeters) * stepMeters)

  const se = destination(sw, width, 90, { units: 'meters' }).geometry.coordinates
  const nw = destination(sw, height, 0, { units: 'meters' }).geometry.coordinates
  const ne = destination(se, height, 0, { units: 'meters' }).geometry.coordinates

  const toWaypoint = ([lng, lat]: number[]): Waypoint => ({ lat, lng })

  return [toWaypoint(sw), toWaypoint(se), toWaypoint(ne), toWaypoint(nw)]
}
