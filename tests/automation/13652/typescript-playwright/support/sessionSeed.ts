/**
 * Seeding a browser session directly.
 *
 * The guard, expiry and role rows need a session in a precise state - expired
 * by exactly one second, corrupted in a specific way, carrying a role the
 * platform would never issue. Driving each of those through a real sign-in
 * would be slower and, for the corrupted cases, impossible. So they are
 * written straight into the storage area the client reads.
 *
 * TC-106 is the deliberate counterweight: it drives the same guard through a
 * real sign-in and never seeds anything. It must keep doing so.
 *
 * Seeding happens in an init script so the value is present before the
 * application's first read, which is what makes "hard reload lands on /login"
 * a meaningful assertion.
 */
import type { Page } from '@playwright/test'

import { SESSION_STORAGE_KEY } from './expectedCopy'
import { epochSeconds, mintAccessToken } from './jwt'

export interface SeedOptions {
  readonly role: string
  /** Seconds since the epoch. Defaults to one hour ahead. */
  readonly expiresAt?: number
  /** Overrides the minted token, for the rows that need a specific one. */
  readonly accessToken?: string
}

/** The shape `src/session/sessionStore.ts` writes and reads. */
export interface SeededSession {
  readonly accessToken: string
  readonly role: string
  readonly expiresAt: number
}

export function buildSession(options: SeedOptions): SeededSession {
  const expiresAt = options.expiresAt ?? epochSeconds(3600)
  return {
    accessToken:
      options.accessToken ?? mintAccessToken({ expSeconds: expiresAt, role: options.role }),
    role: options.role,
    expiresAt,
  }
}

/**
 * Seeds a session for the client's own origin before any application code runs.
 * Returns what was written so the spec can assert against it.
 */
export async function seedSession(page: Page, options: SeedOptions): Promise<SeededSession> {
  const session = buildSession(options)
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      window.sessionStorage.setItem(key, value)
    },
    [SESSION_STORAGE_KEY, JSON.stringify(session)] as [string, string],
  )
  return session
}

/** Seeds a raw string, for the corruption rows where the value is not valid JSON. */
export async function seedRawSession(page: Page, raw: string): Promise<void> {
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      window.sessionStorage.setItem(key, value)
    },
    [SESSION_STORAGE_KEY, raw] as [string, string],
  )
}

/**
 * Makes reading the session key throw, so TC-065's "storage read throws" case
 * can be exercised. Everything else in storage keeps working.
 */
export async function makeSessionReadThrow(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    const original = window.sessionStorage.getItem.bind(window.sessionStorage)
    window.sessionStorage.getItem = (requested: string): string | null => {
      if (requested === key) {
        throw new DOMException('Storage read denied by test fixture', 'SecurityError')
      }
      return original(requested)
    }
  }, SESSION_STORAGE_KEY)
}

/** Writes a session into an already-loaded page, without reloading it. */
export async function writeSessionInPage(page: Page, options: SeedOptions): Promise<SeededSession> {
  const session = buildSession(options)
  await page.evaluate(
    ([key, value]: [string, string]) => {
      window.sessionStorage.setItem(key, value)
    },
    [SESSION_STORAGE_KEY, JSON.stringify(session)] as [string, string],
  )
  return session
}

/**
 * Makes every sessionStorage operation throw, not just the read of one key.
 *
 * TC-129's third case is a browser that refuses storage outright - a private
 * window with site data blocked, or a policy-locked profile. `read()`,
 * `write()` and `clear()` all have to survive it, so the fixture has to break
 * all three rather than only the read that `makeSessionReadThrow` targets.
 */
export async function makeStorageAccessThrow(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const refuse = (): never => {
      throw new DOMException('Storage access denied by test fixture', 'SecurityError')
    }
    const storage = window.sessionStorage
    storage.getItem = refuse
    storage.setItem = refuse
    storage.removeItem = refuse
    storage.clear = refuse
  })
}

/** The global the storage observer publishes into. */
export const STORAGE_OBSERVER_GLOBAL = '__pacco13652Storage__'

export interface StorageOperation {
  readonly area: 'session' | 'local'
  readonly op: 'set' | 'remove' | 'clear' | 'read'
  readonly key: string | null
}

export interface StorageObserver {
  /** Every recorded operation, in order. */
  all(): Promise<readonly StorageOperation[]>
  /** `setItem` calls only. */
  writes(): Promise<readonly StorageOperation[]>
  /** `removeItem` and `clear` calls only. */
  removals(): Promise<readonly StorageOperation[]>
  /** How many times the session key was read. */
  sessionReadCount(): Promise<number>
  clear(): Promise<void>
}

/**
 * Records every storage operation the application performs, before any
 * application code runs.
 *
 * Two rows need this and need it for opposite reasons. TC-130 asserts a
 * denied navigation writes *nothing* - a count of zero is only meaningful if
 * something was counting. TC-113 asserts liveness is re-evaluated on every
 * navigation rather than cached at mount, and the read count rising with each
 * navigation is the observable form of that.
 *
 * The wrappers shadow the instance methods rather than the prototype, so they
 * are scoped to this page and unwound with it.
 */
export async function installStorageObserver(page: Page): Promise<StorageObserver> {
  await page.addInitScript(
    ([globalName, sessionKey]: [string, string]) => {
      const record: Array<{ area: string; op: string; key: string | null }> = []
      Object.defineProperty(window, globalName, {
        value: { record },
        writable: false,
        configurable: false,
      })

      const observe = (storage: Storage, area: 'session' | 'local'): void => {
        const set = storage.setItem.bind(storage)
        const remove = storage.removeItem.bind(storage)
        const wipe = storage.clear.bind(storage)
        const get = storage.getItem.bind(storage)

        storage.setItem = (key: string, value: string): void => {
          record.push({ area, op: 'set', key })
          set(key, value)
        }
        storage.removeItem = (key: string): void => {
          record.push({ area, op: 'remove', key })
          remove(key)
        }
        storage.clear = (): void => {
          record.push({ area, op: 'clear', key: null })
          wipe()
        }
        storage.getItem = (key: string): string | null => {
          if (key === sessionKey) {
            record.push({ area, op: 'read', key })
          }
          return get(key)
        }
      }

      observe(window.sessionStorage, 'session')
      observe(window.localStorage, 'local')
    },
    [STORAGE_OBSERVER_GLOBAL, SESSION_STORAGE_KEY] as [string, string],
  )

  const read = async (): Promise<StorageOperation[]> =>
    page.evaluate((globalName: string) => {
      const collector = (window as unknown as Record<string, unknown>)[globalName] as
        | {
            record: Array<{
              area: 'session' | 'local'
              op: StorageOperation['op']
              key: string | null
            }>
          }
        | undefined
      return collector === undefined ? [] : collector.record.map((entry) => ({ ...entry }))
    }, STORAGE_OBSERVER_GLOBAL)

  return {
    all: read,
    writes: async () => (await read()).filter((entry) => entry.op === 'set'),
    removals: async () =>
      (await read()).filter((entry) => entry.op === 'remove' || entry.op === 'clear'),
    sessionReadCount: async () =>
      (await read()).filter((entry) => entry.op === 'read' && entry.key === SESSION_STORAGE_KEY)
        .length,
    clear: async () => {
      await page.evaluate((globalName: string) => {
        const collector = (window as unknown as Record<string, unknown>)[globalName] as
          | { record: unknown[] }
          | undefined
        if (collector !== undefined) {
          collector.record.length = 0
        }
      }, STORAGE_OBSERVER_GLOBAL)
    },
  }
}

/** Clears every storage area for the current origin. */
export async function clearAllStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      window.sessionStorage.clear()
    } catch {
      // Nothing to clear.
    }
    try {
      window.localStorage.clear()
    } catch {
      // Nothing to clear.
    }
  })
  await page.context().clearCookies()
}

/**
 * The four corrupted stored-expiry cases TC-065 enumerates, in CSV order.
 * `null` means "the key is absent"; `throws` means the read itself fails.
 */
export const CORRUPTED_EXPIRY_CASES = [
  { label: 'the word "later"', expiresAt: 'later' as const },
  { label: 'an empty string', expiresAt: '' as const },
  { label: 'the key absent', expiresAt: null },
  { label: 'a storage read that throws', expiresAt: 'throws' as const },
] as const
