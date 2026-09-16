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
    onHandleDragStart,
    onHandleDrag,
    onHandleDragEnd,
    infoboxAt,
    infobox,
  }: {
    onMapClick: (p: { lng: number; lat: number }) => void
    overlay?: { markers: unknown[]; ghost?: unknown[] }
    onHandleDragStart: (index: number) => void
    onHandleDrag: (p: { lng: number; lat: number }) => void
    onHandleDragEnd: () => void
    infoboxAt?: unknown
    infobox?: React.ReactNode
  }) => (
    <div>
      <button onClick={() => onMapClick({ lng: 10, lat: 20 })}>click A</button>
      <button onClick={() => onMapClick({ lng: 10.002, lat: 20 })}>click B</button>
      <button onClick={() => onMapClick({ lng: 10.002, lat: 20.001 })}>click C</button>
      <button onClick={() => onMapClick({ lng: 10, lat: 20.001 })}>click D</button>
      <button
        onClick={() => {
          onHandleDragStart(2)
          onHandleDrag({ lng: 10.004, lat: 20.002 })
          onHandleDragEnd()
        }}
      >
        drag corner
      </button>
      <button onClick={() => onHandleDragStart(0)}>grab first</button>
      <button onClick={() => onHandleDragStart(1)}>grab second</button>
      <button
        onClick={() => {
          onHandleDrag({ lng: 99, lat: 88 })
          onHandleDragEnd()
        }}
      >
        drag to 99/88
      </button>
      <span data-testid="overlay">
        {overlay?.markers.length ?? 0} markers{overlay?.ghost ? ' and a ghost' : ''}
      </span>
      <div data-testid="infobox">{infoboxAt ? infobox : null}</div>
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

function renderEditor(onSubmit = vi.fn(), mission?: Mission, onPublish?: () => void) {
  render(
    <MemoryRouter>
      <AuthProvider>
        <MissionPlanEditor
          mission={mission}
          submitting={false}
          error={null}
          submitLabel="Create"
          onSubmit={onSubmit}
          onPublish={onPublish}
        />
      </AuthProvider>
    </MemoryRouter>,
  )
  return onSubmit
}

async function placeBox() {
  await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))
  for (const corner of ['click A', 'click B', 'click C', 'click D']) {
    await userEvent.click(screen.getByText(corner))
  }
}

async function setAltitude(value: string) {
  const input = screen.getByLabelText('Altitude (m)')
  await userEvent.clear(input)
  await userEvent.type(input, value)
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
    await placeBox()

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
    await placeBox()

    expect(screen.getByTestId('overlay')).toHaveTextContent('4 markers and a ghost')
  })

  it('generates the survey waypoints when Generate Survey is clicked', async () => {
    renderEditor()
    await placeBox()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))

    await waitFor(() => {
      expect(screen.getByText(/waypoints$/).textContent).toMatch(/^\d+ waypoints$/)
    })
  })

  it('sends the survey back to be regenerated after the box is resized', async () => {
    renderEditor()
    await placeBox()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))
    await waitFor(() => expect(screen.getByText(/waypoints$/)).toBeInTheDocument())

    await userEvent.click(screen.getByText('drag corner'))

    expect(await screen.findByText('box placed, click Generate Survey')).toBeInTheDocument()
  })

  it('clears the overlay when switching back to the waypoint tool', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByRole('button', { name: 'Waypoint' }))

    expect(screen.getByTestId('overlay')).toHaveTextContent('0 markers')
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

describe('MissionPlanEditor waypoint altitude', () => {
  it('keeps waypoints already placed when the altitude changes', async () => {
    renderEditor()
    await userEvent.click(screen.getByText('click A'))
    await setAltitude('120')

    expect(screen.getByText('1 waypoints')).toBeInTheDocument()
  })

  it('gives each waypoint the altitude that was set when it was placed', async () => {
    const onSubmit = renderEditor()
    await userEvent.click(screen.getByText('click A'))
    await setAltitude('120')
    await userEvent.click(screen.getByText('click B'))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].waypoints).toEqual([
      { lat: 20, lng: 10, alt: 50 },
      { lat: 20, lng: 10.002, alt: 120 },
    ])
  })
})

describe('MissionPlanEditor select tool', () => {
  async function placeTwoAndSelect(which: 'grab first' | 'grab second') {
    await userEvent.click(screen.getByText('click A'))
    await setAltitude('120')
    await userEvent.click(screen.getByText('click B'))
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    await userEvent.click(screen.getByText(which))
  }

  it('shows an infobox for the waypoint that was picked', async () => {
    renderEditor()
    await placeTwoAndSelect('grab second')

    expect(screen.getByTestId('infobox')).toHaveTextContent('Waypoint 2')
  })

  it('shows no infobox until a waypoint is picked', async () => {
    renderEditor()
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(screen.getByTestId('infobox')).toBeEmptyDOMElement()
  })

  it('edits the altitude of only the selected waypoint', async () => {
    const onSubmit = renderEditor()
    await placeTwoAndSelect('grab first')

    const input = screen.getByLabelText('Waypoint altitude (m)')
    await userEvent.clear(input)
    await userEvent.type(input, '75')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].waypoints).toEqual([
      { lat: 20, lng: 10, alt: 75 },
      { lat: 20, lng: 10.002, alt: 120 },
    ])
  })

  it('moves the selected waypoint without losing its altitude', async () => {
    const onSubmit = renderEditor()
    await placeTwoAndSelect('grab second')
    await userEvent.click(screen.getByText('drag to 99/88'))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].waypoints).toEqual([
      { lat: 20, lng: 10, alt: 50 },
      { lat: 88, lng: 99, alt: 120 },
    ])
  })

  it('deletes only the selected waypoint', async () => {
    const onSubmit = renderEditor()
    await placeTwoAndSelect('grab first')
    await userEvent.click(screen.getByRole('button', { name: 'Delete waypoint' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].waypoints).toEqual([{ lat: 20, lng: 10.002, alt: 120 }])
  })

  it('closes the infobox once the waypoint is gone', async () => {
    renderEditor()
    await placeTwoAndSelect('grab first')
    await userEvent.click(screen.getByRole('button', { name: 'Delete waypoint' }))

    expect(screen.getByTestId('infobox')).toBeEmptyDOMElement()
  })
})

describe('MissionPlanEditor publishing', () => {
  it('has no status control, the server owns the state machine', () => {
    renderEditor(vi.fn(), fixtureMission)
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  })

  it('offers no publish button before the mission has been saved once', () => {
    renderEditor(vi.fn(), undefined, vi.fn())
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
  })

  it('offers publish for a saved draft', async () => {
    renderEditor(vi.fn(), fixtureMission, vi.fn())
    expect(await screen.findByRole('button', { name: 'Publish' })).toBeInTheDocument()
  })

  it('offers no publish button for a mission that is already published', () => {
    renderEditor(vi.fn(), { ...fixtureMission, status: 'published' }, vi.fn())
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
  })

  it('greys out publish until the mission has a name and waypoints', async () => {
    renderEditor(vi.fn(), { ...fixtureMission, name: '', waypoints: [] }, vi.fn())
    expect(await screen.findByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('publishes with whatever is currently in the editor', async () => {
    const onPublish = vi.fn()
    renderEditor(vi.fn(), fixtureMission, onPublish)
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }))

    expect(onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ name: fixtureMission.name, waypoints: fixtureMission.waypoints }),
    )
  })
})
