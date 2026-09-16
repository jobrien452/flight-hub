import { distance } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import { snapToRectangle } from './snapRectangle'

describe('snapToRectangle', () => {
  it('returns 4 corners with dimensions rounded to a clean number of meters', () => {
    const origin = { lng: -122.4194, lat: 37.7749 }
    const roughCorners = [
      { lng: origin.lng, lat: origin.lat },
      { lng: origin.lng + 0.002, lat: origin.lat + 0.0001 },
      { lng: origin.lng + 0.0019, lat: origin.lat + 0.001 },
      { lng: origin.lng + 0.0001, lat: origin.lat + 0.0009 },
    ]

    const rect = snapToRectangle(roughCorners, 10)

    expect(rect).toHaveLength(4)
    const [sw, se, , nw] = rect.map((w) => [w.lng, w.lat])
    const width = distance(sw, se, { units: 'meters' })
    const height = distance(sw, nw, { units: 'meters' })

    expect(Math.round(width) % 10).toBe(0)
    expect(Math.round(height) % 10).toBe(0)
  })

  it('enforces a minimum size for a near-zero box', () => {
    const rect = snapToRectangle(
      [
        { lng: 0, lat: 0 },
        { lng: 0.00001, lat: 0 },
        { lng: 0.00001, lat: 0.00001 },
        { lng: 0, lat: 0.00001 },
      ],
      10,
    )
    const [sw, se, , nw] = rect.map((w) => [w.lng, w.lat])
    expect(distance(sw, se, { units: 'meters' })).toBeCloseTo(10, 0)
    expect(distance(sw, nw, { units: 'meters' })).toBeCloseTo(10, 0)
  })

  it('produces a closed rectangle, right angles all around', () => {
    const rect = snapToRectangle(
      [
        { lng: -100, lat: 40 },
        { lng: -99.997, lat: 40 },
        { lng: -99.997, lat: 40.002 },
        { lng: -100, lat: 40.002 },
      ],
      10,
    )
    const [sw, se, ne, nw] = rect.map((w) => [w.lng, w.lat])
    const width1 = distance(sw, se, { units: 'meters' })
    const width2 = distance(nw, ne, { units: 'meters' })
    const height1 = distance(sw, nw, { units: 'meters' })
    const height2 = distance(se, ne, { units: 'meters' })

    expect(width1).toBeCloseTo(width2, 0)
    expect(height1).toBeCloseTo(height2, 0)
  })
})
