import { useEffect, useState } from 'react'
import { getDrone } from '../api/drones'
import { useAuth } from '../auth/useAuth'
import { findAircraft } from '../fleet/aircraft'
import { statusLabel } from '../format/status'
import { summarisePlan } from '../planning/missionStats'
import { footprintWidthM, gsdCmPerPixel } from '../planning/payloads'
import type { Drone } from '../types/drone'
import type { Mission } from '../types/mission'
import './MissionAircraft.css'

interface MissionAircraftProps {
  mission: Mission
}

// what this mission is flying with, the aircraft is fetched but the payload
// rides on the mission itself so it still reads right if the catalogue changes
// one piece of state rather than two, so a lookup that failed once cannot stick
// around and claim the next aircraft is missing too
type Lookup = { state: 'loading' } | { state: 'ready'; drone: Drone } | { state: 'missing' }

export function MissionAircraft({ mission }: MissionAircraftProps) {
  const { session } = useAuth()
  const [lookup, setLookup] = useState<Lookup>({ state: 'loading' })

  useEffect(() => {
    if (!session || !mission.drone_id) return
    let cancelled = false

    getDrone(mission.drone_id, session.token)
      .then((found) => {
        if (!cancelled) setLookup({ state: 'ready', drone: found })
      })
      .catch(() => {
        if (!cancelled) setLookup({ state: 'missing' })
      })

    return () => {
      cancelled = true
    }
  }, [session, mission.drone_id])

  const drone = lookup.state === 'ready' ? lookup.drone : null
  const { payload } = mission
  // only for the aircraft flyby publish figures for, anything else is left alone
  const specs = drone ? findAircraft(drone.model) : undefined
  // the height the route actually flies, which is what the optics depend on
  const altitude = summarisePlan(mission.waypoints).maxAltitude

  return (
    <section className="mission-aircraft">
      <h2>Aircraft</h2>
      <div className="mission-aircraft-cards">
        <div className="mission-aircraft-card">
          {!mission.drone_id && <p className="text-dim">No aircraft booked</p>}
          {mission.drone_id && lookup.state === 'missing' && (
            <p className="text-dim">Aircraft unavailable</p>
          )}
          {mission.drone_id && lookup.state === 'loading' && (
            <p className="text-dim">Loading...</p>
          )}
          {drone && (
            <>
              <strong>{drone.name}</strong>
              <dl>
                <dt>Model</dt>
                <dd>{drone.model}</dd>
                <dt>Serial</dt>
                <dd className="mono">{drone.serial}</dd>
                <dt>Status</dt>
                <dd>{statusLabel(drone.status)}</dd>
                <dt>Airframe hours</dt>
                <dd className="mono">{drone.flight_hours} h</dd>
                <dt>Missions flown</dt>
                <dd className="mono">{drone.missions_flown}</dd>
                {drone.stream_url && (
                  <>
                    <dt>Video</dt>
                    <dd className="mono">{drone.stream_url}</dd>
                  </>
                )}
                {specs && (
                  <>
                    <dt>Max flight time</dt>
                    <dd className="mono">{specs.maxFlightTimeMin} min</dd>
                    <dt>Max speed</dt>
                    <dd className="mono">{specs.maxSpeedKph} km/h</dd>
                    <dt>Payload capacity</dt>
                    <dd className="mono">{specs.payloadCapacityLbs} lbs</dd>
                    <dt>Compute</dt>
                    <dd>{specs.processor}</dd>
                    <dt>Position</dt>
                    <dd>{specs.positionAccuracy}</dd>
                  </>
                )}
              </dl>
            </>
          )}
        </div>

        <div className="mission-aircraft-card">
          {payload ? (
            <>
              <strong>{payload.name}</strong>
              <dl>
                <dt>Camera</dt>
                <dd>{payload.camera}</dd>
                <dt>Lens</dt>
                <dd>{payload.lens}</dd>
                <dt>Gimbal</dt>
                <dd>{payload.gimbal}</dd>
                <dt>Sensor</dt>
                <dd className="mono">
                  {payload.image_width_px} x {payload.image_height_px} px
                </dd>
                <dt>Ortho GSD at {altitude} m</dt>
                <dd className="mono">{gsdCmPerPixel(payload, altitude).toFixed(2)} cm/px</dd>
                <dt>Frame width</dt>
                <dd className="mono">{footprintWidthM(payload, altitude).toFixed(0)} m</dd>
              </dl>
            </>
          ) : (
            <p className="text-dim">No payload</p>
          )}
        </div>
      </div>
    </section>
  )
}
