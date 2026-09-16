import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureMission } from '../mocks/handlers'
import { server } from '../mocks/server'
import { MissionsPage } from './MissionsPage'

beforeEach(() => {
  localStorage.clear()
})

function renderPage(session: Record<string, string>) {
  localStorage.setItem('flyby.session', JSON.stringify(session))
  return render(
    <MemoryRouter initialEntries={['/missions']}>
      <AuthProvider>
        <Routes>
          <Route path="/missions" element={<MissionsPage />} />
          <Route path="/missions/:id" element={<h1>Mission detail</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function serveMissions(overrides: Record<string, unknown>) {
  server.use(
    http.get(`${API_URL}/missions`, () =>
      HttpResponse.json([{ ...fixtureMission, ...overrides }]),
    ),
  )
}

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: 'Mission actions' }))
}

const adminSession = { token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }
const pilotSession = { token: 'fake-token', user_id: 'pilot-1', name: 'Pete Pilot', role: 'pilot' }

describe('MissionsPage', () => {
  it('lists missions for the signed in user', async () => {
    renderPage(adminSession)
    expect(await screen.findByText(fixtureMission.name)).toBeInTheDocument()
  })

  it('shows a New Mission action for admins', async () => {
    renderPage(adminSession)
    expect(await screen.findByRole('link', { name: /new mission/i })).toBeInTheDocument()
  })

  it('hides the New Mission action for pilots', async () => {
    renderPage(pilotSession)
    await screen.findByText(fixtureMission.name)
    expect(screen.queryByRole('link', { name: /new mission/i })).not.toBeInTheDocument()
  })
})

describe('MissionsPage row menu', () => {
  it('gives admins a menu on each row', async () => {
    renderPage(adminSession)
    expect(await screen.findByRole('button', { name: 'Mission actions' })).toBeInTheDocument()
  })

  it('hides the menu from pilots', async () => {
    renderPage(pilotSession)
    await screen.findByText(fixtureMission.name)
    expect(screen.queryByRole('button', { name: 'Mission actions' })).not.toBeInTheDocument()
  })

  it('stays shut until the glyph is clicked', async () => {
    renderPage(adminSession)
    await screen.findByText(fixtureMission.name)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('offers view, edit, plan and delete', async () => {
    renderPage(adminSession)
    await openMenu()

    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Plan' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  it('points view and plan at the right pages', async () => {
    renderPage(adminSession)
    await openMenu()

    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'View' })).toHaveAttribute(
      'href',
      `/missions/${fixtureMission.id}`,
    )
    expect(within(menu).getByRole('menuitem', { name: 'Plan' })).toHaveAttribute(
      'href',
      `/missions/${fixtureMission.id}/plan`,
    )
  })

  it('closes on escape', async () => {
    renderPage(adminSession)
    await openMenu()
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('MissionsPage editing from the menu', () => {
  it('asks before editing', async () => {
    renderPage(adminSession)
    await openMenu()
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Edit' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Edit this mission?')
  })

  it('says so when the mission is already assigned', async () => {
    renderPage(adminSession)
    await openMenu()
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Edit' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('already been assigned')
  })

  it('goes to the mission editor once confirmed', async () => {
    renderPage(adminSession)
    await openMenu()
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit anyway' }))

    expect(await screen.findByRole('heading', { name: 'Mission detail' })).toBeInTheDocument()
  })
})

describe('MissionsPage deleting from the menu', () => {
  it('refuses while a pilot is still assigned', async () => {
    renderPage(adminSession)
    await openMenu()
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Unassign every pilot')
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('offers a way to go unassign them', async () => {
    renderPage(adminSession)
    await openMenu()
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete' }))

    expect(screen.getByRole('link', { name: 'Manage pilots' })).toHaveAttribute(
      'href',
      `/missions/${fixtureMission.id}/plan`,
    )
  })

  it('asks for confirmation when nobody is assigned', async () => {
    serveMissions({ assigned_pilot_ids: [] })
    renderPage(adminSession)
    await openMenu()
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('cannot be undone')
  })

  it('drops the mission from the table once deleted', async () => {
    serveMissions({ assigned_pilot_ids: [] })
    renderPage(adminSession)
    await openMenu()
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
    )

    expect(await screen.findByText('No missions yet.')).toBeInTheDocument()
  })

  it('keeps the mission when the confirm is cancelled', async () => {
    serveMissions({ assigned_pilot_ids: [] })
    renderPage(adminSession)
    await openMenu()
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText(fixtureMission.name)).toBeInTheDocument()
  })

  it('reports a delete the server refuses', async () => {
    serveMissions({ assigned_pilot_ids: [] })
    server.use(
      http.delete(`${API_URL}/missions/:id`, () => new HttpResponse(null, { status: 409 })),
    )
    renderPage(adminSession)
    await openMenu()
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
    )

    expect(await screen.findByText('Could not delete this mission')).toBeInTheDocument()
  })
})

