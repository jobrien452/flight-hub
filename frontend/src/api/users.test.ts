import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createUser, listUsers } from './users'
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
