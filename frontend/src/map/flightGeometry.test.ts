import { describe, expect, it } from 'vitest'
import type { Waypoint } from '../types/mission'
import { toDropLines, toElevatedPoints, toFlightPath } from './flightGeometry'

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
      { from: [2, 1, 0], to: [2, 1, 40] },
      { from: [4, 3, 0], to: [4, 3, 60] },
    ])
  })

  it('skips waypoints already on the ground', () => {
    expect(toDropLines([{ lat: 1, lng: 2, alt: 0 }, { lat: 3, lng: 4 }])).toEqual([])
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
