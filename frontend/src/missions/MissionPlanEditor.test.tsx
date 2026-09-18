import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureDrone, fixtureMission, fixtureUsers } from '../mocks/handlers'
import { GuardedNavLink } from '../navigation/GuardedNavLink'
import { UnsavedChangesProvider } from '../navigation/UnsavedChangesProvider'
import { server } from '../mocks/server'
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

  it('sets what the payload does at a waypoint', async () => {
    const onSubmit = renderEditor()
    await placeTwoAndSelect('grab second')
    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    const drawer = screen.getByRole('complementary', { name: 'Waypoint 2 details' })
    await userEvent.type(within(drawer).getByLabelText('Gimbal pitch (deg)'), '-90')
    await userEvent.type(within(drawer).getByLabelText('Zoom (x)'), '4')
    await userEvent.click(within(drawer).getByLabelText('Take a photo here'))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].waypoints[1]).toMatchObject({
      gimbal_pitch: -90,
      zoom: 4,
      photo: true,
    })
  })

  it('asks the payload for nothing until it is told to', async () => {
    const onSubmit = renderEditor()
    await placeTwoAndSelect('grab second')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].waypoints[1].photo).toBeFalsy()
  })

  it('holds the payload fields to what a camera can actually do', async () => {
    renderEditor()
    await placeTwoAndSelect('grab second')
    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    const drawer = screen.getByRole('complementary', { name: 'Waypoint 2 details' })
    // 1x is the lens itself, anything under that is not a zoom the camera has
    expect(within(drawer).getByLabelText('Zoom (x)')).toHaveAttribute('min', '1')
    expect(within(drawer).getByLabelText('Gimbal pitch (deg)')).toHaveAttribute('min', '-90')
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
    renderEditor(vi.fn(), { ...fixtureMission, drone_id: fixtureDrone.id }, onPublish)
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
      expect(button.querySelector('svg')).toBeInTheDocument()
      // the only text on the button is the tooltip, which stays hidden until hover
      expect(button.querySelector('.tool-help')).toHaveTextContent(name)
    }
  })

  it('names the tool in its tooltip', () => {
    renderEditor()

    expect(screen.getByRole('button', { name: 'Rectangle Survey' })).toHaveTextContent(
      'Rectangle Survey',
    )
    expect(screen.getByRole('button', { name: 'Corridor' })).toHaveTextContent('Corridor')
  })

  it('explains the tool you are on down in the panel', async () => {
    renderEditor()

    expect(screen.getByText(/click a waypoint to edit or drag it/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))

    expect(screen.getByText(/trace a line/i)).toBeInTheDocument()
    expect(screen.queryByText(/click a waypoint to edit or drag it/i)).not.toBeInTheDocument()
  })

  it('explains the survey tool the same way', async () => {
    renderEditor()

    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))

    expect(screen.getByText(/four clicks to box an area/i)).toBeInTheDocument()
  })

  it('ties the explanation to the active tool for a screen reader', async () => {
    renderEditor()

    await userEvent.click(screen.getByRole('button', { name: 'Waypoint' }))
    const active = screen.getByRole('button', { name: 'Waypoint' })

    const describedBy = active.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(/drop a waypoint/i)
    // only the tool in use points at it, the others describe nothing
    expect(screen.getByRole('button', { name: 'Corridor' })).not.toHaveAttribute(
      'aria-describedby',
    )
  })
})

describe('drafts do not eat the plan', () => {
  it('leaves placed waypoints alone while a corridor is being traced', async () => {
    const onSubmit = renderEditor()
    await activateWaypointTool()
    await userEvent.click(screen.getByText('click A'))

    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))
    await userEvent.click(screen.getByText('click B'))
    await userEvent.click(screen.getByText('click C'))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    // the traced line is a draft, it does not become the plan until you generate
    expect(onSubmit.mock.calls[0][0].waypoints).toEqual([{ lat: 20, lng: 10, alt: 50 }])
  })

  it('adds the generated corridor to what was already planned', async () => {
    renderEditor()
    await activateWaypointTool()
    await userEvent.click(screen.getByText('click A'))

    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))
    await userEvent.click(screen.getByText('click B'))
    await userEvent.click(screen.getByText('click C'))
    await userEvent.click(screen.getByRole('button', { name: 'Generate Corridor' }))

    // the one placed by hand, plus three passes over a two point line
    expect(await screen.findByText('7 waypoints')).toBeInTheDocument()
  })

  it('leaves placed waypoints alone while a survey box is being drawn', async () => {
    const onSubmit = renderEditor()
    await activateWaypointTool()
    await userEvent.click(screen.getByText('click A'))

    await placeBox()
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].waypoints).toEqual([{ lat: 20, lng: 10, alt: 50 }])
  })

  it('adds the generated survey to what was already planned', async () => {
    renderEditor()
    await activateWaypointTool()
    await userEvent.click(screen.getByText('click A'))

    await placeBox()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))

    const count = Number((await screen.findByText(/^\d+ waypoints$/)).textContent?.split(' ')[0])
    expect(count).toBeGreaterThan(1)
  })

  it('regenerating replaces the last sweep instead of stacking another one', async () => {
    renderEditor()
    await placeBox()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))
    const first = Number((await screen.findByText(/^\d+ waypoints$/)).textContent?.split(' ')[0])

    const spacing = screen.getByLabelText(/line spacing/i)
    await userEvent.clear(spacing)
    await userEvent.type(spacing, '100')
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))

    const second = Number(screen.getByText(/^\d+ waypoints$/).textContent?.split(' ')[0])
    // wider spacing means fewer lines, stacking a second sweep could only add
    expect(second).toBeLessThan(first)
  })
})


describe('the generate button', () => {
  it('goes away once the corridor has been generated', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByText('click B'))

    await userEvent.click(screen.getByRole('button', { name: 'Generate Corridor' }))

    expect(screen.queryByRole('button', { name: 'Generate Corridor' })).not.toBeInTheDocument()
  })

  it('goes away once the survey has been generated', async () => {
    renderEditor()
    await placeBox()

    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))

    expect(screen.queryByRole('button', { name: 'Generate Survey' })).not.toBeInTheDocument()
  })

  it('is not offered on the select or waypoint tools', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByText('click B'))
    expect(screen.getByRole('button', { name: 'Generate Corridor' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(screen.queryByRole('button', { name: 'Generate Corridor' })).not.toBeInTheDocument()

    await activateWaypointTool()
    expect(screen.queryByRole('button', { name: 'Generate Corridor' })).not.toBeInTheDocument()
  })

  it('does not offer the survey button while the corridor tool is up', async () => {
    renderEditor()
    await placeBox()

    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))

    expect(screen.queryByRole('button', { name: 'Generate Survey' })).not.toBeInTheDocument()
  })

  it('comes back when a setting makes the generated plan stale', async () => {
    renderEditor()
    await placeBox()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))
    expect(screen.queryByRole('button', { name: 'Generate Survey' })).not.toBeInTheDocument()

    const spacing = screen.getByLabelText(/line spacing/i)
    await userEvent.clear(spacing)
    await userEvent.type(spacing, '40')

    expect(screen.getByRole('button', { name: 'Generate Survey' })).toBeInTheDocument()
  })

  it('shows the waypoint count rather than a prompt once nothing is pending', async () => {
    renderEditor()
    await placeBox()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))

    expect(screen.queryByText(/click Generate Survey/i)).not.toBeInTheDocument()
    expect(screen.getByText(/^\d+ waypoints$/)).toBeInTheDocument()
  })
})

describe('an ungenerated draft does not survive the tool it was drawn with', () => {
  async function traceCorridor() {
    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByText('click B'))
  }

  it('throws the corridor away when another tool is picked up', async () => {
    renderEditor()
    await traceCorridor()
    expect(screen.getByRole('button', { name: 'Generate Corridor' })).toBeInTheDocument()

    await activateWaypointTool()
    await userEvent.click(screen.getByRole('button', { name: 'Corridor' }))

    // the ghost went with the tool switch, so there is nothing left to generate
    expect(screen.queryByRole('button', { name: 'Generate Corridor' })).not.toBeInTheDocument()
    expect(screen.getByText(/^\d+ waypoints$/)).toBeInTheDocument()
  })

  it('throws an ungenerated survey box away the same way', async () => {
    renderEditor()
    await placeBox()
    expect(await screen.findByRole('button', { name: 'Generate Survey' })).toBeInTheDocument()

    await activateWaypointTool()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))

    expect(screen.queryByRole('button', { name: 'Generate Survey' })).not.toBeInTheDocument()
  })

  it('offers to generate again once a fresh shape is drawn', async () => {
    renderEditor()
    await traceCorridor()
    await activateWaypointTool()

    await traceCorridor()

    expect(screen.getByRole('button', { name: 'Generate Corridor' })).toBeInTheDocument()
  })

  it('keeps what was already generated when the tool is left', async () => {
    renderEditor()
    await placeBox()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))
    const count = screen.getByText(/^\d+ waypoints$/).textContent

    await activateWaypointTool()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))

    expect(screen.getByText(/^\d+ waypoints$/).textContent).toBe(count)
  })

  it('does not offer to generate a survey mission the moment it is opened', async () => {
    renderEditor(vi.fn(), {
      ...fixtureMission,
      plan_params: {
        type: 'survey',
        boundary: [
          { lat: 1, lng: 1 },
          { lat: 1, lng: 2 },
          { lat: 2, lng: 2 },
          { lat: 2, lng: 1 },
        ],
        altitude: 50,
        spacing: 20,
      },
    })

    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))

    expect(screen.queryByRole('button', { name: 'Generate Survey' })).not.toBeInTheDocument()
  })
})

describe('aircraft and payload', () => {
  const free = { ...fixtureDrone, id: 'drone-free', name: 'Falcon 1', status: 'available' }
  const grounded = { ...fixtureDrone, id: 'drone-down', name: 'Falcon 2', status: 'maintenance' }

  function serveDrones(drones: unknown[]) {
    server.use(http.get(`${API_URL}/drones`, () => HttpResponse.json(drones)))
  }

  it('only offers drones that are free to book', async () => {
    serveDrones([free, grounded])
    renderEditor()

    const picker = await screen.findByLabelText(/aircraft/i)
    expect(within(picker).getByRole('option', { name: /Falcon 1/ })).toBeInTheDocument()
    expect(within(picker).queryByRole('option', { name: /Falcon 2/ })).not.toBeInTheDocument()
  })

  it('still lists the drone already booked even once it is busy', async () => {
    serveDrones([free, grounded])
    renderEditor(vi.fn(), { ...fixtureMission, drone_id: 'drone-down' })

    const picker = await screen.findByLabelText(/aircraft/i)
    expect(within(picker).getByRole('option', { name: /Falcon 2/ })).toBeInTheDocument()
  })

  it('hands the booked aircraft back on save', async () => {
    serveDrones([free])
    const onSubmit = renderEditor()

    await userEvent.selectOptions(await screen.findByLabelText(/aircraft/i), 'drone-free')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].droneId).toBe('drone-free')
  })

  it('works out the ground sample distance for the payload picked', async () => {
    renderEditor()

    await userEvent.selectOptions(await screen.findByLabelText(/payload/i), 'sony-ilx-lr1-24')

    // 50m default altitude on the 24mm gives just under a centimetre per pixel
    expect(await screen.findByText(/0\.79 cm\/px/i)).toBeInTheDocument()
    expect(screen.getByText(/Gremsy Pixy/)).toBeInTheDocument()
  })

  it('hands the payload back on save', async () => {
    const onSubmit = renderEditor()

    await userEvent.selectOptions(await screen.findByLabelText(/payload/i), 'sony-ilx-lr1-24')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit.mock.calls[0][0].payload).toMatchObject({
      camera: 'Sony ILX-LR1',
      gimbal: 'Gremsy Pixy',
    })
  })

  it('says nothing about optics until a payload is chosen', () => {
    renderEditor()
    expect(screen.queryByText(/cm\/px/i)).not.toBeInTheDocument()
  })
})

describe('publishing needs an aircraft', () => {
  const free = { ...fixtureDrone, id: 'drone-free', name: 'Falcon 1', status: 'available' }

  it('keeps publish disabled until one is booked', async () => {
    server.use(http.get(`${API_URL}/drones`, () => HttpResponse.json([free])))
    const onPublish = vi.fn()
    renderEditor(vi.fn(), { ...fixtureMission, status: 'draft', drone_id: null }, onPublish)

    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

    await userEvent.selectOptions(await screen.findByLabelText(/aircraft/i), 'drone-free')

    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
  })

  it('still lets the mission be saved with no aircraft', async () => {
    const onSubmit = renderEditor(vi.fn(), { ...fixtureMission, status: 'draft', drone_id: null })

    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit).toHaveBeenCalled()
  })
})

describe('the payload drives the sweep', () => {
  async function pickPayloadAndSurvey() {
    await userEvent.selectOptions(await screen.findByLabelText(/payload/i), 'sony-ilx-lr1-24')
    await placeBox()
  }

  it('asks for overlap rather than raw spacing once a payload is on', async () => {
    renderEditor()
    await userEvent.selectOptions(await screen.findByLabelText(/payload/i), 'sony-ilx-lr1-24')
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))

    expect(screen.getByLabelText(/side overlap/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/line spacing/i)).not.toBeInTheDocument()
  })

  it('falls back to raw spacing with no payload to compute from', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))

    expect(screen.getByLabelText(/line spacing/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/side overlap/i)).not.toBeInTheDocument()
  })

  it('shows the spacing the overlap works out to', async () => {
    renderEditor()
    await userEvent.selectOptions(await screen.findByLabelText(/payload/i), 'sony-ilx-lr1-24')

    // 50m on the 24mm frames 74.6m of ground, 70% overlap leaves 22m between passes
    expect(await screen.findByText(/22 m/)).toBeInTheDocument()
  })

  it('flies tighter passes when the overlap goes up', async () => {
    renderEditor()
    await pickPayloadAndSurvey()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))
    const looser = Number((await screen.findByText(/^\d+ waypoints$/)).textContent?.split(' ')[0])

    const overlap = screen.getByLabelText(/side overlap/i)
    await userEvent.clear(overlap)
    await userEvent.type(overlap, '85')
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))

    const tighter = Number(screen.getByText(/^\d+ waypoints$/).textContent?.split(' ')[0])
    expect(tighter).toBeGreaterThan(looser)
  })

  it('flies wider passes when the aircraft climbs, same overlap', async () => {
    renderEditor()
    await pickPayloadAndSurvey()
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))
    const low = Number((await screen.findByText(/^\d+ waypoints$/)).textContent?.split(' ')[0])

    const altitude = screen.getByLabelText(/altitude/i)
    await userEvent.clear(altitude)
    await userEvent.type(altitude, '150')
    await userEvent.click(await screen.findByRole('button', { name: 'Generate Survey' }))

    const high = Number(screen.getByText(/^\d+ waypoints$/).textContent?.split(' ')[0])
    expect(high).toBeLessThan(low)
  })
})

describe('a booked aircraft is off the table', () => {
  const free = { ...fixtureDrone, id: 'drone-free', name: 'Falcon 1', booked_on: null }
  const taken = { ...fixtureDrone, id: 'drone-taken', name: 'Falcon 2', booked_on: 'mission-9' }

  function serveDrones(drones: unknown[]) {
    server.use(http.get(`${API_URL}/drones`, () => HttpResponse.json(drones)))
  }

  it('leaves out an aircraft another mission is holding', async () => {
    serveDrones([free, taken])
    renderEditor()

    const picker = await screen.findByLabelText(/aircraft/i)
    expect(within(picker).getByRole('option', { name: /Falcon 1/ })).toBeInTheDocument()
    expect(within(picker).queryByRole('option', { name: /Falcon 2/ })).not.toBeInTheDocument()
  })

  it('keeps the one this mission is holding', async () => {
    serveDrones([free, { ...taken, booked_on: fixtureMission.id }])
    renderEditor(vi.fn(), { ...fixtureMission, drone_id: 'drone-taken' })

    const picker = await screen.findByLabelText(/aircraft/i)
    expect(within(picker).getByRole('option', { name: /Falcon 2/ })).toBeInTheDocument()
  })
})

describe('MissionPlanEditor unsaved work', () => {
  function renderGuarded(mission?: Mission) {
    render(
      <MemoryRouter>
        <AuthProvider>
          <UnsavedChangesProvider>
            <GuardedNavLink to="/fleet">Fleet</GuardedNavLink>
            <MissionPlanEditor
              mission={mission}
              submitting={false}
              error={null}
              submitLabel="Create"
              onSubmit={vi.fn()}
            />
          </UnsavedChangesProvider>
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  async function leave() {
    await userEvent.click(screen.getByRole('link', { name: 'Fleet' }))
  }

  it('lets you walk away from an editor you have not touched', async () => {
    renderGuarded()
    await leave()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lets you walk away from a saved mission you only looked at', async () => {
    renderGuarded(fixtureMission)
    await leave()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('warns once the mission has been named', async () => {
    renderGuarded()
    await userEvent.type(screen.getByPlaceholderText('New Mission'), 'Site B')
    await leave()

    expect(screen.getByRole('dialog')).toHaveTextContent(/not been saved/i)
  })

  it('warns once a waypoint has been placed', async () => {
    renderGuarded()
    await activateWaypointTool()
    await userEvent.click(screen.getByText('click A'))
    await leave()

    expect(screen.getByRole('dialog')).toHaveTextContent(/not been saved/i)
  })

  it('warns once the route of a saved mission has changed', async () => {
    renderGuarded(fixtureMission)
    await activateWaypointTool()
    await userEvent.click(screen.getByText('click A'))
    await leave()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
