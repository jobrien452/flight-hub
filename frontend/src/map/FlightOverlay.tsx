import { LineLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { useEffect, useMemo } from 'react'
import { useControl } from 'react-map-gl/mapbox'
import type { Waypoint } from '../types/mission'
import {
  toDropLines,
  toElevatedPoints,
  toFlightPath,
  type DropLine,
  type ElevatedPoint,
  type Position3D,
} from './flightGeometry'

const ACCENT: [number, number, number] = [91, 141, 239]
const TETHER: [number, number, number, number] = [91, 141, 239, 110]

// mapbox line and circle layers are always pinned to the ground, so the flight
// plan is drawn with deck.gl instead, which takes a real altitude per point
export function FlightOverlay({ waypoints }: { waypoints: Waypoint[] }) {
  const layers = useMemo(() => {
    const path = toFlightPath(waypoints)

    return [
      new LineLayer<DropLine>({
        id: 'waypoint-tethers',
        data: toDropLines(waypoints),
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getColor: TETHER,
        getWidth: 1.5,
      }),
      new PathLayer<{ path: Position3D[] }>({
        id: 'flight-path-3d',
        data: path.length ? [{ path }] : [],
        getPath: (d) => d.path,
        getColor: ACCENT,
        getWidth: 2,
        widthUnits: 'pixels',
      }),
      new ScatterplotLayer<ElevatedPoint>({
        id: 'flight-waypoints-3d',
        data: toElevatedPoints(waypoints),
        getPosition: (d) => d.position,
        getFillColor: ACCENT,
        getRadius: 5,
        radiusUnits: 'pixels',
        // keeps the dot facing the camera instead of lying flat as the map tilts
        billboard: true,
      }),
    ]
  }, [waypoints])

  const overlay = useControl(() => new MapboxOverlay({ layers: [] })) as MapboxOverlay

  useEffect(() => {
    overlay.setProps({ layers })
  }, [overlay, layers])

  return null
}
