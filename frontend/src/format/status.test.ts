import { describe, expect, it } from 'vitest'
import { statusLabel } from './status'

describe('statusLabel', () => {
  it('turns a wire value into something readable', () => {
    expect(statusLabel('in_flight')).toBe('In Flight')
  })

  it('leaves a single word alone but for the capital', () => {
    expect(statusLabel('draft')).toBe('Draft')
    expect(statusLabel('available')).toBe('Available')
  })

  it('handles every status the app has', () => {
    expect(statusLabel('acknowledged')).toBe('Acknowledged')
    expect(statusLabel('completed')).toBe('Completed')
    expect(statusLabel('maintenance')).toBe('Maintenance')
    expect(statusLabel('retired')).toBe('Retired')
    expect(statusLabel('in_progress')).toBe('In Progress')
  })

  it('does not fall over on an empty value', () => {
    expect(statusLabel('')).toBe('')
  })
})
