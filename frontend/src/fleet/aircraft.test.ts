import { describe, expect, it } from 'vitest'
import { AIRCRAFT, findAircraft } from './aircraft'

describe('aircraft catalogue', () => {
  it('carries the f-11 series', () => {
    expect(AIRCRAFT.map((a) => a.model)).toEqual(['F-11T', 'F-11S'])
  })

  it('carries the published figures for the airframe', () => {
    const f11t = findAircraft('F-11T')!
    expect(f11t).toMatchObject({
      processor: 'NVIDIA Jetson Orin NX 16 GB',
      maxFlightTimeMin: 56,
      maxSpeedKph: 80,
      cruiseSpeedKph: 42,
      payloadCapacityLbs: 5.7,
    })
    expect(f11t.radioOptions.length).toBeGreaterThan(0)
  })

  it('gives every entry the figures the fleet view reads', () => {
    for (const aircraft of AIRCRAFT) {
      expect(aircraft.model).not.toBe('')
      expect(aircraft.maxFlightTimeMin).toBeGreaterThan(0)
      expect(aircraft.maxSpeedKph).toBeGreaterThan(0)
      expect(aircraft.payloadCapacityLbs).toBeGreaterThan(0)
      expect(aircraft.gnss).not.toBe('')
    }
  })

  it('matches a model however it was typed in', () => {
    expect(findAircraft('f-11s')?.model).toBe('F-11S')
    expect(findAircraft('  F-11T  ')?.model).toBe('F-11T')
  })

  it('has nothing to say about someone elses aircraft', () => {
    expect(findAircraft('Matrice 350 RTK')).toBeUndefined()
    expect(findAircraft('')).toBeUndefined()
  })
})
