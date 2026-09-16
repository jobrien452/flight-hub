import type { Map as MapboxMap } from 'mapbox-gl'

export const TERRAIN_SOURCE = 'terrain-dem'
// sharing one dem source between terrain and hillshade halves the hillshade
// resolution, so the shading gets its own copy at the cost of some memory
export const HILLSHADE_SOURCE = 'hillshade-dem'
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
  for (const id of [TERRAIN_SOURCE, HILLSHADE_SOURCE]) {
    if (map.getSource(id)) continue
    map.addSource(id, {
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
      source: HILLSHADE_SOURCE,
      paint: {
        'hillshade-exaggeration': 0.6,
        'hillshade-shadow-color': '#0b0e13',
        'hillshade-highlight-color': '#9aa6b8',
      },
    })
  }

  // a horizon to read height against. gradient rather than atmosphere, which
  // derives its sun from the style light and warns when that is viewport anchored
  if (!map.getLayer(SKY_LAYER)) {
    map.addLayer({
      id: SKY_LAYER,
      type: 'sky',
      paint: {
        'sky-type': 'gradient',
        'sky-gradient': [
          'interpolate',
          ['linear'],
          ['sky-radial-progress'],
          0.8,
          '#6b8cae',
          1,
          '#0b0e13',
        ],
        'sky-opacity': 0.9,
      },
    })
  }

  map.setTerrain({ source: TERRAIN_SOURCE, exaggeration })
}
