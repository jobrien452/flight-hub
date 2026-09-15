import {
  bearing as turfBearing,
  centroid as turfCentroid,
  destination as turfDestination,
  distance as turfDistance,
  polygon as turfPolygon,
  transformRotate,
} from '@turf/turf'
import type { Position } from 'geojson'
import type { SurveyPlanParams, Waypoint, WaypointPlanParams } from '../types/mission'

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
