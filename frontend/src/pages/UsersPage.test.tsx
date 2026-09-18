import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureUsers } from '../mocks/handlers'
import { server } from '../mocks/server'
import { UsersPage } from './UsersPage'

const adminSession = { token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }
const pilotSession = { token: 'fake-token', user_id: 'pilot-1', name: 'Pete Pilot', role: 'pilot' }

beforeEach(() => {
  localStorage.clear()
})

function renderPage(session: Record<string, string> = adminSession) {
  localStorage.setItem('flyby.session', JSON.stringify(session))
  render(
    <MemoryRouter>
      <AuthProvider>
        <UsersPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function openAddDialog() {
  await userEvent.click(await screen.findByRole('button', { name: /add user/i }))
  return within(screen.getByRole('dialog'))
}

describe('UsersPage', () => {
  it('lists everyone on the account', async () => {
    renderPage()

    expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
    expect(screen.getByText('pete@flyby-robotics.dev')).toBeInTheDocument()
    expect(screen.getAllByText('Pilot').length).toBeGreaterThan(0)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('marks an invite nobody has claimed yet', async () => {
    server.use(
      http.get(`${API_URL}/users`, () =>
        HttpResponse.json([{ ...fixtureUsers[1], has_password: false }]),
      ),
    )
    renderPage()

    expect(await screen.findByText(/invite pending/i)).toBeInTheDocument()
  })

  it('invites a new user without a password', async () => {
    let sent: Record<string, unknown> = {}
    server.use(
      http.post(`${API_URL}/users`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            id: 'pilot-9',
            name: sent.name,
            email: sent.email,
            role: sent.role,
            has_password: false,
          },
          { status: 201 },
        )
      }),
    )
    renderPage()

    const dialog = await openAddDialog()
    await userEvent.type(dialog.getByLabelText(/name/i), 'Ivy Invited')
    await userEvent.type(dialog.getByLabelText(/email/i), 'ivy@flyby-robotics.dev')
    await userEvent.click(dialog.getByRole('button', { name: /add user/i }))

    expect(await screen.findByText('Ivy Invited')).toBeInTheDocument()
    expect(sent).toEqual({
      name: 'Ivy Invited',
      email: 'ivy@flyby-robotics.dev',
      role: 'pilot',
    })
  })

  it('only asks for a password when the admin is setting one', async () => {
    renderPage()
    const dialog = await openAddDialog()

    expect(dialog.queryByLabelText(/password/i)).not.toBeInTheDocument()

    await userEvent.selectOptions(dialog.getByLabelText(/access/i), 'password')

    expect(dialog.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('adds a user with a password set for them', async () => {
    let sent: Record<string, unknown> = {}
    server.use(
      http.post(`${API_URL}/users`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            id: 'pilot-9',
            name: sent.name,
            email: sent.email,
            role: sent.role,
            has_password: true,
          },
          { status: 201 },
        )
      }),
    )
    renderPage()

    const dialog = await openAddDialog()
    await userEvent.type(dialog.getByLabelText(/name/i), 'Pat Pilot')
    await userEvent.type(dialog.getByLabelText(/email/i), 'pat@flyby-robotics.dev')
    await userEvent.selectOptions(dialog.getByLabelText(/access/i), 'password')
    await userEvent.type(dialog.getByLabelText(/password/i), 'flies-well')
    await userEvent.click(dialog.getByRole('button', { name: /add user/i }))

    await waitFor(() => expect(sent.password).toBe('flies-well'))
  })

  it('creates the role that was picked', async () => {
    let sent: Record<string, unknown> = {}
    server.use(
      http.post(`${API_URL}/users`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            id: 'admin-9',
            name: sent.name,
            email: sent.email,
            role: sent.role,
            has_password: false,
          },
          { status: 201 },
        )
      }),
    )
    renderPage()

    const dialog = await openAddDialog()
    await userEvent.type(dialog.getByLabelText(/name/i), 'Alex Admin')
    await userEvent.type(dialog.getByLabelText(/email/i), 'alex@flyby-robotics.dev')
    await userEvent.selectOptions(dialog.getByLabelText(/role/i), 'admin')
    await userEvent.click(dialog.getByRole('button', { name: /add user/i }))

    await waitFor(() => expect(sent.role).toBe('admin'))
  })

  it('says when the email is already taken', async () => {
    server.use(
      http.post(`${API_URL}/users`, () =>
        HttpResponse.json({ detail: 'that email already has an account' }, { status: 409 }),
      ),
    )
    renderPage()

    const dialog = await openAddDialog()
    await userEvent.type(dialog.getByLabelText(/name/i), 'Second Go')
    await userEvent.type(dialog.getByLabelText(/email/i), 'pete@flyby-robotics.dev')
    await userEvent.click(dialog.getByRole('button', { name: /add user/i }))

    expect(await screen.findByText(/already has an account/i)).toBeInTheDocument()
  })

  it('renames someone', async () => {
    let sent: Record<string, unknown> = {}
    server.use(
      http.patch(`${API_URL}/users/:id`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...fixtureUsers[1], name: 'Pete Pilot Jr' })
      }),
    )
    renderPage()
    await screen.findByText('Pete Pilot')

    await userEvent.click(screen.getByRole('button', { name: /edit pete pilot/i }))
    const dialog = within(screen.getByRole('dialog'))
    await userEvent.clear(dialog.getByLabelText(/name/i))
    await userEvent.type(dialog.getByLabelText(/name/i), 'Pete Pilot Jr')
    await userEvent.click(dialog.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Pete Pilot Jr')).toBeInTheDocument()
    expect(sent.name).toBe('Pete Pilot Jr')
  })

  it('does not offer to change a role after the fact', async () => {
    renderPage()
    await screen.findByText('Pete Pilot')

    await userEvent.click(screen.getByRole('button', { name: /edit pete pilot/i }))
    const dialog = within(screen.getByRole('dialog'))

    expect(dialog.queryByLabelText(/role/i)).not.toBeInTheDocument()
    expect(dialog.getByText(/stays with the account/i)).toBeInTheDocument()
  })

  it('removes someone once the warning is accepted', async () => {
    server.use(http.delete(`${API_URL}/users/:id`, () => new HttpResponse(null, { status: 204 })))
    renderPage()
    await screen.findByText('Pete Pilot')

    await userEvent.click(screen.getByRole('button', { name: /remove pete pilot/i }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /remove/i }),
    )

    await waitFor(() => expect(screen.queryByText('Pete Pilot')).not.toBeInTheDocument())
  })

  it('says what removing a pilot costs', async () => {
    renderPage()
    await screen.findByText('Pete Pilot')

    await userEvent.click(screen.getByRole('button', { name: /remove pete pilot/i }))

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(/comes off any missions/i)).toBeInTheDocument()
    expect(dialog.getByText(/reports they filed stay/i)).toBeInTheDocument()
  })

  it('says where an admins work goes', async () => {
    server.use(
      http.get(`${API_URL}/users`, () =>
        HttpResponse.json([
          fixtureUsers[0],
          { ...fixtureUsers[1], id: 'admin-2', name: 'Alec Admin', role: 'admin' },
        ]),
      ),
    )
    renderPage()
    await screen.findByText('Alec Admin')

    await userEvent.click(screen.getByRole('button', { name: /remove alec admin/i }))

    expect(within(screen.getByRole('dialog')).getByText(/move to you/i)).toBeInTheDocument()
  })

  it('will not offer to remove the admin doing the looking', async () => {
    renderPage()
    await screen.findByText('Ada Admin')

    expect(screen.queryByRole('button', { name: /remove ada admin/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove pete pilot/i })).toBeInTheDocument()
  })

  it('is not for pilots', async () => {
    renderPage(pilotSession)

    expect(await screen.findByText(/admins only/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add user/i })).not.toBeInTheDocument()
  })
})
