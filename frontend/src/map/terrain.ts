export const TERRAIN_SOURCE = 'terrain-dem'
const TERRAIN_DEM_URL = 'mapbox://mapbox.mapbox-terrain-dem-v1'

interface RasterDemSpec {
  type: 'raster-dem'
  url: string
  tileSize: number
  maxzoom: number
  // mapbox's own source spec carries one, needed for the types to line up
  [key: string]: unknown
}

// the slice of the mapbox api this needs, kept narrow so it can be faked in tests
export interface TerrainCapableMap {
  getSource(id: string): unknown
  addSource(id: string, source: RasterDemSpec): unknown
  setTerrain(terrain: { source: string; exaggeration: number }): unknown
}

// setTerrain only takes if the dem source already exists, and swapping the map
// style throws both away, so this has to be safe to run again on every style load
export function applyTerrain(map: TerrainCapableMap, exaggeration = 1): void {
  if (!map.getSource(TERRAIN_SOURCE)) {
    map.addSource(TERRAIN_SOURCE, {
      type: 'raster-dem',
      url: TERRAIN_DEM_URL,
      tileSize: 512,
      maxzoom: 14,
    })
  }
  map.setTerrain({ source: TERRAIN_SOURCE, exaggeration })
}
