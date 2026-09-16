import { useMemo } from 'react'
import { formatDistance, formatDuration, summarisePlan } from '../planning/missionStats'
import type { Waypoint } from '../types/mission'
import './PlanSummary.css'

interface PlanSummaryProps {
  waypoints: Waypoint[]
}

// the at-a-glance numbers for a plan, shown on both the mission view and the plan page
export function PlanSummary({ waypoints }: PlanSummaryProps) {
  const stats = useMemo(() => summarisePlan(waypoints), [waypoints])

  return (
    <div className="plan-summary">
      <div>
        <span className="text-dim">Waypoints</span>
        <strong className="mono">{stats.waypointCount}</strong>
      </div>
      <div>
        <span className="text-dim">Distance</span>
        <strong className="mono">{formatDistance(stats.distanceMeters)}</strong>
      </div>
      <div>
        <span className="text-dim">Est. flight time</span>
        <strong className="mono">{formatDuration(stats.durationSeconds)}</strong>
      </div>
      <div>
        <span className="text-dim">Altitude</span>
        <strong className="mono">
          {stats.minAltitude === stats.maxAltitude
            ? `${stats.maxAltitude} m`
            : `${stats.minAltitude}-${stats.maxAltitude} m`}
        </strong>
      </div>
    </div>
  )
}
