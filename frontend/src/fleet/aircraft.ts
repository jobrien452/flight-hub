export interface Aircraft {
  model: string
  processor: string
  gnss: string
  positionAccuracy: string
  maxFlightTimeMin: number
  cruiseSpeedKph: number
  maxSpeedKph: number
  payloadCapacityLbs: number
  operatingTempC: string
  radioOptions: string[]
}

// flyby publish one spec table for the series, so the two models carry the same
// figures. a drone's model is free text, this is only what we know about it
export const AIRCRAFT: Aircraft[] = [
  {
    model: 'F-11T',
    processor: 'NVIDIA Jetson Orin NX 16 GB',
    gnss: 'NEO-F9P, L1/L5 GPS, GLONASS, Beidou, Galileo',
    positionAccuracy: 'Dual RTK 1 cm + 1 ppm horizontal',
    maxFlightTimeMin: 56,
    cruiseSpeedKph: 42,
    maxSpeedKph: 80,
    payloadCapacityLbs: 5.7,
    operatingTempC: '-20 to 49',
    radioOptions: ['Taisync 2.4/5.8 GHz', 'Silvus 5200 EW resistant'],
  },
  {
    model: 'F-11S',
    processor: 'NVIDIA Jetson Orin NX 16 GB',
    gnss: 'NEO-F9P, L1/L5 GPS, GLONASS, Beidou, Galileo',
    positionAccuracy: 'Dual RTK 1 cm + 1 ppm horizontal',
    maxFlightTimeMin: 56,
    cruiseSpeedKph: 42,
    maxSpeedKph: 80,
    payloadCapacityLbs: 5.7,
    operatingTempC: '-20 to 49',
    radioOptions: ['Taisync 2.4/5.8 GHz', 'Silvus 5200 EW resistant'],
  },
]

export function findAircraft(model: string): Aircraft | undefined {
  const wanted = model.trim().toLowerCase()
  if (!wanted) return undefined
  return AIRCRAFT.find((aircraft) => aircraft.model.toLowerCase() === wanted)
}
