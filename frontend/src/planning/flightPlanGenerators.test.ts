import { destination } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import {
  generateCorridorPlan,
  generateSurveyPlan,
  generateWaypointPlan,
} from './flightPlanGenerators'
import type { CorridorPlanParams, SurveyPlanParams, WaypointPlanParams } from '../types/mission'

function corner(originLng: number, originLat: number, eastMeters: number, northMeters: number) {
  const east = destination([originLng, originLat], eastMeters, 90, { units: 'meters' })
  const both = destination(east.geometry.coordinates, northMeters, 0, { units: 'meters' })
  return { lat: both.geometry.coordinates[1], lng: both.geometry.coordinates[0] }
}

describe('rectangle sweep generator', () => {
  it('produces a Waypoint array from a boundary and spacing', () => {
    const originLng = -122.4194
    const originLat = 37.7749
    const boundary = [
      corner(originLng, originLat, 0, 0),
      corner(originLng, originLat, 300, 0),
      corner(originLng, originLat, 300, 150),
      corner(originLng, originLat, 0, 150),
    ]
    const params: SurveyPlanParams = {
      type: 'survey',
      boundary,
      altitude: 40,
      spacing: 50,
    }

    const waypoints = generateSurveyPlan(params)

    expect(waypoints.length).toBeGreaterThan(2)
    expect(waypoints.every((w) => w.alt === 40)).toBe(true)
    for (const w of waypoints) {
      expect(w.lat).toBeGreaterThan(originLat - 0.01)
      expect(w.lat).toBeLessThan(originLat + 0.01)
      expect(w.lng).toBeGreaterThan(originLng - 0.01)
      expect(w.lng).toBeLessThan(originLng + 0.01)
    }
  })
})

describe('waypoint plan type', () => {
  it('is a pass-through of the manually placed points', () => {
    const params: WaypointPlanParams = {
      type: 'waypoint',
      waypoints: [
        { lat: 1, lng: 2, alt: 10 },
        { lat: 1.1, lng: 2.1, alt: 10 },
      ],
    }
    expect(generateWaypointPlan(params)).toEqual(params.waypoints)
  })
})

describe('corridor generator', () => {
  const originLng = -122.4194
  const originLat = 37.7749
  // a straight run east, the shape of a road or a pipeline
  const path = [
    corner(originLng, originLat, 0, 0),
    corner(originLng, originLat, 200, 0),
    corner(originLng, originLat, 400, 0),
  ]

  function params(overrides: Partial<CorridorPlanParams> = {}): CorridorPlanParams {
    return { type: 'corridor', path, altitude: 30, width: 20, spacing: 10, ...overrides }
  }

  it('needs at least two points to fly anything', () => {
    expect(generateCorridorPlan(params({ path: [path[0]] }))).toEqual([])
  })

  it('flies the centre line alone when the corridor has no width', () => {
    const waypoints = generateCorridorPlan(params({ width: 0 }))

    expect(waypoints).toHaveLength(path.length)
    expect(waypoints[0].lat).toBeCloseTo(path[0].lat, 6)
    expect(waypoints[0].lng).toBeCloseTo(path[0].lng, 6)
  })

  it('adds a parallel pass either side of the centre line', () => {
    const waypoints = generateCorridorPlan(params())

    // 20m wide at 10m spacing is three passes over a three point path
    expect(waypoints).toHaveLength(9)
  })

  it('offsets the passes across the path, not along it', () => {
    const waypoints = generateCorridorPlan(params())
    const lats = waypoints.map((w) => w.lat)

    // the run is due east, so the passes separate north to south
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(0)
    expect(waypoints[0].lat).not.toBeCloseTo(path[0].lat, 6)
  })

  it('turns around at the end of each pass instead of flying back empty', () => {
    const waypoints = generateCorridorPlan(params())
    const first = waypoints.slice(0, 3)
    const second = waypoints.slice(3, 6)

    // the second pass starts at the end the first one finished on
    expect(second[0].lng).toBeCloseTo(first[2].lng, 4)
    expect(second[2].lng).toBeCloseTo(first[0].lng, 4)
  })

  it('stamps the altitude on every point', () => {
    expect(generateCorridorPlan(params()).every((w) => w.alt === 30)).toBe(true)
  })
})
