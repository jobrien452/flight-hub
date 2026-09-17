import {
  bearing as turfBearing,
  centroid as turfCentroid,
  destination as turfDestination,
  distance as turfDistance,
  polygon as turfPolygon,
  transformRotate,
} from '@turf/turf'
import type { Position } from 'geojson'
import type {
  CorridorPlanParams,
  SurveyPlanParams,
  Waypoint,
  WaypointPlanParams,
} from '../types/mission'

function toPosition(w: Waypoint): Position {
  return [w.lng, w.lat]
}

function toWaypoint(pos: Position, altitude: number): Waypoint {
  return { lng: pos[0], lat: pos[1], alt: altitude }
}

// picks the bearing of the boundary's longest edge, used as the sweep direction
// when the admin doesn't set one explicitly
function longestEdgeBearing(ring: Position[]): number {
  let bestLength = -Infinity
  let bestBearing = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const length = turfDistance(ring[i], ring[i + 1], { units: 'meters' })
    if (length > bestLength) {
      bestLength = length
      bestBearing = turfBearing(ring[i], ring[i + 1])
    }
  }
  return bestBearing
}

// manual point placement, nothing to generate
export function generateWaypointPlan(params: WaypointPlanParams): Waypoint[] {
  return params.waypoints
}

// boustrophedon (lawnmower) sweep, rectangle boundary only for now
// see tmp/flight-path-planning.md for the approach and the convex/concave stretch goals
export function generateSurveyPlan(params: SurveyPlanParams): Waypoint[] {
  const { boundary, altitude, spacing } = params
  const ring = boundary.map(toPosition)
  const closedRing = [...ring, ring[0]]
  const poly = turfPolygon([closedRing])
  const pivot = turfCentroid(poly).geometry.coordinates

  const sweepBearing = params.heading ?? longestEdgeBearing(closedRing)

  // rotate the boundary so the sweep direction lines up with north, sweep
  // lines then run vertically and stepping between them is a simple eastward walk
  const rotated = transformRotate(poly, -sweepBearing, { pivot })
  const rotatedRing = rotated.geometry.coordinates[0]

  const lngs = rotatedRing.map((p) => p[0])
  const lats = rotatedRing.map((p) => p[1])
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)

  const southWest: Position = [minLng, minLat]
  const width = turfDistance(southWest, [maxLng, minLat], { units: 'meters' })
  const lineCount = Math.max(1, Math.floor(width / spacing) + 1)

  const lines: [Position, Position][] = []
  for (let i = 0; i < lineCount; i++) {
    const x = turfDestination(southWest, i * spacing, 90, { units: 'meters' }).geometry
      .coordinates[0]
    lines.push([
      [x, minLat],
      [x, maxLat],
    ])
  }

  // alternate direction each line so the path zigzags instead of jumping back
  const orderedPoints = lines.flatMap(([start, end], i) => (i % 2 === 0 ? [start, end] : [end, start]))

  const flightLine = transformRotate(
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: orderedPoints },
    },
    sweepBearing,
    { pivot },
  )

  return flightLine.geometry.coordinates.map((pos) => toWaypoint(pos, altitude))
}


// how far off the centre line each pass runs, spread evenly across the width
function corridorOffsets(width: number, spacing: number): number[] {
  if (width <= 0 || spacing <= 0) return [0]
  const passes = Math.max(2, Math.floor(width / spacing) + 1)
  const step = width / (passes - 1)
  return Array.from({ length: passes }, (_, i) => -width / 2 + i * step)
}

// the direction of travel at a vertex, taken from the segment it sits on
function headingAt(path: Waypoint[], index: number): number {
  const from = index === 0 ? path[0] : path[index - 1]
  const to = index === 0 ? path[1] : path[index]
  return turfBearing(toPosition(from), toPosition(to))
}

function offsetVertex(path: Waypoint[], index: number, offset: number, altitude: number): Waypoint {
  if (offset === 0) return { ...path[index], alt: altitude }
  // square to the direction of travel, left or right depending on the sign
  const across = headingAt(path, index) + (offset > 0 ? 90 : -90)
  const moved = turfDestination(toPosition(path[index]), Math.abs(offset), across, {
    units: 'meters',
  })
  return toWaypoint(moved.geometry.coordinates, altitude)
}

// parallel passes along a centre line, alternating direction so the aircraft
// turns at the end of a pass rather than flying back empty
export function generateCorridorPlan(params: CorridorPlanParams): Waypoint[] {
  const { path, altitude, width, spacing } = params
  if (path.length < 2) return []

  return corridorOffsets(width, spacing).flatMap((offset, pass) => {
    const line = path.map((_, index) => offsetVertex(path, index, offset, altitude))
    return pass % 2 === 0 ? line : line.reverse()
  })
}
