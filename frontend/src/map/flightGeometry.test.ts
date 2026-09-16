import { describe, expect, it } from 'vitest'
import type { Waypoint } from '../types/mission'
import { toDropLines, toElevatedPoints, toFlightPath, toGroundPips } from './flightGeometry'

const plan: Waypoint[] = [
  { lat: 1, lng: 2, alt: 40 },
  { lat: 3, lng: 4, alt: 60 },
]

describe('toElevatedPoints', () => {
  it('lifts each waypoint to its own altitude', () => {
    expect(toElevatedPoints(plan)).toEqual([
      { position: [2, 1, 40], index: 0 },
      { position: [4, 3, 60], index: 1 },
    ])
  })

  it('treats a waypoint with no altitude as ground level', () => {
    expect(toElevatedPoints([{ lat: 1, lng: 2 }])).toEqual([{ position: [2, 1, 0], index: 0 }])
  })
})

describe('toDropLines', () => {
  it('runs a line from the ground up to each waypoint', () => {
    expect(toDropLines(plan)).toEqual([
      { from: [2, 1, 0], to: [2, 1, 40], index: 0 },
      { from: [4, 3, 0], to: [4, 3, 60], index: 1 },
    ])
  })

  it('skips waypoints already on the ground', () => {
    expect(toDropLines([{ lat: 1, lng: 2, alt: 0 }, { lat: 3, lng: 4 }])).toEqual([])
  })
})

describe('toGroundPips', () => {
  it('marks the floor under each airborne waypoint', () => {
    expect(toGroundPips(plan, [500, 900])).toEqual([
      { position: [2, 1, 500], index: 0 },
      { position: [4, 3, 900], index: 1 },
    ])
  })

  it('leaves the ground unmarked where a waypoint already sits on it', () => {
    const mixed: Waypoint[] = [
      { lat: 1, lng: 2, alt: 0 },
      { lat: 3, lng: 4, alt: 60 },
    ]

    expect(toGroundPips(mixed, [100, 900])).toEqual([{ position: [4, 3, 900], index: 1 }])
  })

  it('lands each pip at the foot of its own tether', () => {
    const pips = toGroundPips(plan, [500, 900])
    const tethers = toDropLines(plan, [500, 900])

    expect(pips.map((p) => p.position)).toEqual(tethers.map((t) => t.from))
  })
})

describe('altitude above ground', () => {
  it('lifts waypoints by the ground height beneath them', () => {
    expect(toElevatedPoints(plan, [500, 900])).toEqual([
      { position: [2, 1, 540], index: 0 },
      { position: [4, 3, 960], index: 1 },
    ])
  })

  it('starts each tether at the ground, not at sea level', () => {
    expect(toDropLines(plan, [500, 900])).toEqual([
      { from: [2, 1, 500], to: [2, 1, 540], index: 0 },
      { from: [4, 3, 900], to: [4, 3, 960], index: 1 },
    ])
  })

  it('threads the path above the ground it crosses', () => {
    expect(toFlightPath(plan, [500, 900])).toEqual([
      [2, 1, 540],
      [4, 3, 960],
    ])
  })

  it('keeps tethers lined up with their own waypoint when some sit on the ground', () => {
    const mixed: Waypoint[] = [
      { lat: 1, lng: 2, alt: 0 },
      { lat: 3, lng: 4, alt: 60 },
    ]

    expect(toDropLines(mixed, [100, 900])).toEqual([{ from: [4, 3, 900], to: [4, 3, 960], index: 1 }])
  })

  it('falls back to sea level when the ground is not known yet', () => {
    expect(toElevatedPoints(plan, [])).toEqual([
      { position: [2, 1, 40], index: 0 },
      { position: [4, 3, 60], index: 1 },
    ])
  })
})

describe('toFlightPath', () => {
  it('threads the path through the waypoint altitudes', () => {
    expect(toFlightPath(plan)).toEqual([
      [2, 1, 40],
      [4, 3, 60],
    ])
  })

  it('has no path to draw for a single waypoint', () => {
    expect(toFlightPath([plan[0]])).toEqual([])
  })

  it('has no path to draw for an empty plan', () => {
    expect(toFlightPath([])).toEqual([])
  })
})

