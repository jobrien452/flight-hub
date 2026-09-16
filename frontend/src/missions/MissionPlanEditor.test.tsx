import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureMission, fixtureUsers } from '../mocks/handlers'
import type { Mission } from '../types/mission'
import { MissionPlanEditor } from './MissionPlanEditor'

vi.mock('../map/MapView', () => ({
  MapView: ({
    onMapClick,
    overlay,
  }: {
    onMapClick: (p: { lng: number; lat: number }) => void
    overlay?: { markers: unknown[]; ghost?: unknown[] }
  }) => (
    <div>
      <button onClick={() => onMapClick({ lng: 10, lat: 20 })}>click A</button>
      <button onClick={() => onMapClick({ lng: 10.002, lat: 20 })}>click B</button>
      <button onClick={() => onMapClick({ lng: 10.002, lat: 20.001 })}>click C</button>
      <button onClick={() => onMapClick({ lng: 10, lat: 20.001 })}>click D</button>
      <span data-testid="overlay">
        {overlay?.markers.length ?? 0} markers{overlay?.ghost ? ' and a ghost' : ''}
      </span>
    </div>
  ),
}))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }),
  )
})

function renderEditor(onSubmit = vi.fn(), mission?: Mission) {
  render(
    <MemoryRouter>
      <AuthProvider>
        <MissionPlanEditor
          mission={mission}
          submitting={false}
          error={null}
          submitLabel="Create"
          onSubmit={onSubmit}
        />
      </AuthProvider>
    </MemoryRouter>,
  )
  return onSubmit
}

const pilot = fixtureUsers.find((u) => u.role === 'pilot')!

describe('MissionPlanEditor', () => {
  it('shows pilots to assign when editing an existing mission', async () => {
    renderEditor(vi.fn(), fixtureMission)
    expect(await screen.findByText(pilot.name)).toBeInTheDocument()
  })

  it('hides pilot assignment when creating a new mission', async () => {
    renderEditor()
    await userEvent.click(screen.getByText('click A'))
    expect(screen.queryByText('Pilots')).not.toBeInTheDocument()
    expect(screen.queryByText(pilot.name)).not.toBeInTheDocument()
  })

  it('shows New Mission as the name placeholder', () => {
    renderEditor()
    expect(screen.getByPlaceholderText('New Mission')).toBeInTheDocument()
  })

  it('adds a waypoint when the map is clicked with the waypoint tool active', async () => {
    renderEditor()
    await userEvent.click(screen.getByText('click A'))
    expect(await screen.findByText('1 waypoints')).toBeInTheDocument()
  })

  it('places a snapped box from 4 corner clicks without generating the sweep yet', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByText('click B'))
    await userEvent.click(screen.getByText('click C'))
    await userEvent.click(screen.getByText('click D'))

    expect(await screen.findByText('box placed, click Generate Survey')).toBeInTheDocument()
  })

  it('draws each corner on the map as it is clicked', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByText('click B'))

    expect(screen.getByTestId('overlay')).toHaveTextContent('2 markers')
    expect(screen.getByTestId('overlay')).not.toHaveTextContent('ghost')
  })

  it('draws the snapped box as a ghost once the fourth corner lands', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByText('click B'))
    await userEvent.click(screen.getByText('click C'))
    await userEvent.click(screen.getByText('click D'))

    expect(screen.getByTestId('overlay')).toHaveTextContent('4 markers and a ghost')
  })

  it('clears the overlay when switching back to the waypoint tool', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByRole('button', { name: 'Waypoint' }))

    expect(screen.getByTestId('overlay')).toHaveTextContent('0 markers')
  })

  it('generates the survey waypoints when Generate Survey is clicked', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByText('click B'))
    await userEvent.click(screen.getByText('click C'))
    await userEvent.click(screen.getByText('click D'))
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))

    await waitFor(() => {
      expect(screen.getByText(/waypoints$/).textContent).toMatch(/^\d+ waypoints$/)
    })
  })

  it('submits the current name and waypoints when creating a mission', async () => {
    const onSubmit = renderEditor()
    await userEvent.type(screen.getByLabelText('Name'), 'Test Mission')
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Mission',
        assignedPilotIds: [],
        waypoints: [{ lat: 20, lng: 10, alt: 50 }],
      }),
    )
  })

  it('preserves assigned pilots by default when editing a mission', async () => {
    const onSubmit = renderEditor(vi.fn(), fixtureMission)
    await screen.findByText(pilot.name)
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedPilotIds: fixtureMission.assigned_pilot_ids,
      }),
    )
  })
})
