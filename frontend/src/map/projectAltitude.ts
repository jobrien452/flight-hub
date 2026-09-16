import { WebMercatorViewport } from '@deck.gl/core'
import type { Position3D } from './flightGeometry'

export interface Camera {
  width: number
  height: number
  longitude: number
  latitude: number
  zoom: number
  pitch: number
  bearing: number
}

export interface ScreenPoint {
  x: number
  y: number
}

// a mapbox popup can only anchor to a ground coordinate, so anything drawn at
// altitude has to have its screen position worked out from the camera by hand
export function projectPosition(camera: Camera, position: Position3D): ScreenPoint {
  const [x, y] = new WebMercatorViewport(camera).project(position)
  return { x, y }
}
