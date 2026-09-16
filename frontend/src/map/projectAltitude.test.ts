import { describe, expect, it } from 'vitest'
import { projectPosition, type Camera } from './projectAltitude'

const camera: Camera = {
  width: 800,
  height: 600,
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 15,
  pitch: 45,
  bearing: 0,
}

const centre: [number, number, number] = [camera.longitude, camera.latitude, 0]

describe('projectPosition', () => {
  it('puts the camera centre in the middle of the viewport', () => {
    const { x, y } = projectPosition(camera, centre)

    expect(x).toBeCloseTo(camera.width / 2, 0)
    expect(y).toBeCloseTo(camera.height / 2, 0)
  })

  it('draws an elevated point higher up the screen than the ground below it', () => {
    const ground = projectPosition(camera, centre)
    const aloft = projectPosition(camera, [camera.longitude, camera.latitude, 120])

    expect(aloft.y).toBeLessThan(ground.y)
  })

  it('separates them further the higher the point is', () => {
    const ground = projectPosition(camera, centre)
    const low = projectPosition(camera, [camera.longitude, camera.latitude, 50])
    const high = projectPosition(camera, [camera.longitude, camera.latitude, 200])

    expect(ground.y - high.y).toBeGreaterThan(ground.y - low.y)
  })

  it('keeps an elevated point directly above its ground position when looking north', () => {
    const ground = projectPosition(camera, centre)
    const aloft = projectPosition(camera, [camera.longitude, camera.latitude, 120])

    expect(aloft.x).toBeCloseTo(ground.x, 0)
  })

  it('stacks straight up when the camera looks straight down', () => {
    const topDown = { ...camera, pitch: 0 }
    const ground = projectPosition(topDown, centre)
    const aloft = projectPosition(topDown, [camera.longitude, camera.latitude, 120])

    // no tilt means no parallax, altitude is invisible from directly overhead
    expect(aloft.y).toBeCloseTo(ground.y, 0)
  })
})
