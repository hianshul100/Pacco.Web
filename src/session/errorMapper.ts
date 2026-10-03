/**
 * ErrorMapper -- pure, total, and structurally unable to leak a backend string.
 *
 * ADR-023 §5: "`Pacco.Web` selects every user-facing failure message from a
 * fixed, closed set, keyed on the response's `code` field. The `reason` field
 * and the HTTP status are never rendered, never logged to a user-visible surface
 * and never attached to telemetry."
 *
 * The input type is the enforcement mechanism. `SignInOutcomeDescriptor` carries
 * a bucket and -- for HTTP 400 only -- the `code` string. It has no field for
 * `reason`, for the status line, for a header or for the response text, so per
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 3 this module "structurally cannot
 * leak `reason`".
 */
import type { MessageKey } from './messageRegistry'

/**
 * The failure buckets, in the precedence order of
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 5 step 19.
 *
 * ⚠️ There is deliberately no `unauthorized` bucket. `identity-service` returns
 * HTTP 400 for wrong credentials, never 401 (§L.3 item 6, Q1 answered), so
 * `if (status === 401)` would be dead code and is not written.
 */
export type OutcomeBucket =
  /** No response reached the browser: network failure, CORS refusal, or timeout. */
  | 'transport'
  /** HTTP 400 -- an authentication outcome, per ADR-023 §5 rule 5. */
  | 'http_400'
  /** Any other non-success status. */
  | 'other_status'
  /** HTTP 200 whose body could not be used: unparseable, or missing a required field. */
  | 'malformed'

export interface SignInOutcomeDescriptor {
  readonly bucket: OutcomeBucket
  /**
   * The `code` field of a parsed HTTP 400 body, when one was present and usable.
   * Absent for every other bucket. 🚫 `reason` is never copied into this type.
   */
  readonly code?: string
}

/**
 * The telemetry classification for `login.failed`.
 * Matches SPECIFICATION.md §11.2's documented `outcome` vocabulary. These are
 * client-owned constants, not backend strings.
 */
export type FailureClassification =
  'invalid_credentials' | 'unavailable' | 'malformed' | 'unexpected'

export interface MappedFailure {
  readonly messageKey: MessageKey
  readonly classification: FailureClassification
}

/**
 * The closed set of `code` values the client recognises.
 * ADR-023 §5.1: both resolve to the same message so account existence is not
 * disclosed.
 */
const RECOGNISED_CODES: ReadonlySet<string> = new Set(['invalid_credentials', 'invalid_email'])

export function mapOutcome(descriptor: SignInOutcomeDescriptor): MappedFailure {
  switch (descriptor.bucket) {
    case 'transport':
      // SPECIFICATION.md §5.7 EF-3, EF-4, EF-6.
      return { messageKey: 'unavailable', classification: 'unavailable' }

    case 'http_400':
      // ADR-023 §5 rule 1: `code` is the only field a failure decision may read.
      if (descriptor.code !== undefined && RECOGNISED_CODES.has(descriptor.code)) {
        return { messageKey: 'credentials', classification: 'invalid_credentials' }
      }
      // ADR-023 §5 rule 4: unknown resolves to generic, by construction. The
      // unrecognised code is never rendered in its place.
      return { messageKey: 'generic', classification: 'unexpected' }

    case 'malformed':
      // SPECIFICATION.md §5.7 EF-5. No session is written on this path.
      return { messageKey: 'generic', classification: 'malformed' }

    case 'other_status':
      // SPECIFICATION.md §5.7 EF-7.
      return { messageKey: 'generic', classification: 'unexpected' }
  }
}

export const ErrorMapper = { mapOutcome }
