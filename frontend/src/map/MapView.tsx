import { useRef, useState, type ReactNode } from 'react'
import Map, { Layer, Popup, Source } from 'react-map-gl/mapbox'
import type { MapMouseEvent, MapRef } from 'react-map-gl/mapbox'
import { AddressSearch } from './AddressSearch'
import type { LngLat, ToolOverlay } from '../tools/MapTool'
import type { Waypoint } from '../types/mission'
import 'mapbox-gl/dist/mapbox-gl.css'
import './MapView.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
const ACCENT = '#5b8def'
const GHOST = '#e0b341'
const SELECTED = '#f2f5fa'

function toFeatureCollection(waypoints: Waypoint[]): GeoJSON.FeatureCollection {
  const points: GeoJSON.Feature[] = waypoints.map((w) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
  }))

  const line: GeoJSON.Feature[] =
    waypoints.length >= 2
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: waypoints.map((w) => [w.lng, w.lat]),
            },
          },
        ]
      : []

  return { type: 'FeatureCollection', features: [...points, ...line] }
}

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
  const [dragging, setDragging] = useState(false)

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
    const index = event.features?.[0]?.properties?.index
    if (typeof index !== 'number') return

    // keeps the map from panning out from under the handle
    event.preventDefault()
    draggingRef.current = true
    swallowClickRef.current = true
    setDragging(true)
    onHandleDragStart?.(index)
  }

  function handleMouseMove(event: MapMouseEvent) {
    if (!draggingRef.current) return
    onHandleDrag?.({ lng: event.lngLat.lng, lat: event.lngLat.lat })
  }

  function handleMouseUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    onHandleDragEnd?.()
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
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        cursor={dragging ? 'grabbing' : hoveringHandle ? 'grab' : undefined}
        interactiveLayerIds={overlay?.draggable ? ['overlay-corners'] : undefined}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => setHoveringHandle(true)}
        onMouseLeave={() => setHoveringHandle(false)}
      >
        {overlay && (overlay.markers.length > 0 || overlay.ghost) && (
          <Source id="tool-overlay" type="geojson" data={toOverlayCollection(overlay)}>
            <Layer
              id="overlay-fill"
              type="fill"
              filter={['==', ['geometry-type'], 'Polygon']}
              paint={{ 'fill-color': GHOST, 'fill-opacity': 0.12 }}
            />
            <Layer
              id="overlay-outline"
              type="line"
              filter={['==', ['geometry-type'], 'Polygon']}
              paint={{ 'line-color': GHOST, 'line-width': 1.5, 'line-dasharray': [3, 2] }}
            />
            <Layer
              id="overlay-corners"
              type="circle"
              filter={['==', ['geometry-type'], 'Point']}
              paint={{
                'circle-color': GHOST,
                'circle-opacity': 0.25,
                'circle-radius': ['case', ['get', 'selected'], 9, 6],
                'circle-stroke-color': ['case', ['get', 'selected'], SELECTED, GHOST],
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}
        {infoboxAt && (
          <Popup
            longitude={infoboxAt.lng}
            latitude={infoboxAt.lat}
            anchor="bottom"
            offset={14}
            closeButton={false}
            closeOnClick={false}
          >
            {infobox}
          </Popup>
        )}
        <Source id="flight-plan" type="geojson" data={toFeatureCollection(waypoints)}>
          <Layer
            id="flight-path"
            type="line"
            filter={['==', ['geometry-type'], 'LineString']}
            paint={{ 'line-color': ACCENT, 'line-width': 2 }}
          />
          <Layer
            id="flight-waypoints"
            type="circle"
            filter={['==', ['geometry-type'], 'Point']}
            paint={{ 'circle-color': ACCENT, 'circle-radius': 5 }}
          />
        </Source>
      </Map>
    </div>
  )
}
