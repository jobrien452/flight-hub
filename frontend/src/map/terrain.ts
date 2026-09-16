import type { Map as MapboxMap } from 'mapbox-gl'

export const TERRAIN_SOURCE = 'terrain-dem'
export const HILLSHADE_LAYER = 'terrain-hillshade'
export const SKY_LAYER = 'terrain-sky'

const TERRAIN_DEM_URL = 'mapbox://mapbox.mapbox-terrain-dem-v1'
// 1 is true to life, which reads as almost flat at planning zooms
const DEFAULT_EXAGGERATION = 1.5

// the slice of the mapbox api this needs, so tests can hand it a fake map
export type TerrainCapableMap = Pick<
  MapboxMap,
  'getSource' | 'addSource' | 'getLayer' | 'addLayer' | 'setTerrain'
>

// terrain displaces the ground but paints no shadows, so on a flat style the
// hills are invisible until a hillshade gives them relief
export function applyTerrain(map: TerrainCapableMap, exaggeration = DEFAULT_EXAGGERATION): void {
  if (!map.getSource(TERRAIN_SOURCE)) {
    map.addSource(TERRAIN_SOURCE, {
      type: 'raster-dem',
      url: TERRAIN_DEM_URL,
      tileSize: 512,
      maxzoom: 14,
    })
  }

  if (!map.getLayer(HILLSHADE_LAYER)) {
    map.addLayer({
      id: HILLSHADE_LAYER,
      type: 'hillshade',
      source: TERRAIN_SOURCE,
      paint: {
        'hillshade-exaggeration': 0.6,
        'hillshade-shadow-color': '#0b0e13',
        'hillshade-highlight-color': '#9aa6b8',
      },
    })
  }

  // gives the tilted view a horizon to read height against
  if (!map.getLayer(SKY_LAYER)) {
    map.addLayer({
      id: SKY_LAYER,
      type: 'sky',
      paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun-intensity': 5 },
    })
  }

  map.setTerrain({ source: TERRAIN_SOURCE, exaggeration })
}
