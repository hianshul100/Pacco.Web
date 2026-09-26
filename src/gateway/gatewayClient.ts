/**
 * GatewayClient -- the only holder of `gatewayBaseUrl` and the only network
 * caller in the client.
 *
 * ADR-021 §5 rule 3: "The browser reaches the platform only through the edge.
 * `Pacco.Web` is configured with the single local gateway URL
 * `http://localhost:5000` -- not with per-service URLs and not with container
 * ports. No browser code addresses `identity-service` or any other service
 * directly."
 *
 * 🚫 No dependency is added for this: the platform's built-in `fetch` primitive
 * is used, per LOW_LEVEL_SPEC-13652-wave-1.md §L.12.4 and §L.7.2 rule 4.
 * 🚫 No retry, no backoff, no circuit breaker, no client-side lockout or attempt
 * counter -- §L.3 item 8 ("resilience is deliberately thin"). The only
 * mechanism is the timeout.
 */
import type { AppConfig } from '@/config/appConfig'

/**
 * The edge path for sign-in, exactly as the gateway declares it
 * (`ntrada.yml`: module `identity`, upstream `/sign-in`, `auth: false`,
 * downstream `identity-service/sign-in`).
 */
export const SIGN_IN_PATH = '/identity/sign-in'

/** The request body -- exactly two keys and no other, per §L.6.A.2 case 13. */
export interface SignInRequest {
  readonly email: string
  readonly password: string
}

export type GatewayResponse =
  /** A response reached the browser. */
  | { readonly kind: 'response'; readonly status: number; readonly body: unknown }
  /** No response reached the browser: network failure, CORS refusal, or timeout. */
  | { readonly kind: 'transport_failure' }

export interface GatewayClient {
  signIn(request: SignInRequest): Promise<GatewayResponse>
}

/**
 * Builds the client from the injected configuration. The base URL lives in this
 * closure and nowhere else in the application.
 */
export function createGatewayClient(config: AppConfig): GatewayClient {
  const { gatewayBaseUrl, signInTimeoutMs } = config

  async function post(path: string, body: unknown): Promise<GatewayResponse> {
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), signInTimeoutMs)

    try {
      const response = await fetch(`${gatewayBaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        // 🚫 No credentials mode and no cookie: the sign-in route is
        // `auth: false` at the edge and this request carries no ambient
        // authority -- §L.3 item 5 step 13.
        // 🚫 The browser-generated correlation id is NOT sent as a header
        // (§L.3 item 9, Q4), so no header is added here.
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      // A non-JSON or empty body is not a failure to read here; the caller
      // classifies it. `body` stays `unknown` so no field can be read by
      // accident.
      let parsed: unknown = undefined
      try {
        parsed = await response.json()
      } catch {
        parsed = undefined
      }

      return { kind: 'response', status: response.status, body: parsed }
    } catch {
      // Network failure, CORS preflight refusal, and timeout abort all land
      // here and are indistinguishable to the browser by design. The thrown
      // value is discarded unread -- it must not reach the DOM or telemetry
      // (§L.3 item 8 invariant 4).
      return { kind: 'transport_failure' }
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  return {
    signIn(request: SignInRequest): Promise<GatewayResponse> {
      // The body is built here with exactly the two contract keys. The
      // identifier goes into `email` verbatim, untrimmed of case
      // (§L.3 item 5 step 13).
      return post(SIGN_IN_PATH, { email: request.email, password: request.password })
    },
  }
}
