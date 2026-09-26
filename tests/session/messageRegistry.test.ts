import { MESSAGE_REGISTRY, messageFor } from '@/session/messageRegistry'

describe('message registry', () => {
  it('carries the exact strings fixed by SPECIFICATION.md §5.7', () => {
    expect(MESSAGE_REGISTRY.credentials).toBe('The email or password you entered is incorrect.')
    expect(MESSAGE_REGISTRY.unavailable).toBe(
      'Sign-in is temporarily unavailable. Please try again.',
    )
    expect(MESSAGE_REGISTRY.generic).toBe('Something went wrong. Please try again.')
  })

  it('keeps the session-expired notice textually distinct from every failure string (ADR-022 §5 rule 4)', () => {
    const failures = [
      MESSAGE_REGISTRY.credentials,
      MESSAGE_REGISTRY.unavailable,
      MESSAGE_REGISTRY.generic,
    ]
    expect(failures).not.toContain(MESSAGE_REGISTRY.session_expired)
  })

  it('is closed: it holds exactly four entries', () => {
    expect(Object.keys(MESSAGE_REGISTRY).sort()).toEqual([
      'credentials',
      'generic',
      'session_expired',
      'unavailable',
    ])
  })

  it('exposes no technical detail, status code or token value in any string', () => {
    for (const message of Object.values(MESSAGE_REGISTRY)) {
      expect(message).not.toMatch(/\b(400|401|403|500|http|status|token|exception|stack)\b/i)
    }
  })

  it('uses no spec or process vocabulary in any rendered string', () => {
    for (const message of Object.values(MESSAGE_REGISTRY)) {
      expect(message).not.toMatch(/\b(DO-?\d|FR-?\d|AC-?\d|EF-?\d|wave[- ]?\d)\b/i)
    }
  })

  it('reads an entry by key', () => {
    expect(messageFor('generic')).toBe(MESSAGE_REGISTRY.generic)
  })
})
