import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MapView } from './MapView'

interface MockLngLat {
  lngLat: { lng: number; lat: number }
}

interface MockMapProps {
  onClick: (e: MockLngLat) => void
  onMouseDown: (e: MockLngLat & { features: unknown[]; preventDefault: () => void }) => void
  onMouseMove: (e: MockLngLat) => void
  onMouseUp: () => void
  interactiveLayerIds?: string[]
  children: ReactNode
}

vi.mock('react-map-gl/mapbox', () => ({
  default: ({
    onClick,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    interactiveLayerIds,
    children,
  }: MockMapProps) => (
    <div data-testid="mock-map-root" data-interactive={(interactiveLayerIds ?? []).join(',')}>
      <div data-testid="mock-map" onClick={() => onClick({ lngLat: { lng: 10, lat: 20 } })}>
        {children}
      </div>
      <button
        data-testid="grab-corner"
        onClick={() =>
          onMouseDown({
            features: [{ properties: { index: 2 } }],
            lngLat: { lng: 10, lat: 20 },
            preventDefault: () => {},
          })
        }
      />
      <button
        data-testid="grab-nothing"
        onClick={() =>
          onMouseDown({ features: [], lngLat: { lng: 10, lat: 20 }, preventDefault: () => {} })
        }
      />
      <button
        data-testid="move-pointer"
        onClick={() => onMouseMove({ lngLat: { lng: 11, lat: 21 } })}
      />
      <button data-testid="release" onClick={() => onMouseUp()} />
    </div>
  ),
  Source: ({
    id,
    children,
    data,
  }: {
    id: string
    children: ReactNode
    data: GeoJSON.FeatureCollection
  }) => (
    <div
      data-testid={`mock-source-${id}`}
      data-count={data.features.length}
      data-selected={data.features.filter((f) => f.properties?.selected).length}
    >
      {children}
    </div>
  ),
  Layer: () => null,
  Popup: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-popup">{children}</div>
  ),
}))

describe('MapView', () => {
  it('calls onMapClick with lng/lat when the map is clicked', () => {
    const onMapClick = vi.fn()
    render(<MapView waypoints={[]} onMapClick={onMapClick} />)

    fireEvent.click(screen.getByTestId('mock-map'))

    expect(onMapClick).toHaveBeenCalledWith({ lng: 10, lat: 20 })
  })

  it('builds a point per waypoint plus a connecting line once there are two or more', () => {
    render(
      <MapView
        waypoints={[
          { lat: 1, lng: 2 },
          { lat: 3, lng: 4 },
        ]}
        onMapClick={() => {}}
      />,
    )

    expect(screen.getByTestId('mock-source-flight-plan')).toHaveAttribute('data-count', '3')
  })

  it('renders only point features for a single waypoint', () => {
    render(<MapView waypoints={[{ lat: 1, lng: 2 }]} onMapClick={() => {}} />)

    expect(screen.getByTestId('mock-source-flight-plan')).toHaveAttribute('data-count', '1')
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

describe('MapView infobox', () => {
  it('renders the infobox anchored at a waypoint', () => {
    render(
      <MapView
        waypoints={[{ lat: 1, lng: 2 }]}
        onMapClick={() => {}}
        infoboxAt={{ lat: 1, lng: 2 }}
        infobox={<p>Waypoint 1</p>}
      />,
    )

    expect(screen.getByTestId('mock-popup')).toHaveTextContent('Waypoint 1')
  })

  it('renders no infobox when nothing is anchored', () => {
    render(<MapView waypoints={[{ lat: 1, lng: 2 }]} onMapClick={() => {}} />)

    expect(screen.queryByTestId('mock-popup')).not.toBeInTheDocument()
  })
})
