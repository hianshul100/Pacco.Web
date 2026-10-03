/**
 * Sign-in edge stubs.
 *
 * The offline rows describe the platform's response precisely - a 400 carrying
 * a particular code, a 200 whose token has no `exp`, a connection reset
 * mid-response - so they are driven against a stubbed gateway rather than a
 * live one. Every stub answers only `POST <gateway>/identity/sign-in`; any
 * other backend address reaching a stub would itself be a finding, so the
 * traffic recorder still sees and counts it.
 *
 * Stubs mirror the gateway's cross-origin behaviour (an allowed-origin header
 * echoing the client's exact origin, credentials NOT enabled for this
 * anonymous route) so the browser treats a stubbed response the way it would
 * treat the real one.
 */
import type { Page, Route } from '@playwright/test'

import { readEnvConfig } from './env'
import { epochSeconds, mintAccessToken } from './jwt'
import { holdResponse } from './responseDelay'

export type TransportFault = 'connectionrefused' | 'connectionreset' | 'namenotresolved'

export interface SuccessBodyOptions {
  readonly role?: string
  readonly accessToken?: string
  readonly refreshToken?: string
  /**
   * The response's own `expires` field. Deliberately independent of the
   * token's `exp` so TC-023 and TC-037 can prove the client reads the token.
   */
  readonly expires?: number
  /** Seconds ahead of now for the token's `exp`. Defaults to 3600 (TC-023). */
  readonly expiresInSeconds?: number
  /** Extra claims to embed in the minted token. */
  readonly claims?: Record<string, unknown>
}

export interface SignInSuccessBody {
  readonly accessToken: string
  readonly refreshToken: string
  readonly role: string
  readonly expires: number
}

/** Builds the success payload the contract in TC-018 specifies. */
export function successBody(options: SuccessBodyOptions = {}): SignInSuccessBody {
  const env = readEnvConfig()
  const expSeconds = epochSeconds(options.expiresInSeconds ?? 3600)
  return {
    accessToken:
      options.accessToken ??
      mintAccessToken({
        expSeconds,
        role: options.role ?? 'user',
        ...(options.claims === undefined ? {} : { claims: options.claims }),
      }),
    refreshToken: options.refreshToken ?? env.canaries.refreshToken,
    role: options.role ?? 'user',
    // Intentionally NOT the token's exp: a client that reads this field
    // instead of the token is exactly what TC-023 and TC-037 look for.
    expires: options.expires ?? epochSeconds(7200),
  }
}

/** The `{ code, reason }` body shape, with absent fields genuinely absent. */
function rejectionPayload(code: string | null, reason?: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (code !== null) {
    payload['code'] = code
  }
  if (reason !== undefined) {
    payload['reason'] = reason
  }
  return payload
}

export interface SignInStub {
  /** How many times the stub answered. */
  count(): number
  /** Request bodies the stub received, newest last. */
  bodies(): readonly string[]
  /** Origin headers the stub saw. */
  origins(): readonly (string | undefined)[]
  /** Replaces the active handler. Later calls win. */
  respondWith(handler: (route: Route) => Promise<void> | void): Promise<void>
  /** 200 carrying a well-formed session. */
  succeed(options?: SuccessBodyOptions): Promise<SignInSuccessBody>
  /** 200 held open for `delayMs` before it is fulfilled. */
  succeedSlowly(delayMs: number, options?: SuccessBodyOptions): Promise<SignInSuccessBody>
  /** 200 whose body is exactly `body`, verbatim, however malformed. */
  succeedWithRawBody(body: string): Promise<void>
  /** 400 carrying `{ code, reason }` the way the platform does. */
  rejectWith(code: string | null, reason?: string): Promise<void>
  /**
   * 400 held open for `delayMs` before it is answered.
   *
   * TC-127 needs a *settled* outcome that leaves the sign-in screen mounted:
   * a held success unmounts it on arrival, so the row's last step - "both
   * fields are editable again" - would have nothing left to observe.
   */
  rejectSlowly(delayMs: number, code: string | null, reason?: string): Promise<void>
  /** 400 whose body is exactly `body`. */
  rejectWithRawBody(body: string): Promise<void>
  /** Any status, with an optional body. */
  respondWithStatus(status: number, body?: string): Promise<void>
  /** Refuses, resets or fails to resolve, optionally after a delay. */
  fail(fault?: TransportFault, delayMs?: number): Promise<void>
  /** Stops intercepting entirely. */
  dispose(): Promise<void>
  /** Forgets the recorded count and bodies. */
  reset(): void
}

/**
 * Installs a stub on the sign-in address. Call before the navigation that
 * triggers the request; `respondWith` and the shorthands can be called at any
 * later point to change the answer.
 */
export async function stubSignIn(page: Page): Promise<SignInStub> {
  const env = readEnvConfig()

  let count = 0
  const bodies: string[] = []
  const origins: (string | undefined)[] = []

  let handler: (route: Route) => Promise<void> | void = async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders(env.webBaseUrl),
      body: JSON.stringify(successBody()),
    })
  }

  await page.route(env.signInUrl, async (route) => {
    const request = route.request()
    // Pre-flight is answered without counting: it is the browser's request,
    // not the application's.
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: preflightHeaders(env.webBaseUrl) })
      return
    }
    count += 1
    bodies.push(request.postData() ?? '')
    origins.push(request.headers()['origin'])
    await handler(route)
  })

  const setHandler = async (next: (route: Route) => Promise<void> | void): Promise<void> => {
    handler = next
    return Promise.resolve()
  }

  const json = (status: number, body: string) => async (route: Route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: corsHeaders(env.webBaseUrl),
      body,
    })
  }

  return {
    count: () => count,
    bodies: () => bodies,
    origins: () => origins,
    respondWith: setHandler,

    succeed: async (options) => {
      const body = successBody(options)
      await setHandler(json(200, JSON.stringify(body)))
      return body
    },

    succeedSlowly: async (delayMs, options) => {
      const body = successBody(options)
      await setHandler(async (route) => {
        await holdResponse(delayMs)
        await json(200, JSON.stringify(body))(route)
      })
      return body
    },

    succeedWithRawBody: async (body) => setHandler(json(200, body)),

    rejectWith: async (code, reason) =>
      setHandler(json(400, JSON.stringify(rejectionPayload(code, reason)))),

    rejectSlowly: async (delayMs, code, reason) => {
      const body = JSON.stringify(rejectionPayload(code, reason))
      await setHandler(async (route) => {
        await holdResponse(delayMs)
        await json(400, body)(route)
      })
    },

    rejectWithRawBody: async (body) => setHandler(json(400, body)),

    respondWithStatus: async (status, body) => setHandler(json(status, body ?? '')),

    fail: async (fault = 'connectionrefused', delayMs = 0) =>
      setHandler(async (route) => {
        if (delayMs > 0) {
          await holdResponse(delayMs)
        }
        await route.abort(fault)
      }),

    dispose: async () => {
      await page.unroute(env.signInUrl)
    },

    reset: () => {
      count = 0
      bodies.length = 0
      origins.length = 0
    },
  }
}

/**
 * The cross-origin headers the gateway sends for this anonymous route: the
 * caller's exact origin, never a wildcard, and credentials NOT enabled.
 */
export function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    'access-control-allow-origin': allowedOrigin,
    vary: 'Origin',
  }
}

export function preflightHeaders(allowedOrigin: string): Record<string, string> {
  return {
    ...corsHeaders(allowedOrigin),
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
  }
}

/**
 * The five malformed success bodies TC-036 enumerates, in the CSV's order.
 * Each must produce the generic message and leave no session behind.
 */
export function malformedSuccessBodies(): ReadonlyArray<{
  readonly label: string
  readonly body: string
}> {
  const complete = successBody({ role: 'user' })
  return [
    {
      label: 'the token absent',
      body: JSON.stringify({
        refreshToken: complete.refreshToken,
        role: 'user',
        expires: complete.expires,
      }),
    },
    { label: 'the token empty', body: JSON.stringify({ ...complete, accessToken: '' }) },
    {
      label: 'the role absent',
      body: JSON.stringify({
        accessToken: complete.accessToken,
        refreshToken: complete.refreshToken,
        expires: complete.expires,
      }),
    },
    { label: 'a body that is not valid JSON', body: '{"accessToken": ' },
    { label: 'a JSON array', body: JSON.stringify([complete]) },
  ]
}

/** The unmapped platform codes TC-030 enumerates. */
export const UNMAPPED_FAILURE_CODES = ['error', 'account_locked', 'some_future_code'] as const

/**
 * One unrecognised platform code, for the rows that sweep telemetry for "the
 * platform's error code".
 *
 * 🚫 Deliberately NOT `invalid_credentials`. That string is both a code the
 * platform sends and a bounded classification label the client is *required*
 * to record (TC-116), so a substring sweep for it cannot tell a leak from
 * correct behaviour and would fail the wrong way round. A code the client's
 * mapping does not recognise appears in telemetry only if it leaked.
 */
export const UNRECOGNISED_PLATFORM_CODE: string = UNMAPPED_FAILURE_CODES[1]

/** The server-side statuses TC-033 enumerates. */
export const SERVER_ERROR_STATUSES = [500, 502, 503, 504] as const

/** The transport faults TC-034 enumerates, in CSV order. */
export const TRANSPORT_FAULTS: ReadonlyArray<{
  readonly label: string
  readonly fault: TransportFault
}> = [
  { label: 'the connection refused', fault: 'connectionrefused' },
  { label: 'the name failing to resolve', fault: 'namenotresolved' },
  { label: 'the connection reset mid-response', fault: 'connectionreset' },
]
