import { MAP_STYLES, type MapStyleId } from './mapStyles'
import './MapStyleControl.css'

interface MapStyleControlProps {
  value: MapStyleId
  onChange: (id: MapStyleId) => void
}

// sits bottom right of every map, see MapView
export function MapStyleControl({ value, onChange }: MapStyleControlProps) {
  const ids = Object.keys(MAP_STYLES) as MapStyleId[]

  return (
    <div className="map-style-control" role="group" aria-label="Map style">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          className={id === value ? 'active' : ''}
          aria-pressed={id === value}
          onClick={() => onChange(id)}
        >
          {MAP_STYLES[id].label}
        </button>
      ))}
    </div>
  )
}
