/**
 * SessionStore -- 100% line coverage is a contract
 * (LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.5). Implemented in full in wave-1,
 * including `read`/`clear`/`isLive`, which only wave-2 consumes.
 */
import { SESSION_STORAGE_KEY, SessionStore } from '@/session/sessionStore'

const LIVE_SESSION = {
  accessToken: 'header.payload.signature',
  role: 'user',
  expiresAt: 1893456000,
} as const

describe('SessionStore.write', () => {
  it('persists the four contract fields under a single key', () => {
    SessionStore.write({ ...LIVE_SESSION, expiresRaw: 1893456000 })
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toEqual({
      accessToken: 'header.payload.signature',
      role: 'user',
      expiresAt: 1893456000,
      expiresRaw: 1893456000,
    })
  })

  it('lower-cases the role on write and stores it as received, without normalising it', () => {
    SessionStore.write({ ...LIVE_SESSION, role: 'SuperIntendent' })
    expect(SessionStore.read()?.role).toBe('superintendent')
  })

  it('omits expiresRaw when the response did not carry it', () => {
    SessionStore.write(LIVE_SESSION)
    expect(JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY) as string)).toEqual({
      accessToken: 'header.payload.signature',
      role: 'user',
      expiresAt: 1893456000,
    })
  })

  it('never writes a refreshToken or a password field', () => {
    SessionStore.write({ ...LIVE_SESSION, expiresRaw: 1 })
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY) as string
    expect(raw).not.toMatch(/refresh/i)
    expect(raw).not.toMatch(/password/i)
  })

  it('names the storage key without any credential, token or role in it', () => {
    expect(SESSION_STORAGE_KEY).toBe('pacco.session')
    expect(SESSION_STORAGE_KEY).not.toMatch(/token|password|admin|user|bearer/i)
  })

  it('swallows a storage quota failure rather than surfacing a technical error', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => SessionStore.write(LIVE_SESSION)).not.toThrow()
  })
})

describe('SessionStore.read', () => {
  it('returns null when nothing is stored', () => {
    expect(SessionStore.read()).toBeNull()
  })

  it('returns null when the stored value is not JSON', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, 'not json')
    expect(SessionStore.read()).toBeNull()
  })

  it('returns null when the stored value is not an object', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, '7')
    expect(SessionStore.read()).toBeNull()
  })

  it.each([
    ['a missing accessToken', { role: 'user', expiresAt: 1 }],
    ['an empty accessToken', { accessToken: '', role: 'user', expiresAt: 1 }],
    ['a missing role', { accessToken: 'a.b.c', expiresAt: 1 }],
    ['a non-integer expiresAt', { accessToken: 'a.b.c', role: 'user', expiresAt: 'soon' }],
    ['a missing expiresAt', { accessToken: 'a.b.c', role: 'user' }],
  ])('returns null for a record with %s', (_label, record) => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(record))
    expect(SessionStore.read()).toBeNull()
  })

  it('returns null when reading from storage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(SessionStore.read()).toBeNull()
  })
})

describe('SessionStore.clear', () => {
  it('discards the stored session', () => {
    SessionStore.write(LIVE_SESSION)
    SessionStore.clear()
    expect(SessionStore.read()).toBeNull()
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('swallows a removal failure', () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => SessionStore.clear()).not.toThrow()
  })
})

describe('SessionStore.isLive', () => {
  it('is false for no session', () => {
    expect(SessionStore.isLive(null)).toBe(false)
  })

  it('is true while the exp claim is in the future', () => {
    expect(SessionStore.isLive({ ...LIVE_SESSION, expiresAt: 2_000 }, 1_000_000)).toBe(true)
  })

  it('is false once the exp claim has passed', () => {
    expect(SessionStore.isLive({ ...LIVE_SESSION, expiresAt: 1_000 }, 1_000_000)).toBe(false)
  })

  it('is false exactly at the expiry instant', () => {
    expect(SessionStore.isLive({ ...LIVE_SESSION, expiresAt: 1_000 }, 1_000_000)).toBe(false)
  })

  it('defaults to the current clock', () => {
    expect(
      SessionStore.isLive({ ...LIVE_SESSION, expiresAt: Math.floor(Date.now() / 1000) + 60 }),
    ).toBe(true)
    expect(
      SessionStore.isLive({ ...LIVE_SESSION, expiresAt: Math.floor(Date.now() / 1000) - 60 }),
    ).toBe(false)
  })
})

describe('SessionStore when storage is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')

  afterEach(() => {
    if (descriptor !== undefined) {
      Object.defineProperty(window, 'sessionStorage', descriptor)
    }
  })

  it('degrades to a no-op rather than throwing', () => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('storage disabled in this browsing context')
      },
    })
    expect(() => SessionStore.write(LIVE_SESSION)).not.toThrow()
    expect(SessionStore.read()).toBeNull()
    expect(() => SessionStore.clear()).not.toThrow()
  })
})
