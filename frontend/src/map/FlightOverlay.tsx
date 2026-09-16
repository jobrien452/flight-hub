import { LineLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { useEffect, useMemo, useState } from 'react'
import { useControl, useMap } from 'react-map-gl/mapbox'
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
const SELECTED: [number, number, number] = [255, 255, 255]
const TETHER: [number, number, number, number] = [91, 141, 239, 140]
const WAYPOINT_LAYER = 'flight-waypoints-3d'
// forgiving enough to grab a 5px dot without a steady hand
const PICK_RADIUS = 10

// returns the index of the waypoint under a screen position, or null
export type WaypointPicker = (x: number, y: number) => number | null

interface FlightOverlayProps {
  waypoints: Waypoint[]
  selected?: number
  pickable?: boolean
  onPickerReady?: (pick: WaypointPicker | null) => void
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i])
}

// the map places geometry against sea level while waypoint altitudes are above
// ground, so sample the terrain under each one. it comes back null until the
// terrain tiles land, hence the resample once the map settles
function useGroundElevations(waypoints: Waypoint[]): number[] {
  const { current: map } = useMap()
  const [ground, setGround] = useState<number[]>([])

  useEffect(() => {
    if (!map) return

    const sample = () => {
      const next = waypoints.map(
        (w) => map.queryTerrainElevation({ lng: w.lng, lat: w.lat }, { exaggerated: true }) ?? 0,
      )
      setGround((current) => (sameNumbers(current, next) ? current : next))
    }

    sample()
    map.on('idle', sample)
    return () => {
      map.off('idle', sample)
    }
  }, [map, waypoints])

  return ground
}

// mapbox line and circle layers are always pinned to the ground, so the flight
// plan is drawn with deck.gl instead, which takes a real altitude per point
export function FlightOverlay({
  waypoints,
  selected,
  pickable = false,
  onPickerReady,
}: FlightOverlayProps) {
  const ground = useGroundElevations(waypoints)

  const layers = useMemo(() => {
    const path = toFlightPath(waypoints, ground)

    return [
      new LineLayer<DropLine>({
        id: 'waypoint-tethers',
        data: toDropLines(waypoints, ground),
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
        id: WAYPOINT_LAYER,
        data: toElevatedPoints(waypoints, ground),
        getPosition: (d) => d.position,
        getFillColor: (d) => (d.index === selected ? SELECTED : ACCENT),
        getRadius: (d) => (d.index === selected ? 8 : 5),
        radiusUnits: 'pixels',
        pickable,
        // keeps the dot facing the camera instead of lying flat as the map tilts
        billboard: true,
        updateTriggers: { getFillColor: selected, getRadius: selected },
      }),
    ]
  }, [waypoints, ground, selected, pickable])

  const overlay = useControl(() => new MapboxOverlay({ layers: [] })) as MapboxOverlay

  useEffect(() => {
    overlay.setProps({ layers })
  }, [overlay, layers])

  // the dots are drawn at altitude, so only deck knows what is under the cursor
  useEffect(() => {
    if (!onPickerReady) return

    onPickerReady((x, y) => {
      const info = overlay.pickObject({ x, y, radius: PICK_RADIUS, layerIds: [WAYPOINT_LAYER] })
      const index = (info?.object as ElevatedPoint | undefined)?.index
      return typeof index === 'number' ? index : null
    })

    return () => onPickerReady(null)
  }, [overlay, onPickerReady])

  return null
}
