import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MapCompass } from './MapCompass'

describe('MapCompass', () => {
  it('reads north when the map is not turned', () => {
    render(<MapCompass bearing={0} onReset={vi.fn()} />)

    expect(screen.getByText('0°')).toBeInTheDocument()
  })

  it('shows the heading the map is turned to', () => {
    render(<MapCompass bearing={45} onReset={vi.fn()} />)

    expect(screen.getByText('45°')).toBeInTheDocument()
  })

  it('turns the rose the other way so north keeps pointing north', () => {
    render(<MapCompass bearing={90} onReset={vi.fn()} />)

    expect(screen.getByTestId('compass-rose')).toHaveStyle({ transform: 'rotate(-90deg)' })
  })

  it('reads a negative bearing round the dial', () => {
    render(<MapCompass bearing={-90} onReset={vi.fn()} />)

    expect(screen.getByText('270°')).toBeInTheDocument()
  })

  it('faces the map north again when clicked', async () => {
    const onReset = vi.fn()
    render(<MapCompass bearing={120} onReset={onReset} />)

    await userEvent.click(screen.getByRole('button'))

    expect(onReset).toHaveBeenCalled()
  })

  it('says what it does', () => {
    render(<MapCompass bearing={120} onReset={vi.fn()} />)

    expect(screen.getByRole('button')).toHaveAccessibleName(/north/i)
  })
})
