/**
 * useSignIn -- the sole caller of the identity sign-in capability and the owner
 * of the submit lock.
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 3: this hook owns
 * `{status, message, correlationId}` with `status ∈ {idle, submitting}`, and it
 * is the only module that calls `SessionStore.write()` (§L.6.A.4 NEG-6 asserts
 * the single call site).
 *
 * 🚫 The password is a parameter of `submit` and nothing else. It is never
 * placed in state, in a ref, in telemetry, in diagnostics or in storage --
 * ADR-021 §8 N1 and §L.7.2 rule 3.
 */
import { useCallback, useRef, useState } from 'react'

import type { GatewayClient } from '@/gateway/gatewayClient'
import { newCorrelationId } from '@/platform/correlation'
import { Diagnostics } from '@/platform/diagnostics'
import { Telemetry } from '@/platform/telemetry'
import type { SignInOutcomeDescriptor } from '@/session/errorMapper'
import { ErrorMapper } from '@/session/errorMapper'
import { readAccessTokenExpiry } from '@/session/jwt'
import type { MessageKey } from '@/session/messageRegistry'
import { messageFor } from '@/session/messageRegistry'
import { SessionStore } from '@/session/sessionStore'

export type SignInStatus = 'idle' | 'submitting'

/** What `submit` reports back to `LoginRoute` so it can steer the UI. */
export type SignInResult =
  | { readonly outcome: 'success' }
  | { readonly outcome: 'failure' }
  /** The lock was already held; no request was made. */
  | { readonly outcome: 'suppressed' }

export interface UseSignIn {
  readonly status: SignInStatus
  /** The single message currently shown, or `null`. Replaced, never stacked. */
  readonly message: string | null
  readonly correlationId: string | null
  submit(identifier: string, password: string): Promise<SignInResult>
  clearMessage(): void
}

/** Narrows the 200 body to the two fields the client is allowed to require. */
function readAuthDto(
  body: unknown,
): { accessToken: string; role: string; expires?: number } | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const candidate = body as { accessToken?: unknown; role?: unknown; expires?: unknown }
  // §L.3 item 5 step 14: assert `accessToken` and `role` are present, non-empty
  // strings; otherwise reclassify as malformed.
  if (typeof candidate.accessToken !== 'string' || candidate.accessToken.length === 0) {
    return null
  }
  if (typeof candidate.role !== 'string' || candidate.role.length === 0) {
    return null
  }
  return {
    accessToken: candidate.accessToken,
    role: candidate.role,
    // Diagnostics only. No logic reads it -- ADR-022 §5 rule 2.
    ...(typeof candidate.expires === 'number' ? { expires: candidate.expires } : {}),
  }
  // 🚫 `refreshToken` is deliberately not read here. ADR-022 §5 rule 1: it is
  // "not read into any variable that outlives the sign-in response handler" --
  // in this implementation it is not read into any variable at all.
}

/** Reads the `code` of a parsed HTTP 400 body. 🚫 `reason` is never copied. */
function readFailureCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined
  }
  const code = (body as { code?: unknown }).code
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

export function useSignIn(client: GatewayClient): UseSignIn {
  const [status, setStatus] = useState<SignInStatus>('idle')
  const [messageKey, setMessageKey] = useState<MessageKey | null>(null)
  const [correlationId, setCorrelationId] = useState<string | null>(null)

  /**
   * The lock is a ref, not state: FR-4 / BR-4 require that a second activation
   * arriving in the same tick -- before React has re-rendered with the disabled
   * control -- is still suppressed. `inFlightCorrelationId.current` is both the
   * lock and the id reported on `login.duplicate_suppressed`.
   */
  const inFlightCorrelationId = useRef<string | null>(null)

  const clearMessage = useCallback(() => {
    setMessageKey(null)
  }, [])

  const submit = useCallback(
    async (identifier: string, password: string): Promise<SignInResult> => {
      // §L.3 item 5 step 11: attempt the lock. If it is already held, emit and
      // return WITHOUT issuing a request.
      if (inFlightCorrelationId.current !== null) {
        Telemetry.emit({
          name: 'login.duplicate_suppressed',
          correlationId: inFlightCorrelationId.current,
        })
        return { outcome: 'suppressed' }
      }

      const thisCorrelationId = newCorrelationId()
      inFlightCorrelationId.current = thisCorrelationId
      setStatus('submitting')
      setCorrelationId(thisCorrelationId)
      setMessageKey(null)
      // §L.3 item 5 step 12: no field value is carried on this event.
      Telemetry.emit({ name: 'login.submitted', correlationId: thisCorrelationId })

      const fail = (descriptor: SignInOutcomeDescriptor): SignInResult => {
        const mapped = ErrorMapper.mapOutcome(descriptor)
        setMessageKey(mapped.messageKey)
        Telemetry.emit({
          name: 'login.failed',
          correlationId: thisCorrelationId,
          classification: mapped.classification,
        })
        Diagnostics.noteFailure({
          stage: 'sign-in',
          classification: mapped.classification,
          correlationId: thisCorrelationId,
        })
        return { outcome: 'failure' }
      }

      try {
        // The identifier goes into `email` verbatim, untrimmed of case.
        const response = await client.signIn({ email: identifier, password })

        // §L.3 item 5 step 19 precedence: transport first.
        if (response.kind === 'transport_failure') {
          return fail({ bucket: 'transport' })
        }
        if (response.status === 400) {
          // ADR-023 §5 rule 5: HTTP 400 from this route is an authentication
          // outcome, not a client-side input defect.
          const code = readFailureCode(response.body)
          return fail(code === undefined ? { bucket: 'http_400' } : { bucket: 'http_400', code })
        }
        if (response.status !== 200) {
          return fail({ bucket: 'other_status' })
        }

        const auth = readAuthDto(response.body)
        if (auth === null) {
          return fail({ bucket: 'malformed' })
        }

        // §L.3 item 5 step 15 / ADR-022 §5 rule 2: expiry comes from the token's
        // own `exp` claim, never from `AuthDto.expires`. An unreadable claim is
        // a malformed response and no session is written.
        const expiresAt = readAccessTokenExpiry(auth.accessToken)
        if (expiresAt === null) {
          return fail({ bucket: 'malformed' })
        }

        // The ONLY call site of SessionStore.write() in the application.
        SessionStore.write({
          accessToken: auth.accessToken,
          role: auth.role,
          expiresAt,
          ...(auth.expires === undefined ? {} : { expiresRaw: auth.expires }),
        })

        Telemetry.emit({ name: 'login.succeeded', correlationId: thisCorrelationId })
        return { outcome: 'success' }
      } catch {
        // A thrown value from an unexpected source is still a row in the error
        // table: it is classified, never rendered.
        return fail({ bucket: 'transport' })
      } finally {
        // §L.3 item 8 invariant 2: the lock is released on EVERY row, on the
        // settle path rather than in the success branch.
        inFlightCorrelationId.current = null
        setStatus('idle')
      }
    },
    [client],
  )

  return {
    status,
    message: messageKey === null ? null : messageFor(messageKey),
    correlationId,
    submit,
    clearMessage,
  }
}
