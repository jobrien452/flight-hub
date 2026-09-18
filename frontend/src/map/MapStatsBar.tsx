import './MapStatsBar.css'

export interface MapStat {
  label: string
  value: string
}

// the strip along the bottom of the map, the numbers that describe the plan
// being drawn over it
export function MapStatsBar({ stats }: { stats: MapStat[] }) {
  if (stats.length === 0) return null

  return (
    <div className="map-stats-bar">
      {stats.map((stat) => (
        <div key={stat.label} className="map-stat">
          <span className="map-stat-label">{stat.label}</span>
          <strong className="mono">{stat.value}</strong>
        </div>
      ))}
    </div>
  )
}
