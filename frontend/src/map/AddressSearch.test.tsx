import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddressSearch } from './AddressSearch'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AddressSearch', () => {
  it('geocodes the query and calls onSelect with the first result', async () => {
    const onSelect = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ features: [{ center: [-122.4194, 37.7749] }] }),
      }),
    )

    render(<AddressSearch mapboxToken="test-token" onSelect={onSelect} />)
    await userEvent.type(screen.getByPlaceholderText('Search an address...'), '1 Market St')
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))

    expect(onSelect).toHaveBeenCalledWith(-122.4194, 37.7749)
  })

  it('shows an error when nothing is found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ features: [] }) }))

    render(<AddressSearch mapboxToken="test-token" onSelect={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('Search an address...'), 'nowhere')
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))

    expect(await screen.findByText('No results')).toBeInTheDocument()
  })
})
