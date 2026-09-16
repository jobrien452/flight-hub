import { useState } from 'react'

export type MapStyleId = 'dark' | 'satellite'

export const MAP_STYLES: Record<MapStyleId, { label: string; url: string }> = {
  dark: { label: 'Map', url: 'mapbox://styles/mapbox/dark-v11' },
  satellite: { label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
}

const STORAGE_KEY = 'flyby.mapStyle'

// satellite by default, imagery shows the lie of the land far better than the
// flat dark style does
const DEFAULT_STYLE: MapStyleId = 'satellite'

export function readStoredStyle(): MapStyleId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'satellite' || stored === 'dark' ? stored : DEFAULT_STYLE
  } catch {
    // private windows and blocked site data both throw here
    return DEFAULT_STYLE
  }
}

// remembered per browser so the choice sticks as you move between missions
export function useMapStyle(): [MapStyleId, (id: MapStyleId) => void] {
  const [styleId, setStyleId] = useState<MapStyleId>(readStoredStyle)

  function choose(id: MapStyleId) {
    setStyleId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // not worth surfacing, the choice just won't outlive the session
    }
  }

  return [styleId, choose]
}
