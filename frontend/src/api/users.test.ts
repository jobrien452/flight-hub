import { describe, expect, it } from 'vitest'
import { listUsers } from './users'
import { fixtureUsers } from '../mocks/handlers'

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
