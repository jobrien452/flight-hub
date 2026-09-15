import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { AcceptInvitePage } from './AcceptInvitePage'

beforeEach(() => {
  localStorage.clear()
})

function renderPage(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <AcceptInvitePage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AcceptInvitePage', () => {
  it('sets a password for a valid invite token and stores a session', async () => {
    renderPage('/accept-invite?token=good-invite-token')
    await userEvent.type(screen.getByLabelText('New password'), 'new-pass')
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }))

    await waitFor(() => {
      expect(localStorage.getItem('flyby.session')).toContain('Pete Pilot')
    })
  })

  it('shows an error for an unknown invite token', async () => {
    renderPage('/accept-invite?token=bad-token')
    await userEvent.type(screen.getByLabelText('New password'), 'new-pass')
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }))

    expect(await screen.findByText(/invite link is invalid or expired/i)).toBeInTheDocument()
  })
})
