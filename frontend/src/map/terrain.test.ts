import { describe, expect, it, vi } from 'vitest'
import { applyTerrain, TERRAIN_SOURCE, type TerrainCapableMap } from './terrain'

function fakeMap(existingSources: string[] = []) {
  const sources = new Set(existingSources)
  const addSource = vi.fn((id: string) => {
    sources.add(id)
  })
  const setTerrain = vi.fn()
  const map: TerrainCapableMap = {
    getSource: (id: string) => (sources.has(id) ? {} : undefined),
    addSource,
    setTerrain,
  }
  return { map, addSource, setTerrain }
}

describe('applyTerrain', () => {
  it('adds the dem source before turning terrain on', () => {
    const { map, addSource, setTerrain } = fakeMap()

    applyTerrain(map)

    expect(addSource).toHaveBeenCalledWith(
      TERRAIN_SOURCE,
      expect.objectContaining({ type: 'raster-dem' }),
    )
    expect(setTerrain).toHaveBeenCalledWith({ source: TERRAIN_SOURCE, exaggeration: 1 })
  })

  it('does not add the source twice', () => {
    const { map, addSource, setTerrain } = fakeMap([TERRAIN_SOURCE])

    applyTerrain(map)

    expect(addSource).not.toHaveBeenCalled()
    expect(setTerrain).toHaveBeenCalled()
  })

  it('re-applies cleanly after a style swap has wiped everything', () => {
    const { map, addSource, setTerrain } = fakeMap()

    applyTerrain(map)
    applyTerrain(map)

    expect(addSource).toHaveBeenCalledTimes(1)
    expect(setTerrain).toHaveBeenCalledTimes(2)
  })

  it('takes an exaggeration', () => {
    const { map, setTerrain } = fakeMap()

    applyTerrain(map, 1.5)

    expect(setTerrain).toHaveBeenCalledWith({ source: TERRAIN_SOURCE, exaggeration: 1.5 })
  })
})
