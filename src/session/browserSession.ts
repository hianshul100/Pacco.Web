/**
 * The browser session record.
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 4 fixes these four fields and only
 * these four.
 *
 * 🚫 `refreshToken` is NOT a field here and is never assigned to a variable that
 * outlives the sign-in response handler -- ADR-022 §5 rule 1: "The refresh token
 * is discarded unread. It is not written to browser storage, not held in the
 * session object, and not read into any variable that outlives the sign-in
 * response handler. The platform issues it; the browser client declines it."
 */
export interface BrowserSession {
  /**
   * The access token. Never logged, never placed in a URL, never rendered --
   * ADR-021 §8 N1.
   */
  readonly accessToken: string
  /**
   * The role exactly as `AuthDto.role` supplied it, lower-cased on write.
   *
   * ⚠️ Stored as received after lower-casing and NEVER normalised into the
   * closed vocabulary. `identity-service`'s `Role.cs` declares `user` and
   * `admin`; an unrecognised value is kept verbatim so that the wave-2 role
   * decision can reject it rather than silently promote it. No role is ever
   * inferred from an email address or a username -- ADR-021 §8 N4.
   */
  readonly role: string
  /**
   * Seconds since epoch, from the access token's own `exp` claim (RFC 7519).
   *
   * Liveness only -- it grants nothing. Authorisation is enforced at the edge
   * per ADR-006.
   */
  readonly expiresAt: number
  /**
   * `AuthDto.expires`, carried for diagnostics only.
   *
   * ⚠️ Its unit is unverified (ADR-022 §5 rule 2: the unit "originates inside a
   * package with no source in this workspace and cannot be verified here"), so
   * no logic reads it. It exists to make a future unit investigation possible.
   */
  readonly expiresRaw?: number
}
