import type { GatewayClient, GatewayResponse, SignInRequest } from '@/gateway/gatewayClient'

/** Encodes one base64url segment, the way a real JWT carries its payload. */
function base64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Builds a structurally realistic access token. The signature segment is
 * deliberately meaningless: the client reads the payload's `exp` claim and never
 * verifies a signature (ADR-006 leaves verification to the edge).
 */
export function accessTokenWithClaims(claims: Record<string, unknown>): string {
  return [
    base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    base64Url(JSON.stringify(claims)),
    'not-a-real-signature',
  ].join('.')
}

export function accessTokenExpiringInSeconds(seconds: number): string {
  return accessTokenWithClaims({ exp: Math.floor(Date.now() / 1000) + seconds, sub: 'subject' })
}

export interface RecordingClient extends GatewayClient {
  readonly requests: SignInRequest[]
}

/** A `GatewayClient` double that records every request and replays scripted responses. */
export function recordingClient(
  responses: GatewayResponse[] | ((request: SignInRequest) => Promise<GatewayResponse>),
): RecordingClient {
  const requests: SignInRequest[] = []
  const queue = Array.isArray(responses) ? [...responses] : null

  return {
    requests,
    async signIn(request: SignInRequest): Promise<GatewayResponse> {
      requests.push(request)
      if (queue !== null) {
        const next = queue.shift()
        if (next === undefined) {
          throw new Error('recordingClient: more requests were made than responses scripted.')
        }
        return next
      }
      return (responses as (r: SignInRequest) => Promise<GatewayResponse>)(request)
    },
  }
}

/**
 * A `GatewayClient` double whose request stays in flight until `resolveWith` is
 * called. Used to observe the submit lock while a request is pending.
 */
export function pendingClient(): RecordingClient & {
  resolveWith(response: GatewayResponse): void
} {
  let resolver: ((response: GatewayResponse) => void) | null = null
  const base = recordingClient(
    () =>
      new Promise<GatewayResponse>((resolve) => {
        resolver = resolve
      }),
  )
  return Object.assign(base, {
    resolveWith(response: GatewayResponse) {
      resolver?.(response)
    },
  })
}

export function okResponse(body: unknown): GatewayResponse {
  return { kind: 'response', status: 200, body }
}

export function statusResponse(status: number, body: unknown): GatewayResponse {
  return { kind: 'response', status, body }
}

export function transportFailure(): GatewayResponse {
  return { kind: 'transport_failure' }
}

/** A well-formed `AuthDto`, including the refresh token the client must decline. */
export function authDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    accessToken: accessTokenExpiringInSeconds(3600),
    refreshToken: 'refresh-token-value-the-client-must-never-read',
    role: 'user',
    expires: 1893456000,
    ...overrides,
  }
}
