import { useState } from 'react'

export type MapStyleId = 'dark' | 'satellite'

export const MAP_STYLES: Record<MapStyleId, { label: string; url: string }> = {
  dark: { label: 'Map', url: 'mapbox://styles/mapbox/dark-v11' },
  satellite: { label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
}

const STORAGE_KEY = 'flyby.mapStyle'

export function readStoredStyle(): MapStyleId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'satellite' || stored === 'dark' ? stored : 'dark'
  } catch {
    // private windows and blocked site data both throw here
    return 'dark'
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
