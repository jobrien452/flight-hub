import { render, screen, waitFor, within } from '@testing-library/react'
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

// select is the tool on load, so placing anything means picking a tool first
async function activateWaypointTool() {
  await userEvent.click(screen.getByRole('button', { name: 'Waypoint' }))
}

async function setAltitude(value: string) {
  const input = screen.getByLabelText('Altitude (m)')
  await userEvent.clear(input)
  await userEvent.type(input, value)
}

const pilot = fixtureUsers.find((u) => u.role === 'pilot')!

describe('MissionPlanEditor', () => {
  it('has no pilot assignment in the toolbar, that lives on the plan page', async () => {
    renderEditor(vi.fn(), fixtureMission)
    await screen.findByPlaceholderText('New Mission')

    expect(screen.queryByText('Pilots')).not.toBeInTheDocument()
    expect(screen.queryByText(pilot.name)).not.toBeInTheDocument()
  })

  it('shows New Mission as the name placeholder', () => {
    renderEditor()
    expect(screen.getByPlaceholderText('New Mission')).toBeInTheDocument()
  })

  it('starts on the select tool', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: 'Select' })).toHaveClass('active')
  })

  it('adds a waypoint when the map is clicked with the waypoint tool active', async () => {
    renderEditor()
    await activateWaypointTool()
    await userEvent.click(screen.getByText('click A'))
    expect(await screen.findByText('1 waypoints')).toBeInTheDocument()
  })

  it('does not drop a waypoint when the map is clicked on the select tool', async () => {
    renderEditor()
    await userEvent.click(screen.getByText('click A'))
    expect(screen.getByText('0 waypoints')).toBeInTheDocument()
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

  it('keeps the generated survey when switching to the waypoint tool', async () => {
    renderEditor()
    await placeBox()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))
    const generated = await screen.findByText(/^\d+ waypoints$/)
    const count = generated.textContent

    await userEvent.click(screen.getByRole('button', { name: 'Waypoint' }))

    expect(screen.getByText(/^\d+ waypoints$/).textContent).toBe(count)
  })

  it('appends to the generated survey rather than starting over', async () => {
    const onSubmit = renderEditor()
    await placeBox()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))
    const before = Number((await screen.findByText(/^\d+ waypoints$/)).textContent?.split(' ')[0])

    await userEvent.click(screen.getByRole('button', { name: 'Waypoint' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].waypoints).toHaveLength(before + 1)
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
    await activateWaypointTool()
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

  it('carries the assigned pilots through untouched when editing a mission', async () => {
    const onSubmit = renderEditor(vi.fn(), fixtureMission)
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
    await activateWaypointTool()
    await userEvent.click(screen.getByText('click A'))
    await setAltitude('120')

    expect(screen.getByText('1 waypoints')).toBeInTheDocument()
  })

  it('gives each waypoint the altitude that was set when it was placed', async () => {
    const onSubmit = renderEditor()
    await activateWaypointTool()
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
    await activateWaypointTool()
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

  it('opens a details drawer for the selected waypoint', async () => {
    renderEditor()
    await placeTwoAndSelect('grab second')
    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    const drawer = screen.getByRole('complementary', { name: 'Waypoint 2 details' })
    expect(within(drawer).getByLabelText('Latitude')).toHaveValue(20)
    expect(within(drawer).getByLabelText('Altitude (m)')).toHaveValue(120)
  })

  it('has no drawer until it is asked for', async () => {
    renderEditor()
    await placeTwoAndSelect('grab second')

    expect(screen.queryByRole('complementary', { name: /details/ })).not.toBeInTheDocument()
  })

  it('edits the deeper fields from the drawer', async () => {
    const onSubmit = renderEditor()
    await placeTwoAndSelect('grab second')
    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    const drawer = screen.getByRole('complementary', { name: 'Waypoint 2 details' })
    await userEvent.type(within(drawer).getByLabelText('Heading (deg)'), '90')
    await userEvent.type(within(drawer).getByLabelText('Speed (m/s)'), '4')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].waypoints[1]).toMatchObject({ heading: 90, speed: 4 })
  })

  it('closes the drawer', async () => {
    renderEditor()
    await placeTwoAndSelect('grab second')
    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close waypoint details' }))

    expect(screen.queryByRole('complementary', { name: /details/ })).not.toBeInTheDocument()
  })

  it('closes the drawer when the waypoint is deleted from it', async () => {
    renderEditor()
    await placeTwoAndSelect('grab second')
    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    const drawer = screen.getByRole('complementary', { name: 'Waypoint 2 details' })
    await userEvent.click(within(drawer).getByRole('button', { name: 'Delete waypoint' }))

    expect(screen.queryByRole('complementary', { name: /details/ })).not.toBeInTheDocument()
  })

  it('closes the drawer when the tool changes', async () => {
    renderEditor()
    await placeTwoAndSelect('grab second')
    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    await userEvent.click(screen.getByRole('button', { name: 'Waypoint' }))

    expect(screen.queryByRole('complementary', { name: /details/ })).not.toBeInTheDocument()
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



describe('corridor tool', () => {
  async function traceCorridor() {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))
    await userEvent.click(screen.getByRole('button', { name: 'click A' }))
    await userEvent.click(screen.getByRole('button', { name: 'click B' }))
  }

  it('sits in the toolbar alongside the other tools', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: 'Corridor' })).toBeInTheDocument()
  })

  it('asks for a corridor width once the tool is picked', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))

    expect(screen.getByLabelText(/corridor width/i)).toBeInTheDocument()
  })

  it('waits for the line to be traced before offering to generate', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))

    expect(screen.queryByRole('button', { name: 'Generate Corridor' })).not.toBeInTheDocument()
  })

  it('offers to generate once the line has two points', async () => {
    await traceCorridor()

    expect(await screen.findByRole('button', { name: 'Generate Corridor' })).toBeInTheDocument()
    expect(screen.getByText('line traced, click Generate Corridor')).toBeInTheDocument()
  })

  it('turns the line into passes across the corridor', async () => {
    await traceCorridor()

    await userEvent.click(screen.getByRole('button', { name: 'Generate Corridor' }))

    // the centre line and one pass either side of it, over two points each
    expect(await screen.findByText('6 waypoints')).toBeInTheDocument()
  })

  it('hands the generated plan back on save', async () => {
    const onSubmit = vi.fn()
    render(
      <MemoryRouter>
        <AuthProvider>
          <MissionPlanEditor
            submitting={false}
            error={null}
            submitLabel="Create Mission"
            onSubmit={onSubmit}
          />
        </AuthProvider>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))
    await userEvent.click(screen.getByRole('button', { name: 'click A' }))
    await userEvent.click(screen.getByRole('button', { name: 'click B' }))
    await userEvent.click(screen.getByRole('button', { name: 'Generate Corridor' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create Mission' }))

    const value = onSubmit.mock.calls.at(-1)?.[0]
    expect(value.planParams.type).toBe('corridor')
    expect(value.planParams.path).toHaveLength(2)
    expect(value.waypoints).toHaveLength(6)
  })
})

describe('tool buttons', () => {
  it('shows each tool as a glyph rather than a wrapping label', () => {
    renderEditor()

    for (const name of ['Select', 'Waypoint', 'Rectangle Survey', 'Corridor']) {
      const button = screen.getByRole('button', { name })
      expect(button).toBeInTheDocument()
      // the label is the accessible name, the visible part is the icon
      expect(button.querySelector('svg')).toBeInTheDocument()
      expect(button.textContent).not.toBe(name)
    }
  })

  it('explains what each tool does in a tooltip', () => {
    renderEditor()

    expect(screen.getByRole('button', { name: 'Rectangle Survey' })).toHaveTextContent(
      /four clicks/i,
    )
    expect(screen.getByRole('button', { name: 'Corridor' })).toHaveTextContent(/trace a line/i)
    expect(screen.getByRole('button', { name: 'Waypoint' })).toHaveTextContent(/one at a time/i)
    expect(screen.getByRole('button', { name: 'Select' })).toHaveTextContent(/move/i)
  })

  it('points the tooltip at the button for a screen reader too', () => {
    renderEditor()
    const button = screen.getByRole('button', { name: 'Corridor' })

    const describedBy = button.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(/trace a line/i)
  })
})
