import { useEffect, useState } from 'react'
import {
  createMissionReport,
  listMissionReports,
  updateMissionReport,
} from '../api/missionReports'
import { acknowledgeMission, getMission, startMission } from '../api/missions'
import { useAuth } from '../auth/useAuth'
import type { Mission } from '../types/mission'
import type { MissionReport, MissionReportStatus } from '../types/missionReport'
import './PilotMissionPanel.css'

interface PilotMissionPanelProps {
  mission: Mission
  onMissionChange: (mission: Mission) => void
}

// a blank field should stay out of the report rather than land in it as a zero
function toNumber(value: string): number | undefined {
  const parsed = Number(value)
  return value.trim() === '' || Number.isNaN(parsed) ? undefined : parsed
}

// report data is free form, so anything read back out of it has to be checked
function numberField(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'number' ? String(value) : ''
}

// everything a pilot can do with a mission they have been assigned
export function PilotMissionPanel({ mission, onMissionChange }: PilotMissionPanelProps) {
  const { session } = useAuth()
  const [report, setReport] = useState<MissionReport | null>(null)
  const [duration, setDuration] = useState('')
  const [photos, setPhotos] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false

    // the list route only ever returns this pilot's own report, at most one
    listMissionReports(mission.id, session.token)
      .then((reports) => {
        if (cancelled) return
        const mine = reports[0] ?? null
        setReport(mine)
        if (!mine) return
        setNotes(mine.notes)
        setDuration(numberField(mine.data, 'duration_minutes'))
        setPhotos(numberField(mine.data, 'photos'))
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your report')
      })

    return () => {
      cancelled = true
    }
  }, [session, mission.id])

  async function advance(move: (id: string, token: string) => Promise<Mission>) {
    if (!session) return
    setBusy(true)
    setError(null)
    try {
      onMissionChange(await move(mission.id, session.token))
    } catch {
      setError('Could not update this mission')
    } finally {
      setBusy(false)
    }
  }

  async function fileReport(status: MissionReportStatus) {
    if (!session) return
    setBusy(true)
    setError(null)
    const flightTime = toNumber(duration)
    const photoCount = toNumber(photos)
    const payload = {
      status,
      notes,
      data: {
        ...(flightTime === undefined ? {} : { duration_minutes: flightTime }),
        ...(photoCount === undefined ? {} : { photos: photoCount }),
      },
    }

    try {
      const saved = report
        ? await updateMissionReport(mission.id, report.id, payload, session.token)
        : await createMissionReport(mission.id, payload, session.token)
      setReport(saved)
      // the last outstanding report completes the mission, so read the status back
      if (status === 'submitted') {
        onMissionChange(await getMission(mission.id, session.token))
      }
    } catch {
      setError('Could not save your report')
    } finally {
      setBusy(false)
    }
  }

  const submitted = report?.status === 'submitted'
  const canAcknowledge = mission.status === 'published'
  const canStart = mission.status === 'published' || mission.status === 'acknowledged'
  const showReport =
    mission.status === 'in_flight' || mission.status === 'completed' || report !== null

  return (
    <section className="pilot-panel" aria-label="Your flight">
      <h2>Your flight</h2>
      {error && <p className="auth-error">{error}</p>}

      {mission.status === 'draft' && (
        <p className="text-dim">This mission has not been published yet.</p>
      )}

      {(canAcknowledge || canStart) && (
        <div className="pilot-panel-actions">
          {canAcknowledge && (
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => advance(acknowledgeMission)}
            >
              Acknowledge
            </button>
          )}
          {canStart && (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => advance(startMission)}
            >
              Start flight
            </button>
          )}
        </div>
      )}

      {showReport && submitted && report && (
        <div className="pilot-report-filed">
          <p className="text-dim">
            Report filed <span className="mono">{formatFiled(report.submitted_at)}</span>
          </p>
          <dl>
            <dt>Flight time</dt>
            <dd className="mono">{numberField(report.data, 'duration_minutes') || '-'} min</dd>
            <dt>Photos</dt>
            <dd className="mono">{numberField(report.data, 'photos') || '-'}</dd>
          </dl>
          {report.notes && <p className="pilot-report-notes">{report.notes}</p>}
        </div>
      )}

      {showReport && !submitted && (
        <div className="pilot-report-form">
          <div className="pilot-report-fields">
            <label>
              Flight time (minutes)
              <input
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
            <label>
              Photos captured
              <input
                type="number"
                min="0"
                value={photos}
                onChange={(e) => setPhotos(e.target.value)}
              />
            </label>
          </div>
          <label className="pilot-report-notes-field">
            Notes
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="pilot-panel-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => fileReport('in_progress')}
            >
              Save draft
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => fileReport('submitted')}
            >
              Submit report
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function formatFiled(submittedAt: string | null): string {
  return submittedAt ? new Date(submittedAt).toLocaleString() : ''
}
