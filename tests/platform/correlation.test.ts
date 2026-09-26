import { newCorrelationId } from '@/platform/correlation'

describe('newCorrelationId', () => {
  it('produces a distinct value per call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newCorrelationId()))
    expect(ids.size).toBe(50)
  })

  it('falls back when crypto.randomUUID is unavailable', () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })
    try {
      expect(newCorrelationId()).toMatch(/^c-/)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: original })
    }
  })

  it('carries no user data', () => {
    expect(newCorrelationId()).not.toMatch(/@|password|token/i)
  })
})
