import { destination } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import { generateSurveyPlan, generateWaypointPlan } from './flightPlanGenerators'
import type { SurveyPlanParams, WaypointPlanParams } from '../types/mission'

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
