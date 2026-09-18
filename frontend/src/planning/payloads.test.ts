import { describe, expect, it } from 'vitest'
import {
  PAYLOADS,
  findPayload,
  footprintWidthM,
  gsdCmPerPixel,
  lineSpacingM,
} from './payloads'

const lr1 = PAYLOADS.find((p) => p.id === 'sony-ilx-lr1-24')!

describe('payload catalogue', () => {
  it('carries the sony body on the gremsy gimbal', () => {
    expect(lr1).toMatchObject({
      camera: 'Sony ILX-LR1',
      gimbal: 'Gremsy Pixy',
      image_width_px: 9504,
      focal_length_mm: 24,
    })
  })

  it('gives every entry the numbers the optics need', () => {
    for (const payload of PAYLOADS) {
      expect(payload.sensor_width_mm).toBeGreaterThan(0)
      expect(payload.image_width_px).toBeGreaterThan(0)
      expect(payload.focal_length_mm).toBeGreaterThan(0)
      expect(payload.name).not.toBe('')
    }
  })

  it('looks an entry up by id', () => {
    expect(findPayload('sony-ilx-lr1-24')?.camera).toBe('Sony ILX-LR1')
    expect(findPayload('nope')).toBeUndefined()
  })
})

describe('ground sample distance', () => {
  it('works out cm per pixel from altitude, sensor and focal length', () => {
    // 100m * 35.814mm / (24mm * 9504px) = 0.0157cm per pixel per metre of sensor
    expect(gsdCmPerPixel(lr1, 100)).toBeCloseTo(1.57, 2)
  })

  it('gets coarser the higher the aircraft flies', () => {
    expect(gsdCmPerPixel(lr1, 200)).toBeCloseTo(gsdCmPerPixel(lr1, 100) * 2, 4)
  })

  it('is zero on the ground', () => {
    expect(gsdCmPerPixel(lr1, 0)).toBe(0)
  })

  it('refuses to divide by a missing lens', () => {
    const broken = { ...lr1, focal_length_mm: 0 }
    expect(gsdCmPerPixel(broken, 100)).toBe(0)
  })
})

describe('ground footprint', () => {
  it('works out how wide a single frame lands', () => {
    // 100m * 35.814mm / 24mm = 149.2m across
    expect(footprintWidthM(lr1, 100)).toBeCloseTo(149.2, 1)
  })

  it('is the gsd times the pixel count', () => {
    const fromGsd = (gsdCmPerPixel(lr1, 120) * lr1.image_width_px) / 100
    expect(footprintWidthM(lr1, 120)).toBeCloseTo(fromGsd, 4)
  })

  it('refuses to divide by a missing lens', () => {
    expect(footprintWidthM({ ...lr1, focal_length_mm: 0 }, 100)).toBe(0)
  })
})

describe('line spacing from overlap', () => {
  it('leaves a full frame between passes at no overlap', () => {
    expect(lineSpacingM(lr1, 100, 0)).toBeCloseTo(footprintWidthM(lr1, 100), 4)
  })

  it('halves the spacing at fifty percent overlap', () => {
    expect(lineSpacingM(lr1, 100, 50)).toBeCloseTo(footprintWidthM(lr1, 100) / 2, 4)
  })

  it('tightens the passes as the overlap goes up', () => {
    expect(lineSpacingM(lr1, 100, 80)).toBeLessThan(lineSpacingM(lr1, 100, 60))
  })

  it('widens the passes as the aircraft climbs', () => {
    expect(lineSpacingM(lr1, 200, 70)).toBeGreaterThan(lineSpacingM(lr1, 100, 70))
  })

  it('never returns zero, which would generate an endless sweep', () => {
    expect(lineSpacingM(lr1, 100, 100)).toBeGreaterThanOrEqual(1)
    expect(lineSpacingM(lr1, 0, 90)).toBeGreaterThanOrEqual(1)
  })

  it('falls back to a full frame for nonsense overlap', () => {
    expect(lineSpacingM(lr1, 100, -20)).toBeCloseTo(footprintWidthM(lr1, 100), 4)
  })
})
