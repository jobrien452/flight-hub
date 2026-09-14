import { describe, expect, it } from 'vitest'
import { login } from './auth'

describe('login', () => {
  it('returns a token and role for a known user', async () => {
    const result = await login('Ada Admin')
    expect(result.role).toBe('admin')
    expect(result.token).toBeTruthy()
  })

  it('throws for an unknown user', async () => {
    await expect(login('nobody')).rejects.toThrow()
  })
})
