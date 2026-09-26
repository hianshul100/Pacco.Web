/**
 * SessionStore -- the only writer, reader and clearer of the browser session.
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 3 boundary rule: `SessionStore.write()`
 * is called from `useSignIn` and nowhere else, and only with a parsed HTTP 200.
 * §L.6.A.4 NEG-6 asserts that single call site.
 *
 * Implemented in FULL in wave-1 (`write`/`read`/`clear`/`isLive`) including the
 * operations only wave-2 consumes, per §L.2.2.
 *
 * Storage choice (§L.14 Q5): `sessionStorage` under a single key. One access
 * point, scoped to the tab, cleared when the tab closes. The record holds no
 * password and no refresh token.
 *
 * ADR-021 §8 N1: no credential value is written to browser storage. The stored
 * access token is the bearer credential the edge issued, and it is the only
 * token-shaped value here; the password never reaches this module.
 */
import type { BrowserSession } from './browserSession'

/**
 * The single storage key. It names the record, not its contents -- no
 * credential, token or role appears in the key itself.
 */
export const SESSION_STORAGE_KEY = 'pacco.session'

function storage(): Storage | null {
  try {
    // Access can throw in a sandboxed or storage-disabled browsing context.
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Persists the session.
 *
 * ⚠️ `role` is lower-cased here and nowhere else, per §L.3 item 5 step 16. It is
 * NOT validated against the closed vocabulary: an unknown role is stored as
 * received so wave-2's role decision sees the truth.
 */
export function write(session: BrowserSession): void {
  const store = storage()
  if (store === null) {
    return
  }
  const record: BrowserSession = {
    accessToken: session.accessToken,
    role: session.role.toLowerCase(),
    expiresAt: session.expiresAt,
    ...(typeof session.expiresRaw === 'number' ? { expiresRaw: session.expiresRaw } : {}),
  }
  try {
    store.setItem(SESSION_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // A full or unavailable quota must not surface a technical error to the
    // user; the caller's outcome is unchanged.
  }
}

/** Returns the stored session, or `null` if absent or unusable. */
export function read(): BrowserSession | null {
  const store = storage()
  if (store === null) {
    return null
  }

  let raw: string | null = null
  try {
    raw = store.getItem(SESSION_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }

  const candidate = parsed as Partial<BrowserSession>
  if (!isNonEmptyString(candidate.accessToken) || !isNonEmptyString(candidate.role)) {
    return null
  }
  if (typeof candidate.expiresAt !== 'number' || !Number.isInteger(candidate.expiresAt)) {
    return null
  }

  return {
    accessToken: candidate.accessToken,
    role: candidate.role,
    expiresAt: candidate.expiresAt,
    ...(typeof candidate.expiresRaw === 'number' ? { expiresRaw: candidate.expiresRaw } : {}),
  }
}

/** Discards the session. This is the whole of logout -- see the note below. */
export function clear(): void {
  const store = storage()
  if (store === null) {
    return
  }
  try {
    store.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Nothing further to do; the in-memory session is already unreachable.
  }
}

/**
 * Liveness check against the token's own `exp` claim.
 *
 * ADR-022 §5 rule 3: "Expiry is evaluated on every route-guard decision, not
 * only on a timer." 🚫 No background timer, no renewal, no retry-on-401
 * renewal -- ADR-022 §5 rule 5.
 *
 * ⚠️ Liveness is a UI decision only. It grants nothing: the edge validates the
 * token independently (ADR-006).
 *
 * ⚠️ Stated limitation, recorded rather than hidden -- ADR-022 §5 rule 1 /
 * ADR-021 §5 rule 5: discarding the session does NOT invalidate the
 * already-issued token at the platform level. It remains acceptable to the
 * gateway and to the domain services until it expires. No logout or revocation
 * route is added at the edge and the gateway's JWT validation and revocation
 * behaviour are unchanged.
 */
export function isLive(session: BrowserSession | null, nowMs: number = Date.now()): boolean {
  if (session === null) {
    return false
  }
  return session.expiresAt * 1000 > nowMs
}

export const SessionStore = { write, read, clear, isLive, SESSION_STORAGE_KEY }
