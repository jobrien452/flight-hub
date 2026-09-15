import Map, { Layer, Source } from 'react-map-gl/mapbox'
import type { MapMouseEvent } from 'react-map-gl/mapbox'
import type { LngLat } from '../tools/MapTool'
import type { Waypoint } from '../types/mission'
import 'mapbox-gl/dist/mapbox-gl.css'
import './MapView.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
const ACCENT = '#5b8def'

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

interface MapViewProps {
  waypoints: Waypoint[]
  onMapClick: (point: LngLat) => void
}

export function MapView({ waypoints, onMapClick }: MapViewProps) {
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

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        longitude: first?.lng ?? -122.4194,
        latitude: first?.lat ?? 37.7749,
        zoom: first ? 15 : 10,
      }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      onClick={handleClick}
    >
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
  )
}
