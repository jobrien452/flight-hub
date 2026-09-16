import { describe, expect, it, vi } from 'vitest'
import {
  applyTerrain,
  HILLSHADE_LAYER,
  HILLSHADE_SOURCE,
  SKY_LAYER,
  TERRAIN_SOURCE,
  type TerrainCapableMap,
} from './terrain'

function fakeMap(existing: string[] = []) {
  const present = new Set(existing)
  const addSource = vi.fn((id: string) => {
    present.add(id)
  })
  const addLayer = vi.fn((layer: { id: string; paint: Record<string, unknown> }) => {
    present.add(layer.id)
  })
  const setTerrain = vi.fn()
  // mapbox's own signatures are far wider than what applyTerrain touches
  const map = {
    getSource: (id: string) => (present.has(id) ? {} : undefined),
    addSource,
    getLayer: (id: string) => (present.has(id) ? {} : undefined),
    addLayer,
    setTerrain,
  } as unknown as TerrainCapableMap
  return { map, addSource, addLayer, setTerrain }
}

describe('applyTerrain', () => {
  it('adds the dem source before turning terrain on', () => {
    const { map, addSource, setTerrain } = fakeMap()

    applyTerrain(map)

    expect(addSource).toHaveBeenCalledWith(
      TERRAIN_SOURCE,
      expect.objectContaining({ type: 'raster-dem' }),
    )
    expect(setTerrain).toHaveBeenCalledWith({ source: TERRAIN_SOURCE, exaggeration: 1.5 })
  })

  it('gives the hillshade its own dem source, sharing one halves its resolution', () => {
    const { map, addSource, addLayer } = fakeMap()

    applyTerrain(map)

    expect(addSource).toHaveBeenCalledWith(
      HILLSHADE_SOURCE,
      expect.objectContaining({ type: 'raster-dem' }),
    )
    expect(addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: HILLSHADE_LAYER, type: 'hillshade', source: HILLSHADE_SOURCE }),
    )
  })

  it('adds a gradient sky, which needs no sun from the style light', () => {
    const { map, addLayer } = fakeMap()

    applyTerrain(map)

    const sky = addLayer.mock.calls.map(([layer]) => layer).find((l) => l.id === SKY_LAYER)
    expect(sky).toMatchObject({ type: 'sky' })
    expect(sky?.paint['sky-type']).toBe('gradient')
  })

  it('adds nothing twice when it runs again on the same style', () => {
    const { map, addSource, addLayer } = fakeMap()

    applyTerrain(map)
    applyTerrain(map)

    expect(addSource).toHaveBeenCalledTimes(2)
    expect(addLayer).toHaveBeenCalledTimes(2)
  })

  it('rebuilds everything after a style swap has wiped it', () => {
    const { map: first, addSource: firstAdd } = fakeMap()
    applyTerrain(first)
    expect(firstAdd).toHaveBeenCalledTimes(2)

    // a style swap leaves a map with none of it, which is what style.load hands back
    const { map: swapped, addSource: swappedAdd, addLayer: swappedLayers } = fakeMap()
    applyTerrain(swapped)

    expect(swappedAdd).toHaveBeenCalledTimes(2)
    expect(swappedLayers).toHaveBeenCalledTimes(2)
  })

  it('takes an exaggeration', () => {
    const { map, setTerrain } = fakeMap()

    applyTerrain(map, 2)

    expect(setTerrain).toHaveBeenCalledWith({ source: TERRAIN_SOURCE, exaggeration: 2 })
  })
})
