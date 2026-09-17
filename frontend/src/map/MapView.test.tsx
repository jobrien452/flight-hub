import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MapView } from './MapView'

interface MockLngLat {
  lngLat: { lng: number; lat: number }
}

interface MockMapProps {
  onClick: (e: MockLngLat) => void
  onMouseDown: (
    e: MockLngLat & {
      features: unknown[]
      point: { x: number; y: number }
      preventDefault: () => void
    },
  ) => void
  onMouseMove: (e: MockLngLat & { point: { x: number; y: number } }) => void
  onMouseUp: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  interactiveLayerIds?: string[]
  mapStyle: string
  cursor?: string
  initialViewState: { longitude: number; latitude: number }
  children: ReactNode
}

// deck.gl needs a real webgl context, so the 3d plan is mocked down to its input.
// the picker stands in for hit testing against dots drawn at altitude
const pickedIndex = { value: null as number | null }

vi.mock('./FlightOverlay', () => ({
  FlightOverlay: ({
    waypoints,
    selected,
    pickable,
    onPickerReady,
  }: {
    waypoints: { alt?: number }[]
    selected?: number
    pickable?: boolean
    onPickerReady?: (pick: ((x: number, y: number) => number | null) | null) => void
  }) => {
    onPickerReady?.(() => pickedIndex.value)
    return (
      <div
        data-testid="mock-flight-overlay"
        data-altitudes={waypoints.map((w) => w.alt ?? 0).join(',')}
        data-selected={selected ?? ''}
        data-pickable={String(pickable ?? false)}
      />
    )
  },
}))

vi.mock('react-map-gl/mapbox', () => ({
  default: ({
    onClick,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseEnter,
    onMouseLeave,
    interactiveLayerIds,
    mapStyle,
    cursor,
    initialViewState,
    children,
  }: MockMapProps) => (
    <div
      data-testid="mock-map-root"
      data-interactive={(interactiveLayerIds ?? []).join(',')}
      data-style={mapStyle}
      data-cursor={cursor ?? ''}
      data-centre={`${initialViewState.longitude},${initialViewState.latitude}`}
    >
      <div data-testid="mock-map" onClick={() => onClick({ lngLat: { lng: 10, lat: 20 } })}>
        {children}
      </div>
      <button
        data-testid="grab-corner"
        onClick={() =>
          onMouseDown({
            features: [{ properties: { index: 2 } }],
            lngLat: { lng: 10, lat: 20 },
            point: { x: 50, y: 60 },
            preventDefault: () => {},
          })
        }
      />
      <button
        data-testid="grab-nothing"
        onClick={() =>
          onMouseDown({
            features: [],
            lngLat: { lng: 10, lat: 20 },
            point: { x: 50, y: 60 },
            preventDefault: () => {},
          })
        }
      />
      <button
        data-testid="move-pointer"
        onClick={() => onMouseMove({ lngLat: { lng: 11, lat: 21 }, point: { x: 140, y: 200 } })}
      />
      {/* a couple of pixels, the wobble of a normal click */}
      <button
        data-testid="nudge-pointer"
        onClick={() => onMouseMove({ lngLat: { lng: 10.001, lat: 20.001 }, point: { x: 52, y: 61 } })}
      />
      <button data-testid="release" onClick={() => onMouseUp()} />
      <button data-testid="enter-layer" onClick={() => onMouseEnter()} />
      <button data-testid="leave-layer" onClick={() => onMouseLeave()} />
    </div>
  ),
  Source: ({
    id,
    children,
    data,
  }: {
    id: string
    children: ReactNode
    data?: GeoJSON.FeatureCollection
  }) => (
    <div
      data-testid={`mock-source-${id}`}
      data-count={data?.features.length ?? 0}
      data-selected={data?.features.filter((f) => f.properties?.selected).length ?? 0}
    >
      {children}
    </div>
  ),
  Layer: () => null,
  ScaleControl: ({ position }: { position: string }) => (
    <div data-testid="mock-scale" data-position={position} />
  ),
}))

function signedIn() {
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }),
  )
}

// the token is fetched now, so the map only exists after that resolves
async function renderMap(ui: React.ReactElement) {
  const result = render(ui)
  await screen.findByTestId('mock-map-root')
  return result
}

beforeEach(() => {
  localStorage.clear()
  signedIn()
})

describe('MapView', () => {
  it('calls onMapClick with lng/lat when the map is clicked', async () => {
    const onMapClick = vi.fn()
    await renderMap(<MapView waypoints={[]} onMapClick={onMapClick} />)

    fireEvent.click(screen.getByTestId('mock-map'))

    expect(onMapClick).toHaveBeenCalledWith({ lng: 10, lat: 20 })
  })

  it('opens on the middle waypoint rather than the corner the plan starts at', async () => {
    await renderMap(
      <MapView
        waypoints={[
          { lat: 1, lng: 1 },
          { lat: 2, lng: 2 },
          { lat: 3, lng: 3 },
        ]}
        onMapClick={() => {}}
      />,
    )

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-centre', '2,2')
  })

  it('falls back to a default view for an empty plan', async () => {
    await renderMap(<MapView waypoints={[]} onMapClick={() => {}} />)

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute(
      'data-centre',
      '-122.4194,37.7749',
    )
  })

  it('puts a scale bar in the bottom left', async () => {
    await renderMap(<MapView waypoints={[]} onMapClick={() => {}} />)

    expect(screen.getByTestId('mock-scale')).toHaveAttribute('data-position', 'bottom-left')
  })

  it('hands the plan to the 3d overlay with each waypoint altitude', async () => {
    await renderMap(
      <MapView
        waypoints={[
          { lat: 1, lng: 2, alt: 40 },
          { lat: 3, lng: 4, alt: 60 },
        ]}
        onMapClick={() => {}}
      />,
    )

    expect(screen.getByTestId('mock-flight-overlay')).toHaveAttribute('data-altitudes', '40,60')
  })


  it('draws the in-progress tool overlay in its own source', async () => {
    await renderMap(
      <MapView
        waypoints={[]}
        onMapClick={() => {}}
        overlay={{
          markers: [
            { lat: 1, lng: 2 },
            { lat: 3, lng: 4 },
          ],
        }}
      />,
    )

    expect(screen.getByTestId('mock-source-tool-overlay')).toHaveAttribute('data-count', '2')
  })

  it('adds a polygon feature for the ghost boundary', async () => {
    await renderMap(
      <MapView
        waypoints={[]}
        onMapClick={() => {}}
        overlay={{
          markers: [{ lat: 1, lng: 2 }],
          ghost: [
            { lat: 1, lng: 2 },
            { lat: 1, lng: 3 },
            { lat: 2, lng: 3 },
            { lat: 2, lng: 2 },
          ],
        }}
      />,
    )

    expect(screen.getByTestId('mock-source-tool-overlay')).toHaveAttribute('data-count', '2')
  })

  it('skips the overlay source when nothing is in progress', async () => {
    await renderMap(<MapView waypoints={[]} onMapClick={() => {}} />)

    expect(screen.queryByTestId('mock-source-tool-overlay')).not.toBeInTheDocument()
  })
})

describe('MapView corner dragging', () => {
  const box = [
    { lat: 1, lng: 2 },
    { lat: 1, lng: 3 },
    { lat: 2, lng: 3 },
    { lat: 2, lng: 2 },
  ]

  async function renderDraggable(handlers: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
    const props = {
      onMapClick: vi.fn(),
      onHandleDragStart: vi.fn(),
      onHandleDrag: vi.fn(),
      onHandleDragEnd: vi.fn(),
      ...handlers,
    }
    await renderMap(
      <MapView waypoints={[]} overlay={{ markers: box, ghost: box, draggable: true }} {...props} />,
    )
    return props
  }

  it('reports which corner was grabbed', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))

    expect(props.onHandleDragStart).toHaveBeenCalledWith(2)
  })

  it('reports the pointer position while a corner is held', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(props.onHandleDrag).toHaveBeenCalledWith({ lng: 11, lat: 21 })
  })

  it('ignores pointer movement when no corner was grabbed', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('grab-nothing'))
    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(props.onHandleDrag).not.toHaveBeenCalled()
  })

  it('ends the drag on release', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('release'))
    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(props.onHandleDragEnd).toHaveBeenCalled()
    expect(props.onHandleDrag).not.toHaveBeenCalled()
  })

  it('does not move a handle for the wobble of an ordinary click', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('nudge-pointer'))
    fireEvent.click(screen.getByTestId('release'))

    expect(props.onHandleDragStart).toHaveBeenCalled()
    expect(props.onHandleDrag).not.toHaveBeenCalled()
  })

  it('moves once the pointer has actually travelled', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(props.onHandleDrag).toHaveBeenCalledWith({ lng: 11, lat: 21 })
  })

  it('keeps following small movements once the drag is under way', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('move-pointer'))
    fireEvent.click(screen.getByTestId('nudge-pointer'))

    expect(props.onHandleDrag).toHaveBeenCalledTimes(2)
  })

  it('starts the threshold afresh on the next grab', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('move-pointer'))
    fireEvent.click(screen.getByTestId('release'))

    // a second pick, jittering the way a real click does
    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('nudge-pointer'))

    expect(props.onHandleDrag).toHaveBeenCalledTimes(1)
  })

  it('keeps the grab cursor for the rectangle corner handles', async () => {
    await renderDraggable()

    fireEvent.click(screen.getByTestId('enter-layer'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', 'grab')
  })

  it('swallows the click that ends a drag so it does not place a new corner', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('release'))
    fireEvent.click(screen.getByTestId('mock-map'))

    expect(props.onMapClick).not.toHaveBeenCalled()
  })

  it('still places a corner on a plain map click', async () => {
    const props = await renderDraggable()

    fireEvent.click(screen.getByTestId('mock-map'))

    expect(props.onMapClick).toHaveBeenCalledWith({ lng: 10, lat: 20 })
  })

  it('only makes markers grabbable when the overlay says they are draggable', async () => {
    await renderMap(<MapView waypoints={[]} onMapClick={() => {}} overlay={{ markers: box }} />)

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-interactive', '')
  })

  it('makes markers grabbable when the overlay is draggable', async () => {
    await renderDraggable()

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute(
      'data-interactive',
      'overlay-corners',
    )
  })

  it('flags the selected marker so it can be drawn differently', async () => {
    await renderMap(
      <MapView
        waypoints={[]}
        onMapClick={() => {}}
        overlay={{ markers: box, draggable: true, selected: 2 }}
      />,
    )

    expect(screen.getByTestId('mock-source-tool-overlay')).toHaveAttribute('data-selected', '1')
  })

  it('flags nothing when no marker is selected', async () => {
    await renderDraggable()

    expect(screen.getByTestId('mock-source-tool-overlay')).toHaveAttribute('data-selected', '0')
  })
})

describe('MapView style control', () => {
  beforeEach(() => {
    localStorage.clear()
    signedIn()
  })

  it('offers both map and satellite', async () => {
    await renderMap(<MapView waypoints={[]} onMapClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Satellite' })).toBeInTheDocument()
  })

  it('starts on satellite, where the lie of the land shows', async () => {
    await renderMap(<MapView waypoints={[]} onMapClick={() => {}} />)

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute(
      'data-style',
      'mapbox://styles/mapbox/satellite-streets-v12',
    )
    expect(screen.getByRole('button', { name: 'Satellite' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches the map to the dark style', async () => {
    await renderMap(<MapView waypoints={[]} onMapClick={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Map' }))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute(
      'data-style',
      'mapbox://styles/mapbox/dark-v11',
    )
  })

  it('remembers the choice for the next map', async () => {
    const first = await renderMap(<MapView waypoints={[]} onMapClick={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Map' }))
    first.unmount()

    await renderMap(<MapView waypoints={[]} onMapClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('MapView dragging waypoints at altitude', () => {
  const plan = [
    { lat: 1, lng: 2, alt: 40 },
    { lat: 3, lng: 4, alt: 60 },
  ]

  async function renderSelectTool(handlers: Record<string, ReturnType<typeof vi.fn>> = {}) {
    const props = {
      onMapClick: vi.fn(),
      onHandleDragStart: vi.fn(),
      onHandleDrag: vi.fn(),
      onHandleDragEnd: vi.fn(),
      ...handlers,
    }
    await renderMap(
      <MapView
        waypoints={plan}
        overlay={{ markers: [], dragsPlanWaypoints: true, selected: 1 }}
        {...props}
      />,
    )
    return props
  }

  beforeEach(() => {
    pickedIndex.value = null
  })

  it('makes the elevated dots pickable for the select tool', async () => {
    await renderSelectTool()

    expect(screen.getByTestId('mock-flight-overlay')).toHaveAttribute('data-pickable', 'true')
  })

  it('leaves the dots unpickable for the other tools', async () => {
    await renderMap(<MapView waypoints={plan} onMapClick={() => {}} overlay={{ markers: [] }} />)

    expect(screen.getByTestId('mock-flight-overlay')).toHaveAttribute('data-pickable', 'false')
  })

  it('passes the selection through so the right dot is highlighted', async () => {
    await renderSelectTool()

    expect(screen.getByTestId('mock-flight-overlay')).toHaveAttribute('data-selected', '1')
  })

  it('grabs the waypoint the 3d overlay reports under the cursor', async () => {
    pickedIndex.value = 1
    const props = await renderSelectTool()

    fireEvent.click(screen.getByTestId('grab-nothing'))

    expect(props.onHandleDragStart).toHaveBeenCalledWith(1)
  })

  it('ignores a mousedown that hits no waypoint', async () => {
    pickedIndex.value = null
    const props = await renderSelectTool()

    fireEvent.click(screen.getByTestId('grab-corner'))

    // the flat map feature says index 2, but the dots are the handles now
    expect(props.onHandleDragStart).not.toHaveBeenCalled()
  })

  it('shows a click cursor over a waypoint so it reads as selectable', async () => {
    pickedIndex.value = 1
    await renderSelectTool()

    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', 'pointer')
  })

  it('leaves the cursor alone over open map', async () => {
    pickedIndex.value = null
    await renderSelectTool()

    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', '')
  })

  it('goes back to a plain cursor once the pointer leaves the waypoint', async () => {
    pickedIndex.value = 1
    await renderSelectTool()
    fireEvent.click(screen.getByTestId('move-pointer'))

    pickedIndex.value = null
    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', '')
  })

  it('shows a grabbing cursor while a waypoint is being dragged', async () => {
    pickedIndex.value = 1
    await renderSelectTool()

    fireEvent.click(screen.getByTestId('grab-nothing'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', 'grabbing')
  })

  it('does not consult the flat map layer for the select tool', async () => {
    pickedIndex.value = 0
    const props = await renderSelectTool()

    fireEvent.click(screen.getByTestId('grab-corner'))

    expect(props.onHandleDragStart).toHaveBeenCalledWith(0)
  })
})

describe('MapView infobox', () => {
  it('renders the infobox anchored at a waypoint', async () => {
    const { container } = await renderMap(
      <MapView
        waypoints={[{ lat: 1, lng: 2 }]}
        onMapClick={() => {}}
        infoboxAt={{ lat: 1, lng: 2 }}
        infobox={<p>Waypoint 1</p>}
      />,
    )

    // positioned by hand rather than by a mapbox popup, which cannot carry altitude
    expect(container.querySelector('.map-infobox')).toHaveTextContent('Waypoint 1')
  })

  it('renders no infobox when nothing is anchored', async () => {
    const { container } = await renderMap(<MapView waypoints={[{ lat: 1, lng: 2 }]} onMapClick={() => {}} />)

    expect(container.querySelector('.map-infobox')).not.toBeInTheDocument()
  })
})
