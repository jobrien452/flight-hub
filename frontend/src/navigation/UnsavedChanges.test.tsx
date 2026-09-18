import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { GuardedNavLink } from './GuardedNavLink'
import { UnsavedChangesProvider } from './UnsavedChangesProvider'
import { useUnsavedWork } from './useUnsavedChanges'

function Editor({ dirty }: { dirty: boolean }) {
  useUnsavedWork(dirty)
  return <p>editing</p>
}

function renderHarness(dirty: boolean) {
  return render(
    <MemoryRouter initialEntries={['/missions/new']}>
      <UnsavedChangesProvider>
        <GuardedNavLink to="/fleet">Fleet</GuardedNavLink>
        <Routes>
          <Route path="/missions/new" element={<Editor dirty={dirty} />} />
          <Route path="/fleet" element={<h1>Fleet</h1>} />
        </Routes>
      </UnsavedChangesProvider>
    </MemoryRouter>,
  )
}

describe('unsaved work guard', () => {
  it('lets a link through when there is nothing to lose', async () => {
    renderHarness(false)

    await userEvent.click(screen.getByRole('link', { name: 'Fleet' }))

    expect(screen.getByRole('heading', { name: 'Fleet' })).toBeInTheDocument()
  })

  it('holds the navigation and asks when work is unsaved', async () => {
    renderHarness(true)

    await userEvent.click(screen.getByRole('link', { name: 'Fleet' }))

    expect(screen.getByRole('dialog')).toHaveTextContent(/not been saved/i)
    expect(screen.getByText('editing')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Fleet' })).not.toBeInTheDocument()
  })

  it('goes through once the warning is accepted', async () => {
    renderHarness(true)
    await userEvent.click(screen.getByRole('link', { name: 'Fleet' }))

    await userEvent.click(screen.getByRole('button', { name: 'Leave' }))

    expect(screen.getByRole('heading', { name: 'Fleet' })).toBeInTheDocument()
  })

  it('stays put when the warning is dismissed', async () => {
    renderHarness(true)
    await userEvent.click(screen.getByRole('link', { name: 'Fleet' }))

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('editing')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks again on the next attempt after a dismissal', async () => {
    renderHarness(true)
    await userEvent.click(screen.getByRole('link', { name: 'Fleet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await userEvent.click(screen.getByRole('link', { name: 'Fleet' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('warns the browser itself about a reload or a closed tab', () => {
    renderHarness(true)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves the browser alone when nothing is unsaved', () => {
    renderHarness(false)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })
})
