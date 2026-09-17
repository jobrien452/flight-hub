import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteMission, listMissions, publishMission } from '../api/missions'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { MissionSummary } from '../types/mission'
import './MissionsPage.css'

type PendingAction = { mission: MissionSummary; kind: 'edit' | 'delete' | 'published' }

function RowMenu({
  mission,
  onEdit,
  onPublish,
  onDelete,
}: {
  mission: MissionSummary
  onEdit: () => void
  onPublish: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onClickAway(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickAway)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onClickAway)
    }
  }, [open])

  return (
    <div className="row-menu" ref={wrapper}>
      <button
        type="button"
        className="row-menu-glyph"
        aria-label="Mission actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        &#8942;
      </button>
      {open && (
        <div className="row-menu-items" role="menu">
          <Link role="menuitem" to={`/missions/${mission.id}`}>
            View
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
          >
            Edit
          </button>
          {mission.status === 'draft' && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onPublish()
              }}
            >
              Publish
            </button>
          )}
          {/* there is nothing to plan against until the mission is published */}
          {mission.status !== 'draft' && (
            <Link role="menuitem" to={`/missions/${mission.id}/plan`}>
              Plan
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className="row-menu-danger"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export function MissionsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [missions, setMissions] = useState<MissionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    listMissions(session.token)
      .then(setMissions)
      .catch(() => setError('Could not load missions'))
  }, [session])

  async function handleDelete(mission: MissionSummary) {
    if (!session) return
    setWorking(true)
    setActionError(null)
    try {
      await deleteMission(mission.id, session.token)
      setMissions((current) => (current ?? []).filter((m) => m.id !== mission.id))
      setPending(null)
    } catch {
      setActionError('Could not delete this mission')
    } finally {
      setWorking(false)
    }
  }

  function startAction(mission: MissionSummary, kind: PendingAction['kind']) {
    setActionError(null)
    setPending({ mission, kind })
  }

  async function handlePublish(mission: MissionSummary) {
    if (!session) return
    setActionError(null)
    try {
      const published = await publishMission(mission.id, session.token)
      setMissions((current) => (current ?? []).map((m) => (m.id === mission.id ? published : m)))
      setPending({ mission: published, kind: 'published' })
    } catch {
      setError('Could not publish this mission')
    }
  }

  if (!session) return null

  const assigned = pending ? pending.mission.assigned_pilot_ids.length > 0 : false

  return (
    <div>
      <div className="page-header">
        <h1>Missions</h1>
        {session.role === 'admin' && (
          <Link className="button" to="/missions/new">
            New Mission
          </Link>
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}
      {!error && missions === null && <p className="text-dim">Loading...</p>}
      {missions !== null && missions.length === 0 && (
        <p className="text-dim">No missions yet.</p>
      )}
      {missions !== null && missions.length > 0 && (
        <table className="mission-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Pilots</th>
              <th>Waypoints</th>
              <th>Updated</th>
              {session.role === 'admin' && <th />}
            </tr>
          </thead>
          <tbody>
            {missions.map((mission) => (
              <tr key={mission.id}>
                <td>
                  <Link to={`/missions/${mission.id}`}>{mission.name}</Link>
                </td>
                <td className="mono">{mission.status}</td>
                <td>{mission.assigned_pilot_ids.length}</td>
                <td className="mono">{mission.waypoint_count}</td>
                <td className="mono">{new Date(mission.updated_at).toLocaleDateString()}</td>
                {session.role === 'admin' && (
                  <td className="row-action">
                    <RowMenu
                      mission={mission}
                      onEdit={() => startAction(mission, 'edit')}
                      onPublish={() => handlePublish(mission)}
                      onDelete={() => startAction(mission, 'delete')}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pending?.kind === 'edit' && (
        <ConfirmDialog
          title="Edit this mission?"
          body={
            assigned
              ? 'This mission has already been assigned. Changing the plan now affects pilots who are working from it.'
              : 'You are about to change this mission plan.'
          }
          confirmLabel="Edit anyway"
          onConfirm={() => navigate(`/missions/${pending.mission.id}?edit=1`)}
          onCancel={() => setPending(null)}
        />
      )}

      {pending?.kind === 'published' && (
        <ConfirmDialog
          title="Mission published"
          body="Ready to assign pilots to it now?"
          confirmLabel="Assign pilots"
          onConfirm={() => navigate(`/missions/${pending.mission.id}/plan`)}
          onCancel={() => setPending(null)}
        />
      )}

      {pending?.kind === 'delete' && assigned && (
        <ConfirmDialog
          title="Cannot delete this mission"
          body={
            <>
              Unassign every pilot before deleting it.{' '}
              <Link to={`/missions/${pending.mission.id}/plan`}>Manage pilots</Link>
            </>
          }
          confirmLabel="Close"
          onConfirm={() => setPending(null)}
          onCancel={() => setPending(null)}
        />
      )}

      {pending?.kind === 'delete' && !assigned && (
        <ConfirmDialog
          title={`Delete ${pending.mission.name}?`}
          body="This cannot be undone."
          confirmLabel="Delete"
          danger
          busy={working}
          error={actionError}
          onConfirm={() => handleDelete(pending.mission)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
