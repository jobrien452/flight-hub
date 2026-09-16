import { describe, expect, it } from 'vitest'
import type { Waypoint } from '../types/mission'
import { CRUISE_SPEED_MPS, formatDistance, formatDuration, summarisePlan } from './missionStats'

// roughly 1 km apart at the equator
const a: Waypoint = { lat: 0, lng: 0, alt: 40 }
const b: Waypoint = { lat: 0, lng: 0.008993, alt: 60 }

describe('summarisePlan', () => {
  it('reports nothing much for an empty plan', () => {
    const stats = summarisePlan([])

    expect(stats.waypointCount).toBe(0)
    expect(stats.distanceMeters).toBe(0)
    expect(stats.durationSeconds).toBe(0)
  })

  it('has no distance to cover for a single waypoint', () => {
    const stats = summarisePlan([a])

    expect(stats.waypointCount).toBe(1)
    expect(stats.distanceMeters).toBe(0)
  })

  it('adds up the legs between waypoints', () => {
    const stats = summarisePlan([a, b])

    expect(stats.distanceMeters).toBeCloseTo(1000, -1)
  })

  it('estimates duration from the cruise speed', () => {
    const stats = summarisePlan([a, b])

    expect(stats.durationSeconds).toBeCloseTo(stats.distanceMeters / CRUISE_SPEED_MPS, 5)
  })

  it('uses a waypoint speed when the plan sets one', () => {
    const slow = summarisePlan([a, { ...b, speed: CRUISE_SPEED_MPS / 2 }])
    const normal = summarisePlan([a, b])

    expect(slow.durationSeconds).toBeCloseTo(normal.durationSeconds * 2, 5)
  })

  it('reports the altitude range across the plan', () => {
    const stats = summarisePlan([a, b, { lat: 0, lng: 0.01, alt: 10 }])

    expect(stats.minAltitude).toBe(10)
    expect(stats.maxAltitude).toBe(60)
  })

  it('treats a waypoint with no altitude as ground level', () => {
    const stats = summarisePlan([{ lat: 0, lng: 0 }])

    expect(stats.minAltitude).toBe(0)
    expect(stats.maxAltitude).toBe(0)
  })
})

describe('formatDistance', () => {
  it('uses metres under a kilometre', () => {
    expect(formatDistance(842.4)).toBe('842 m')
  })

  it('switches to kilometres above one', () => {
    expect(formatDistance(1840)).toBe('1.84 km')
  })
})

describe('formatDuration', () => {
  it('uses seconds under a minute', () => {
    expect(formatDuration(45)).toBe('45s')
  })

  it('uses minutes and seconds under an hour', () => {
    expect(formatDuration(200)).toBe('3m 20s')
  })

  it('uses hours and minutes above one', () => {
    expect(formatDuration(3900)).toBe('1h 5m')
  })

  it('reads as nothing for an empty plan', () => {
    expect(formatDuration(0)).toBe('0s')
  })
})
