import { useRef } from 'react'
import Map, { Layer, Source } from 'react-map-gl/mapbox'
import type { MapMouseEvent, MapRef } from 'react-map-gl/mapbox'
import { AddressSearch } from './AddressSearch'
import type { LngLat, ToolOverlay } from '../tools/MapTool'
import type { Waypoint } from '../types/mission'
import 'mapbox-gl/dist/mapbox-gl.css'
import './MapView.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
const ACCENT = '#5b8def'
const GHOST = '#e0b341'

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
  const markers: GeoJSON.Feature[] = overlay.markers.map((w) => ({
    type: 'Feature',
    properties: {},
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
}

export function MapView({ waypoints, onMapClick, overlay }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-missing-token">
        Set VITE_MAPBOX_TOKEN in frontend/.env to render the map.
      </div>
    )
  }

  const first = waypoints[0]

  function handleClick(event: MapMouseEvent) {
    onMapClick({ lng: event.lngLat.lng, lat: event.lngLat.lat })
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
        onClick={handleClick}
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
                'circle-color': 'transparent',
                'circle-radius': 5,
                'circle-stroke-color': GHOST,
                'circle-stroke-width': 2,
              }}
            />
          </Source>
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
