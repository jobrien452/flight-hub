import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createUser, deleteUser, listUsers, updateUser } from './users'
import { API_URL } from './client'
import { fixtureUsers } from '../mocks/handlers'
import { server } from '../mocks/server'

const token = 'fake-token'

describe('listUsers', () => {
  it('returns all users', async () => {
    const users = await listUsers(token)
    expect(users).toEqual(fixtureUsers)
  })

  it('filters by role', async () => {
    const users = await listUsers(token, 'pilot')
    expect(users).toEqual(fixtureUsers.filter((u) => u.role === 'pilot'))
  })
})

describe('createUser', () => {
  it('sends the new account and returns it', async () => {
    const created = await createUser(
      { name: 'Ivy Invited', email: 'ivy@flyby-robotics.dev', role: 'pilot' },
      token,
    )

    expect(created.name).toBe('Ivy Invited')
    expect(created.role).toBe('pilot')
  })

  it('passes a password through when one is set', async () => {
    let sent: unknown
    server.use(
      http.post(`${API_URL}/users`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(fixtureUsers[1], { status: 201 })
      }),
    )

    await createUser(
      { name: 'Pat Pilot', email: 'pat@flyby-robotics.dev', role: 'pilot', password: 'flies-well' },
      token,
    )

    expect(sent).toEqual({
      name: 'Pat Pilot',
      email: 'pat@flyby-robotics.dev',
      role: 'pilot',
      password: 'flies-well',
    })
  })
})

describe('updateUser', () => {
  it('sends only what changed', async () => {
    let sent: unknown
    server.use(
      http.patch(`${API_URL}/users/:id`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ ...fixtureUsers[1], name: 'Pete Pilot Jr' })
      }),
    )

    const updated = await updateUser('pilot-1', { name: 'Pete Pilot Jr' }, token)

    expect(sent).toEqual({ name: 'Pete Pilot Jr' })
    expect(updated.name).toBe('Pete Pilot Jr')
  })
})

describe('deleteUser', () => {
  it('asks for the account to go', async () => {
    let hit = ''
    server.use(
      http.delete(`${API_URL}/users/:id`, ({ params }) => {
        hit = String(params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await deleteUser('pilot-1', token)

    expect(hit).toBe('pilot-1')
  })
})
