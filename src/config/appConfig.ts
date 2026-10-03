/**
 * Application configuration -- exactly two keys, read ONCE by `AppShell`.
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 4: `gatewayBaseUrl` is "read once by
 * AppShell, never hard-coded at a call site, no per-service URL, no container
 * port anywhere"; `signInTimeoutMs` is "a named config key with a provisional
 * default, never a literal at the call site".
 *
 * Values arrive injected on `window.__PACCO_CONFIG__` from `public/pacco-config.js`
 * rather than compiled into the bundle, per ADR-008 (configuration injected, not
 * embedded).
 */

export interface AppConfig {
  /**
   * The single local API Gateway origin. Per ADR-021 §5 rule 3 the browser
   * reaches the platform only through the edge; it never addresses
   * `identity-service` or any other service directly.
   */
  readonly gatewayBaseUrl: string
  /**
   * Provisional client-side timeout for the sign-in request.
   *
   * ⚠️ NOT an SLO and not derived from one. ADR-021 §8 N8: "No numeric target is
   * set here, and none is invented." This value only bounds how long the UI
   * waits before showing the unavailable message.
   */
  readonly signInTimeoutMs: number
}

/**
 * Fallbacks used only when the injected configuration file failed to load, so
 * that a misconfigured dev environment degrades to the documented local values
 * instead of crashing the shell.
 */
const LOCAL_DEVELOPMENT_DEFAULTS: AppConfig = {
  gatewayBaseUrl: 'http://localhost:5000',
  signInTimeoutMs: 15_000,
}

declare global {
  interface Window {
    __PACCO_CONFIG__?: Partial<AppConfig>
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** Strips a single trailing slash so path joining stays unambiguous. */
function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export function readAppConfig(source: Partial<AppConfig> | undefined): AppConfig {
  const gatewayBaseUrl = isNonEmptyString(source?.gatewayBaseUrl)
    ? normaliseBaseUrl(source.gatewayBaseUrl)
    : LOCAL_DEVELOPMENT_DEFAULTS.gatewayBaseUrl

  const signInTimeoutMs = isPositiveInteger(source?.signInTimeoutMs)
    ? source.signInTimeoutMs
    : LOCAL_DEVELOPMENT_DEFAULTS.signInTimeoutMs

  return { gatewayBaseUrl, signInTimeoutMs }
}

/** Reads the injected configuration from the host page. */
export function readInjectedAppConfig(): AppConfig {
  return readAppConfig(typeof window === 'undefined' ? undefined : window.__PACCO_CONFIG__)
}
