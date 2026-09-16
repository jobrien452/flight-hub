import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MapView } from './MapView'

vi.mock('react-map-gl/mapbox', () => ({
  default: ({
    onClick,
    children,
  }: {
    onClick: (e: { lngLat: { lng: number; lat: number } }) => void
    children: ReactNode
  }) => (
    <div data-testid="mock-map" onClick={() => onClick({ lngLat: { lng: 10, lat: 20 } })}>
      {children}
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
    <div data-testid={`mock-source-${id}`} data-count={data.features.length}>
      {children}
    </div>
  ),
  Layer: () => null,
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
