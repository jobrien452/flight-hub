import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Map, { Layer, ScaleControl, Source } from 'react-map-gl/mapbox'
import type { MapMouseEvent, MapRef } from 'react-map-gl/mapbox'
import type { Map as MapboxMap } from 'mapbox-gl'
import { AddressSearch } from './AddressSearch'
import { FlightOverlay, type WaypointPicker } from './FlightOverlay'
import { MapStyleControl } from './MapStyleControl'
import { MAP_STYLES, useMapStyle } from './mapStyles'
import { projectPosition, type ScreenPoint } from './projectAltitude'
import { applyTerrain } from './terrain'
import type { LngLat, ToolOverlay } from '../tools/MapTool'
import type { Waypoint } from '../types/mission'
import 'mapbox-gl/dist/mapbox-gl.css'
import './MapView.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
// the survey box has to stand out over satellite imagery, where a muted amber
// disappears into dry ground
const GHOST = '#ff8a3d'
const SELECTED = '#ffffff'
// tilted by default, altitude is invisible looking straight down
const DEFAULT_PITCH = 45

// corners the user has dropped so far, plus the closed box once it snaps
function toOverlayCollection(overlay: ToolOverlay): GeoJSON.FeatureCollection {
  const markers: GeoJSON.Feature[] = overlay.markers.map((w, index) => ({
    type: 'Feature',
    // index rides along so a grabbed handle knows which corner it is
    properties: { index, selected: index === overlay.selected },
    geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
  }))

  const ring = overlay.ghost ?? []
  const ghost: GeoJSON.Feature[] =
    ring.length >= 3
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [[...ring, ring[0]].map((w) => [w.lng, w.lat])],
            },
          },
        ]
      : []

  return { type: 'FeatureCollection', features: [...markers, ...ghost] }
}

interface MapViewProps {
  waypoints: Waypoint[]
  onMapClick: (point: LngLat) => void
  overlay?: ToolOverlay
  onHandleDragStart?: (index: number) => void
  onHandleDrag?: (point: LngLat) => void
  onHandleDragEnd?: () => void
  // popup pinned to a waypoint, the caller owns whatever goes inside it
  infoboxAt?: Waypoint
  infobox?: ReactNode
}

export function MapView({
  waypoints,
  onMapClick,
  overlay,
  onHandleDragStart,
  onHandleDrag,
  onHandleDragEnd,
  infoboxAt,
  infobox,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const draggingRef = useRef(false)
  // a drag ends with a click event, which would otherwise drop a new corner
  const swallowClickRef = useRef(false)
  const [hoveringHandle, setHoveringHandle] = useState(false)
  const [hoveringWaypoint, setHoveringWaypoint] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [styleId, setStyleId] = useMapStyle()
  const [infoboxPoint, setInfoboxPoint] = useState<ScreenPoint | null>(null)
  const pickWaypoint = useRef<WaypointPicker | null>(null)
  const handlePickerReady = useCallback((pick: WaypointPicker | null) => {
    pickWaypoint.current = pick
  }, [])

  // the infobox belongs at the waypoint's altitude, not on the ground under it,
  // so its screen position is worked out from the camera on every move
  const positionInfobox = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map || !infoboxAt) {
      setInfoboxPoint(null)
      return
    }

    const container = map.getContainer()
    const ground =
      map.queryTerrainElevation({ lng: infoboxAt.lng, lat: infoboxAt.lat }, { exaggerated: true }) ??
      0
    const centre = map.getCenter()

    setInfoboxPoint(
      projectPosition(
        {
          width: container.clientWidth,
          height: container.clientHeight,
          longitude: centre.lng,
          latitude: centre.lat,
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        },
        [infoboxAt.lng, infoboxAt.lat, ground + (infoboxAt.alt ?? 0)],
      ),
    )
  }, [infoboxAt])

  useEffect(positionInfobox, [positionInfobox])


  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-missing-token">
        Set VITE_MAPBOX_TOKEN in frontend/.env to render the map.
      </div>
    )
  }

  const first = waypoints[0]

  function handleClick(event: MapMouseEvent) {
    if (swallowClickRef.current) {
      swallowClickRef.current = false
      return
    }
    onMapClick({ lng: event.lngLat.lng, lat: event.lngLat.lat })
  }

  function handleMouseDown(event: MapMouseEvent) {
    // the select tool's handles are the waypoints themselves, drawn at altitude
    // by deck, so ask it what is under the cursor rather than the flat map layer
    const index = overlay?.dragsPlanWaypoints
      ? pickWaypoint.current?.(event.point.x, event.point.y)
      : event.features?.[0]?.properties?.index

    if (typeof index !== 'number') return

    // keeps the map from panning out from under the handle
    event.preventDefault()
    draggingRef.current = true
    swallowClickRef.current = true
    setDragging(true)
    onHandleDragStart?.(index)
  }

  function handleMouseMove(event: MapMouseEvent) {
    if (draggingRef.current) {
      onHandleDrag?.({ lng: event.lngLat.lng, lat: event.lngLat.lat })
      return
    }

    // deck owns hit testing for the select tool, so mapbox never fires enter or
    // leave for its waypoints and hovering has to be sampled as the pointer moves
    if (!overlay?.dragsPlanWaypoints) {
      setHoveringWaypoint(false)
      return
    }
    setHoveringWaypoint(typeof pickWaypoint.current?.(event.point.x, event.point.y) === 'number')
  }

  function handleMouseUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    onHandleDragEnd?.()
  }

  // terrain needs its dem source to exist first, and swapping the style throws
  // both away. style.load covers every swap after this one. deliberately not
  // styledata, which fires on each style edit and would re-trigger itself
  function handleMapLoad(event: { target: MapboxMap }) {
    const map = event.target
    applyTerrain(map)
    map.on('style.load', () => applyTerrain(map))
  }

  function handleAddressSelect(lng: number, lat: number) {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 })
  }

  return (
    <div className="map-container">
      <AddressSearch mapboxToken={MAPBOX_TOKEN} onSelect={handleAddressSelect} />
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: first?.lng ?? -122.4194,
          latitude: first?.lat ?? 37.7749,
          zoom: first ? 15 : 10,
          pitch: DEFAULT_PITCH,
        }}
        mapStyle={MAP_STYLES[styleId].url}
        onLoad={handleMapLoad}
        cursor={
          // a plain pointer over a waypoint reads as "click me", where an open
          // hand only says "draggable" and is easy to miss
          dragging
            ? 'grabbing'
            : hoveringWaypoint
              ? 'pointer'
              : hoveringHandle
                ? 'grab'
                : undefined
        }
        interactiveLayerIds={overlay?.draggable ? ['overlay-corners'] : undefined}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => setHoveringHandle(true)}
        onMouseLeave={() => setHoveringHandle(false)}
        onMove={positionInfobox}
        onIdle={positionInfobox}
      >
        {overlay && (overlay.markers.length > 0 || overlay.ghost) && (
          <Source id="tool-overlay" type="geojson" data={toOverlayCollection(overlay)}>
            <Layer
              id="overlay-fill"
              type="fill"
              filter={['==', ['geometry-type'], 'Polygon']}
              paint={{ 'fill-color': GHOST, 'fill-opacity': 0.2 }}
            />
            <Layer
              id="overlay-outline"
              type="line"
              filter={['==', ['geometry-type'], 'Polygon']}
              paint={{ 'line-color': GHOST, 'line-width': 2.5, 'line-dasharray': [3, 2] }}
            />
            <Layer
              id="overlay-corners"
              type="circle"
              filter={['==', ['geometry-type'], 'Point']}
              paint={{
                'circle-color': GHOST,
                'circle-opacity': 0.45,
                'circle-radius': ['case', ['get', 'selected'], 9, 6],
                'circle-stroke-color': ['case', ['get', 'selected'], SELECTED, GHOST],
                'circle-stroke-width': 2.5,
              }}
            />
          </Source>
        )}
        <ScaleControl position="bottom-left" unit="metric" />
        <FlightOverlay
          waypoints={waypoints}
          selected={overlay?.dragsPlanWaypoints ? overlay.selected : undefined}
          pickable={overlay?.dragsPlanWaypoints ?? false}
          onPickerReady={handlePickerReady}
        />
      </Map>
      {infoboxAt && (
        <div
          className="map-infobox"
          style={{ left: infoboxPoint?.x ?? 0, top: infoboxPoint?.y ?? 0 }}
        >
          {infobox}
        </div>
      )}
      <MapStyleControl value={styleId} onChange={setStyleId} />
    </div>
  )
}
