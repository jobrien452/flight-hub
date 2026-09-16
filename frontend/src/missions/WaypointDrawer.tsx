import type { Waypoint } from '../types/mission'
import './WaypointDrawer.css'

interface WaypointDrawerProps {
  waypoint: Waypoint
  index: number
  onChange: (changes: Partial<Waypoint>) => void
  onDelete: () => void
  onClose: () => void
}

// optional fields come back as '' when cleared, which should read as unset
function toNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value)
}

export function WaypointDrawer({
  waypoint,
  index,
  onChange,
  onDelete,
  onClose,
}: WaypointDrawerProps) {
  return (
    <aside className="waypoint-drawer" aria-label={`Waypoint ${index + 1} details`}>
      <div className="waypoint-drawer-header">
        <h2>Waypoint {index + 1}</h2>
        <button type="button" aria-label="Close waypoint details" onClick={onClose}>
          &times;
        </button>
      </div>

      <label>
        Latitude
        <input
          type="number"
          step="0.00001"
          value={waypoint.lat}
          onChange={(e) => onChange({ lat: Number(e.target.value) })}
        />
      </label>

      <label>
        Longitude
        <input
          type="number"
          step="0.00001"
          value={waypoint.lng}
          onChange={(e) => onChange({ lng: Number(e.target.value) })}
        />
      </label>

      <label>
        Altitude (m)
        <input
          type="number"
          value={waypoint.alt ?? 0}
          onChange={(e) => onChange({ alt: Number(e.target.value) })}
        />
      </label>

      <label>
        Heading (deg)
        <input
          type="number"
          placeholder="auto"
          value={waypoint.heading ?? ''}
          onChange={(e) => onChange({ heading: toNumber(e.target.value) })}
        />
      </label>

      <label>
        Speed (m/s)
        <input
          type="number"
          placeholder="default"
          value={waypoint.speed ?? ''}
          onChange={(e) => onChange({ speed: toNumber(e.target.value) })}
        />
      </label>

      <button type="button" className="waypoint-drawer-delete" onClick={onDelete}>
        Delete waypoint
      </button>
    </aside>
  )
}
