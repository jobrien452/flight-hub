import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { UserMenu } from './UserMenu'

const session = {
  token: 'fake-token',
  user_id: 'admin-1',
  name: 'Ada Admin',
  role: 'admin' as const,
}

function renderMenu(onSignOut = vi.fn()) {
  render(
    <MemoryRouter>
      <UserMenu session={session} onSignOut={onSignOut} />
    </MemoryRouter>,
  )
  return onSignOut
}

describe('UserMenu', () => {
  it('shows who is signed in', () => {
    renderMenu()

    expect(screen.getByRole('button', { name: /Ada Admin/ })).toBeInTheDocument()
  })

  it('stays shut until the name is clicked', () => {
    renderMenu()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('offers profile and sign out', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: /Ada Admin/ }))

    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/profile',
    )
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('signs out when asked', async () => {
    const onSignOut = renderMenu()
    await userEvent.click(screen.getByRole('button', { name: /Ada Admin/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(onSignOut).toHaveBeenCalled()
  })

  it('closes on escape', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: /Ada Admin/ }))
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes once profile is picked', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: /Ada Admin/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Profile' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
