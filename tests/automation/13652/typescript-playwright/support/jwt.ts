/**
 * Synthetic JSON Web Tokens for the stubbed rows.
 *
 * These are unsigned fixtures minted inside the test process. The client never
 * verifies a signature - it only reads `exp` from the payload - so a fixture
 * needs no key material, and none is committed.
 *
 * 🚫 No token here is, or has ever been, a real credential.
 */

const FIXTURE_SIGNATURE = 'fixture-signature-not-a-real-mac'

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

export interface TokenOptions {
  /** Seconds since the epoch. Omit to leave `exp` out of the payload entirely. */
  readonly expSeconds?: number
  /** Role claim, when the fixture needs one. The client reads role from the body. */
  readonly role?: string
  /** Anything else the payload should carry, e.g. a canary. */
  readonly claims?: Record<string, unknown>
  /** Replaces the whole payload, for the deliberately broken fixtures. */
  readonly rawPayload?: string
  /** Number of dot-separated segments to emit. Defaults to three. */
  readonly segments?: number
}

/** Mints a well-formed, unsigned fixture token. */
export function mintAccessToken(options: TokenOptions = {}): string {
  const header = encodeSegment({ alg: 'HS256', typ: 'JWT' })

  const payload =
    options.rawPayload ??
    encodeSegment({
      sub: 'pacco-fixture-subject',
      ...(options.expSeconds === undefined ? {} : { exp: options.expSeconds }),
      ...(options.role === undefined ? {} : { role: options.role }),
      ...(options.claims ?? {}),
    })

  const parts = [header, payload, FIXTURE_SIGNATURE]
  const segments = options.segments ?? 3
  return parts.slice(0, segments).join('.')
}

/** Seconds since the epoch, offset by `deltaSeconds`. */
export function epochSeconds(deltaSeconds = 0): number {
  return Math.floor(Date.now() / 1000) + deltaSeconds
}

/**
 * Reads `exp` the way the client does: no library, integers only, and `null`
 * for anything it cannot use. Kept deliberately parallel to
 * `src/session/jwt.ts` so an assertion failure means the client changed.
 */
export function readAccessTokenExpiry(accessToken: string): number | null {
  const segments = accessToken.split('.')
  if (segments.length < 2) {
    return null
  }
  const payloadSegment = segments[1]
  if (payloadSegment === undefined || payloadSegment === '') {
    return null
  }
  try {
    const payload: unknown = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'))
    if (typeof payload !== 'object' || payload === null) {
      return null
    }
    const exp = (payload as { exp?: unknown }).exp
    return typeof exp === 'number' && Number.isInteger(exp) ? exp : null
  } catch {
    return null
  }
}

/**
 * The five unusable tokens TC-037 enumerates, in the CSV's own order. Each one
 * must produce the generic message and no session, and must never make the
 * client fall back to the response body's `expires` field.
 */
export function unusableTokens(): ReadonlyArray<{
  readonly label: string
  readonly token: string
}> {
  return [
    { label: 'a single segment', token: mintAccessToken({ segments: 1 }) },
    {
      label: 'a payload that is not valid base64',
      token: mintAccessToken({ rawPayload: 'not-base64-@@@@' }),
    },
    { label: 'a payload with no exp claim', token: mintAccessToken({ role: 'user' }) },
    {
      label: 'exp carrying the string "soon"',
      token: mintAccessToken({ rawPayload: encodeSegment({ exp: 'soon', role: 'user' }) }),
    },
    {
      label: 'a negative exp',
      token: mintAccessToken({ rawPayload: encodeSegment({ exp: -1, role: 'user' }) }),
    },
  ]
}
