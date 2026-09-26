/**
 * Access-token `exp` claim reading.
 *
 * ⚠️ This is a few lines of payload decoding, NOT a signature verification and
 * NOT a trust decision. LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 5 step 15:
 * "decode the access-token payload segment and read `exp` as an integer (this is
 * not a signature verification)". Authentication is enforced at the edge per
 * ADR-006; nothing here grants anything.
 *
 * 🚫 No JWT library is added. LOW_LEVEL_SPEC-13652-wave-1.md §L.7.2 rule 4:
 * "no dependency is added for authentication, session handling, JWT
 * parsing-for-trust, or error presentation."
 *
 * ADR-022 §5 rule 2: "Session expiry is derived from the JWT `exp` claim, not
 * from the response's `expires` field ... A token whose `exp` claim cannot be
 * parsed is treated as a malformed response and no session is written."
 */

/** Decodes one base64url segment to a UTF-8 string, or null if undecodable. */
function decodeBase64UrlSegment(segment: string): string | null {
  if (segment.length === 0) {
    return null
  }
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  try {
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/**
 * Reads the `exp` claim as seconds since epoch (RFC 7519 NumericDate).
 *
 * Returns `null` for anything that is not a token with a parseable integer
 * `exp`; the caller must then classify the response as malformed and write no
 * session.
 */
export function readAccessTokenExpiry(accessToken: string): number | null {
  if (typeof accessToken !== 'string') {
    return null
  }
  const segments = accessToken.split('.')
  if (segments.length < 2) {
    return null
  }

  const payloadJson = decodeBase64UrlSegment(segments[1])
  if (payloadJson === null) {
    return null
  }

  let payload: unknown
  try {
    payload = JSON.parse(payloadJson)
  } catch {
    return null
  }
  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const exp = (payload as { exp?: unknown }).exp
  // RFC 7519 fixes `exp` as a NumericDate -- seconds since epoch. A non-integer
  // or absent claim is malformed; it is never coerced into a usable number.
  if (typeof exp !== 'number' || !Number.isInteger(exp)) {
    return null
  }
  return exp
}
