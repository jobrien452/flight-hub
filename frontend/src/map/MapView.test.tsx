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
    children,
  }: MockMapProps) => (
    <div
      data-testid="mock-map-root"
      data-interactive={(interactiveLayerIds ?? []).join(',')}
      data-style={mapStyle}
      data-cursor={cursor ?? ''}
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
        onClick={() => onMouseMove({ lngLat: { lng: 11, lat: 21 }, point: { x: 50, y: 60 } })}
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

describe('MapView', () => {
  it('calls onMapClick with lng/lat when the map is clicked', () => {
    const onMapClick = vi.fn()
    render(<MapView waypoints={[]} onMapClick={onMapClick} />)

    fireEvent.click(screen.getByTestId('mock-map'))

    expect(onMapClick).toHaveBeenCalledWith({ lng: 10, lat: 20 })
  })

  it('puts a scale bar in the bottom left', () => {
    render(<MapView waypoints={[]} onMapClick={() => {}} />)

    expect(screen.getByTestId('mock-scale')).toHaveAttribute('data-position', 'bottom-left')
  })

  it('hands the plan to the 3d overlay with each waypoint altitude', () => {
    render(
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


  it('draws the in-progress tool overlay in its own source', () => {
    render(
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

  it('adds a polygon feature for the ghost boundary', () => {
    render(
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

  it('skips the overlay source when nothing is in progress', () => {
    render(<MapView waypoints={[]} onMapClick={() => {}} />)

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

  function renderDraggable(handlers: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
    const props = {
      onMapClick: vi.fn(),
      onHandleDragStart: vi.fn(),
      onHandleDrag: vi.fn(),
      onHandleDragEnd: vi.fn(),
      ...handlers,
    }
    render(
      <MapView waypoints={[]} overlay={{ markers: box, ghost: box, draggable: true }} {...props} />,
    )
    return props
  }

  it('reports which corner was grabbed', () => {
    const props = renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))

    expect(props.onHandleDragStart).toHaveBeenCalledWith(2)
  })

  it('reports the pointer position while a corner is held', () => {
    const props = renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(props.onHandleDrag).toHaveBeenCalledWith({ lng: 11, lat: 21 })
  })

  it('ignores pointer movement when no corner was grabbed', () => {
    const props = renderDraggable()

    fireEvent.click(screen.getByTestId('grab-nothing'))
    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(props.onHandleDrag).not.toHaveBeenCalled()
  })

  it('ends the drag on release', () => {
    const props = renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('release'))
    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(props.onHandleDragEnd).toHaveBeenCalled()
    expect(props.onHandleDrag).not.toHaveBeenCalled()
  })

  it('keeps the grab cursor for the rectangle corner handles', () => {
    renderDraggable()

    fireEvent.click(screen.getByTestId('enter-layer'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', 'grab')
  })

  it('swallows the click that ends a drag so it does not place a new corner', () => {
    const props = renderDraggable()

    fireEvent.click(screen.getByTestId('grab-corner'))
    fireEvent.click(screen.getByTestId('release'))
    fireEvent.click(screen.getByTestId('mock-map'))

    expect(props.onMapClick).not.toHaveBeenCalled()
  })

  it('still places a corner on a plain map click', () => {
    const props = renderDraggable()

    fireEvent.click(screen.getByTestId('mock-map'))

    expect(props.onMapClick).toHaveBeenCalledWith({ lng: 10, lat: 20 })
  })

  it('only makes markers grabbable when the overlay says they are draggable', () => {
    render(<MapView waypoints={[]} onMapClick={() => {}} overlay={{ markers: box }} />)

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-interactive', '')
  })

  it('makes markers grabbable when the overlay is draggable', () => {
    renderDraggable()

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute(
      'data-interactive',
      'overlay-corners',
    )
  })

  it('flags the selected marker so it can be drawn differently', () => {
    render(
      <MapView
        waypoints={[]}
        onMapClick={() => {}}
        overlay={{ markers: box, draggable: true, selected: 2 }}
      />,
    )

    expect(screen.getByTestId('mock-source-tool-overlay')).toHaveAttribute('data-selected', '1')
  })

  it('flags nothing when no marker is selected', () => {
    renderDraggable()

    expect(screen.getByTestId('mock-source-tool-overlay')).toHaveAttribute('data-selected', '0')
  })
})

describe('MapView style control', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('offers both map and satellite', () => {
    render(<MapView waypoints={[]} onMapClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Satellite' })).toBeInTheDocument()
  })

  it('starts on satellite, where the lie of the land shows', () => {
    render(<MapView waypoints={[]} onMapClick={() => {}} />)

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
    render(<MapView waypoints={[]} onMapClick={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Map' }))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute(
      'data-style',
      'mapbox://styles/mapbox/dark-v11',
    )
  })

  it('remembers the choice for the next map', async () => {
    const first = render(<MapView waypoints={[]} onMapClick={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Map' }))
    first.unmount()

    render(<MapView waypoints={[]} onMapClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('MapView dragging waypoints at altitude', () => {
  const plan = [
    { lat: 1, lng: 2, alt: 40 },
    { lat: 3, lng: 4, alt: 60 },
  ]

  function renderSelectTool(handlers: Record<string, ReturnType<typeof vi.fn>> = {}) {
    const props = {
      onMapClick: vi.fn(),
      onHandleDragStart: vi.fn(),
      onHandleDrag: vi.fn(),
      onHandleDragEnd: vi.fn(),
      ...handlers,
    }
    render(
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

  it('makes the elevated dots pickable for the select tool', () => {
    renderSelectTool()

    expect(screen.getByTestId('mock-flight-overlay')).toHaveAttribute('data-pickable', 'true')
  })

  it('leaves the dots unpickable for the other tools', () => {
    render(<MapView waypoints={plan} onMapClick={() => {}} overlay={{ markers: [] }} />)

    expect(screen.getByTestId('mock-flight-overlay')).toHaveAttribute('data-pickable', 'false')
  })

  it('passes the selection through so the right dot is highlighted', () => {
    renderSelectTool()

    expect(screen.getByTestId('mock-flight-overlay')).toHaveAttribute('data-selected', '1')
  })

  it('grabs the waypoint the 3d overlay reports under the cursor', () => {
    pickedIndex.value = 1
    const props = renderSelectTool()

    fireEvent.click(screen.getByTestId('grab-nothing'))

    expect(props.onHandleDragStart).toHaveBeenCalledWith(1)
  })

  it('ignores a mousedown that hits no waypoint', () => {
    pickedIndex.value = null
    const props = renderSelectTool()

    fireEvent.click(screen.getByTestId('grab-corner'))

    // the flat map feature says index 2, but the dots are the handles now
    expect(props.onHandleDragStart).not.toHaveBeenCalled()
  })

  it('shows a click cursor over a waypoint so it reads as selectable', () => {
    pickedIndex.value = 1
    renderSelectTool()

    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', 'pointer')
  })

  it('leaves the cursor alone over open map', () => {
    pickedIndex.value = null
    renderSelectTool()

    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', '')
  })

  it('goes back to a plain cursor once the pointer leaves the waypoint', () => {
    pickedIndex.value = 1
    renderSelectTool()
    fireEvent.click(screen.getByTestId('move-pointer'))

    pickedIndex.value = null
    fireEvent.click(screen.getByTestId('move-pointer'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', '')
  })

  it('shows a grabbing cursor while a waypoint is being dragged', () => {
    pickedIndex.value = 1
    renderSelectTool()

    fireEvent.click(screen.getByTestId('grab-nothing'))

    expect(screen.getByTestId('mock-map-root')).toHaveAttribute('data-cursor', 'grabbing')
  })

  it('does not consult the flat map layer for the select tool', () => {
    pickedIndex.value = 0
    const props = renderSelectTool()

    fireEvent.click(screen.getByTestId('grab-corner'))

    expect(props.onHandleDragStart).toHaveBeenCalledWith(0)
  })
})

describe('MapView infobox', () => {
  it('renders the infobox anchored at a waypoint', () => {
    const { container } = render(
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

  it('renders no infobox when nothing is anchored', () => {
    const { container } = render(<MapView waypoints={[{ lat: 1, lng: 2 }]} onMapClick={() => {}} />)

    expect(container.querySelector('.map-infobox')).not.toBeInTheDocument()
  })
})
