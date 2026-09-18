import type { Payload } from '../types/mission'

export interface CataloguePayload extends Payload {
  id: string
}

// the payloads an admin can pick from. sensor figures are the manufacturers',
// the mission stores a copy so changing this list never rewrites old missions
export const PAYLOADS: CataloguePayload[] = [
  {
    id: 'sony-ilx-lr1-24',
    name: 'Sony ILX-LR1 + FE 24mm',
    camera: 'Sony ILX-LR1',
    lens: 'Sony FE 24mm F2.8 G',
    gimbal: 'Gremsy Pixy',
    sensor_width_mm: 35.814,
    sensor_height_mm: 23.876,
    image_width_px: 9504,
    image_height_px: 6336,
    focal_length_mm: 24,
  },
  {
    id: 'sony-ilx-lr1-35',
    name: 'Sony ILX-LR1 + FE 35mm',
    camera: 'Sony ILX-LR1',
    lens: 'Sony FE 35mm F1.8',
    gimbal: 'Gremsy Pixy',
    sensor_width_mm: 35.814,
    sensor_height_mm: 23.876,
    image_width_px: 9504,
    image_height_px: 6336,
    focal_length_mm: 35,
  },
  {
    // flyby's own integration list, the block camera at its wide end
    id: 'gremsy-vio-eo',
    name: 'Gremsy VIO 4K zoom',
    camera: 'Sony 4K block camera, 20x optical',
    lens: '4.4-88.4mm zoom',
    gimbal: 'Gremsy VIO 3 axis',
    sensor_width_mm: 5.76,
    sensor_height_mm: 3.24,
    image_width_px: 3840,
    image_height_px: 2160,
    focal_length_mm: 4.4,
  },
  {
    // the same payload's thermal side, sensor size is 640 x 512 at a 12um pitch
    id: 'gremsy-vio-ir',
    name: 'Gremsy VIO thermal 640',
    camera: 'FLIR Boson 640R radiometric',
    lens: '14mm, 32 deg horizontal',
    gimbal: 'Gremsy VIO 3 axis',
    sensor_width_mm: 7.68,
    sensor_height_mm: 6.144,
    image_width_px: 640,
    image_height_px: 512,
    focal_length_mm: 14,
  },
  {
    id: 'zenmuse-p1-35',
    name: 'DJI Zenmuse P1 + 35mm',
    camera: 'DJI Zenmuse P1',
    lens: 'DJI DL 35mm F2.8',
    gimbal: 'Integrated 3 axis',
    sensor_width_mm: 35.9,
    sensor_height_mm: 24,
    image_width_px: 8192,
    image_height_px: 5460,
    focal_length_mm: 35,
  },
  {
    id: 'mavic-3e-wide',
    name: 'DJI Mavic 3E wide',
    camera: 'DJI Mavic 3E',
    lens: 'Integrated 24mm equivalent',
    gimbal: 'Integrated 3 axis',
    sensor_width_mm: 17.3,
    sensor_height_mm: 13,
    image_width_px: 5280,
    image_height_px: 3956,
    focal_length_mm: 12.29,
  },
]

export function findPayload(id: string): CataloguePayload | undefined {
  return PAYLOADS.find((payload) => payload.id === id)
}

// how much ground one pixel covers, the number that says whether a survey is
// detailed enough to be worth flying
export function gsdCmPerPixel(payload: Payload, altitudeM: number): number {
  if (!payload.focal_length_mm || !payload.image_width_px) return 0
  return (altitudeM * payload.sensor_width_mm * 100) / (payload.focal_length_mm * payload.image_width_px)
}

// how wide a single frame lands on the ground, which is what line spacing has
// to stay under for the passes to overlap at all
export function footprintWidthM(payload: Payload, altitudeM: number): number {
  if (!payload.focal_length_mm) return 0
  return (altitudeM * payload.sensor_width_mm) / payload.focal_length_mm
}

// what the side overlap works out to as a distance between passes. this is the
// number the sweep generators actually use, so the payload and altitude drive
// the flight path rather than just being displayed next to it
export function lineSpacingM(payload: Payload, altitudeM: number, overlapPercent: number): number {
  const frame = footprintWidthM(payload, altitudeM)
  const overlap = Number.isFinite(overlapPercent) ? Math.min(Math.max(overlapPercent, 0), 99) : 0
  // never zero, a spacing of nothing would ask for an endless number of lines
  return Math.max(1, frame * (1 - overlap / 100))
}
