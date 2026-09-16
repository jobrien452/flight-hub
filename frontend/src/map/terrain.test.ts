import { describe, expect, it, vi } from 'vitest'
import {
  applyTerrain,
  HILLSHADE_LAYER,
  SKY_LAYER,
  TERRAIN_SOURCE,
  type TerrainCapableMap,
} from './terrain'

function fakeMap(existing: string[] = []) {
  const present = new Set(existing)
  const addSource = vi.fn((id: string) => {
    present.add(id)
  })
  const addLayer = vi.fn((layer: { id: string }) => {
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

  it('shades the hills so the relief is actually visible', () => {
    const { map, addLayer } = fakeMap()

    applyTerrain(map)

    expect(addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: HILLSHADE_LAYER, type: 'hillshade', source: TERRAIN_SOURCE }),
    )
  })

  it('adds a sky so the tilted view has a horizon', () => {
    const { map, addLayer } = fakeMap()

    applyTerrain(map)

    expect(addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: SKY_LAYER, type: 'sky' }))
  })

  it('adds nothing twice when it runs again on the same style', () => {
    const { map, addSource, addLayer } = fakeMap()

    applyTerrain(map)
    applyTerrain(map)

    expect(addSource).toHaveBeenCalledTimes(1)
    expect(addLayer).toHaveBeenCalledTimes(2)
  })

  it('rebuilds everything after a style swap has wiped it', () => {
    const { map: first, addSource: firstAdd } = fakeMap()
    applyTerrain(first)
    expect(firstAdd).toHaveBeenCalledTimes(1)

    // a style swap leaves a map with none of it, which is what style.load hands back
    const { map: swapped, addSource: swappedAdd, addLayer: swappedLayers } = fakeMap()
    applyTerrain(swapped)

    expect(swappedAdd).toHaveBeenCalledTimes(1)
    expect(swappedLayers).toHaveBeenCalledTimes(2)
  })

  it('takes an exaggeration', () => {
    const { map, setTerrain } = fakeMap()

    applyTerrain(map, 2)

    expect(setTerrain).toHaveBeenCalledWith({ source: TERRAIN_SOURCE, exaggeration: 2 })
  })
})
