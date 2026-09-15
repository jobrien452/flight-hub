import { describe, expect, it } from 'vitest'
import { acceptInvite, login, requestPasswordReset, resetPassword } from './auth'

describe('login', () => {
  it('returns a token and role for correct credentials', async () => {
    const result = await login('ada@flyby-robotics.dev', 'correct-horse')
    expect(result.role).toBe('admin')
    expect(result.token).toBeTruthy()
  })

  it('throws for wrong credentials', async () => {
    await expect(login('ada@flyby-robotics.dev', 'wrong')).rejects.toThrow()
  })
})

describe('acceptInvite', () => {
  it('sets a password and returns a token for a valid invite', async () => {
    const result = await acceptInvite('good-invite-token', 'new-pass')
    expect(result.role).toBe('pilot')
    expect(result.token).toBeTruthy()
  })

  it('throws for an unknown invite token', async () => {
    await expect(acceptInvite('bad-token', 'new-pass')).rejects.toThrow()
  })
})

describe('requestPasswordReset', () => {
  it('resolves without error', async () => {
    await expect(requestPasswordReset('ada@flyby-robotics.dev')).resolves.toBeUndefined()
  })
})

describe('resetPassword', () => {
  it('resolves for a valid reset token', async () => {
    await expect(resetPassword('good-reset-token', 'fresher-pass')).resolves.toBeUndefined()
  })

  it('throws for an invalid reset token', async () => {
    await expect(resetPassword('bad-token', 'fresher-pass')).rejects.toThrow()
  })
})
