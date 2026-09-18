import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MapStatsBar } from './MapStatsBar'

describe('MapStatsBar', () => {
  it('lays the figures out along the bottom', () => {
    render(
      <MapStatsBar
        stats={[
          { label: 'Waypoints', value: '12' },
          { label: 'Distance', value: '1.20 km' },
        ]}
      />,
    )

    expect(screen.getByText('Waypoints')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('1.20 km')).toBeInTheDocument()
  })

  it('stays out of the way when there is nothing to say', () => {
    const { container } = render(<MapStatsBar stats={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
