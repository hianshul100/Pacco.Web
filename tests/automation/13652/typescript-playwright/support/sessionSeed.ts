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
    accessToken: options.accessToken ?? mintAccessToken({ expSeconds: expiresAt, role: options.role }),
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
