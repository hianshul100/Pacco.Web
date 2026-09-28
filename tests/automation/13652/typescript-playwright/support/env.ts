/**
 * The suite's single source of configuration.
 *
 * Every address, every timeout and every fixture credential used anywhere in
 * this suite is read here and nowhere else. No spec, page object or helper may
 * carry a literal base URL, a literal millisecond count or a literal password.
 *
 * 🚫 There are no baked-in credential defaults. A missing credential variable
 *    is a loud failure from `validateEnvConfig()`, never a silent fallback to a
 *    value committed in source.
 */
import { existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Primitive readers
// ---------------------------------------------------------------------------

/** Variables that must be present; reading one that is absent throws. */
const REQUIRED_CREDENTIAL_VARS = [
  'PACCO_USER_EMAIL',
  'PACCO_USER_PASSWORD',
  'PACCO_ADMIN_EMAIL',
  'PACCO_ADMIN_PASSWORD',
  'PACCO_OTHER_EMAIL',
  'PACCO_UNKNOWN_EMAIL',
  'PACCO_UNKNOWN_EMAIL_STUBBED',
  'PACCO_WRONG_PASSWORD',
  'PACCO_WRONG_PASSWORD_LIVE',
  'PACCO_WRONG_PASSWORD_SEQUENCE',
  'PACCO_ADMIN_SHAPED_EMAIL',
  'PACCO_PASSWORD_CANARY',
  'PACCO_REFRESH_TOKEN_CANARY',
  'PACCO_REASON_CANARY',
] as const

function raw(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value.trim() === '' ? undefined : value
}

function str(name: string, fallback: string): string {
  return raw(name) ?? fallback
}

/** Reads a variable that has no safe default. Throws with the variable name. */
function required(name: string): string {
  const value = raw(name)
  if (value === undefined) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Copy .env.example to .env in the suite root and fill it in.',
    )
  }
  return value
}

/**
 * Reads a required variable holding a comma-separated list.
 *
 * Used for fixture sets whose *size* the CSV fixes - six wrong passwords, not
 * "some" - so a short list is caught at configuration time rather than turning
 * into a quietly shorter loop.
 */
function csv(name: string): readonly string[] {
  const values = required(name)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  if (values.length === 0) {
    throw new Error(`${name} must list at least one value, separated by commas.`)
  }
  return values
}

function int(name: string, fallback: number): number {
  const value = raw(name)
  if (value === undefined) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative integer, got "${value}".`)
  }
  return parsed
}

function bool(name: string, fallback: boolean): boolean {
  const value = raw(name)?.toLowerCase()
  if (value === undefined) {
    return fallback
  }
  return value === 'true' || value === '1' || value === 'yes'
}

/** Strips every trailing slash so origins concatenate predictably. */
function origin(name: string, fallback: string): string {
  const value = str(name, fallback).replace(/\/+$/, '')
  try {
    // Throws for anything that is not an absolute URL.
    void new URL(value)
  } catch {
    throw new Error(`Environment variable ${name} must be an absolute URL, got "${value}".`)
  }
  return value
}

// ---------------------------------------------------------------------------
// Directory resolution for the static-analysis rows
// ---------------------------------------------------------------------------

/** The suite root, four levels below the Pacco.Web repository root. */
const SUITE_ROOT = resolve(__dirname, '..')
const CLIENT_REPO_DEFAULT = resolve(SUITE_ROOT, '..', '..', '..', '..')
const WORKSPACE_ROOT = resolve(CLIENT_REPO_DEFAULT, '..')

function absolute(value: string): string {
  return isAbsolute(value) ? value : resolve(process.cwd(), value)
}

/**
 * Resolves a sibling checkout by trying the explicit override first and then the
 * checkout names seen in practice. Mirrors the host repository's own
 * `tests/gateway/gatewayConfigDir.ts` so both suites agree on layout.
 */
function resolveSibling(
  overrideVar: string,
  siblingNames: readonly string[],
  subPath: string,
  markerFiles: readonly string[],
): string | null {
  const holdsMarkers = (dir: string): boolean =>
    markerFiles.every((file) => existsSync(join(dir, file)))

  const override = raw(overrideVar)
  if (override !== undefined) {
    const dir = absolute(override)
    return holdsMarkers(dir) ? dir : null
  }

  for (const name of siblingNames) {
    const dir = subPath === '' ? join(WORKSPACE_ROOT, name) : join(WORKSPACE_ROOT, name, subPath)
    if (holdsMarkers(dir)) {
      return dir
    }
  }
  return null
}

export const GATEWAY_CONFIG_FILES = [
  'ntrada.yml',
  'ntrada.docker.yml',
  'ntrada-async.yml',
  'ntrada-async.docker.yml',
] as const

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface AccountFixture {
  readonly email: string
  readonly password: string
}

export interface EnvConfig {
  readonly suiteRoot: string
  readonly webBaseUrl: string
  readonly gatewayBaseUrl: string
  readonly signInPath: string
  /** Absolute address of the one backend call this capability makes. */
  readonly signInUrl: string
  readonly protectedRoutePath: string
  readonly disallowedOriginUrl: string

  readonly clientRepoDir: string
  readonly gatewayConfigDir: string | null
  readonly composeDir: string | null
  readonly gatewayBaselineRev: string
  readonly signInServiceName: string

  readonly accounts: {
    readonly standard: AccountFixture
    readonly admin: AccountFixture
    readonly other: AccountFixture
    readonly unknownEmail: string
    readonly unknownEmailStubbed: string
    readonly wrongPassword: string
    readonly wrongPasswordLive: string
    /**
     * The distinct wrong passwords TC-119 submits back to back, in order.
     * Distinct values so a platform that deduplicated identical attempts could
     * not make the row pass by accident.
     */
    readonly wrongPasswordSequence: readonly string[]
    readonly adminShapedEmail: string
  }

  readonly canaries: {
    readonly password: string
    readonly refreshToken: string
    readonly reason: string
  }

  readonly timeouts: {
    readonly signInMs: number
    readonly actionMs: number
    readonly expectMs: number
    readonly navigationMs: number
    readonly testMs: number
    readonly slowResponseMs: number
    readonly abortDelayMs: number
    readonly idleObservationMs: number
    /** How long TC-116 holds the sign-in response open while it double-clicks. */
    readonly telemetryHoldMs: number
    /** How long TC-127 holds a response open to observe the in-flight state. */
    readonly inFlightHoldMs: number
    /** The lifetime TC-113 seeds, in seconds, so the session expires mid-test. */
    readonly shortSessionSeconds: number
    /** How far TC-113 advances the page clock past that lifetime. */
    readonly clockAdvanceMs: number
  }

  /**
   * Repetition counts the CSV fixes. Externalised so a row's "six attempts"
   * is a configured fact rather than a number buried in a loop.
   */
  readonly repetitions: {
    /** TC-117: timed sign-in round trips. */
    readonly latencySamples: number
    /** TC-119: consecutive wrong-password attempts before the correct one. */
    readonly failedAttempts: number
    /** TC-116: extra submit clicks issued while the first request is open. */
    readonly duplicateClicks: number
  }

  readonly a11y: {
    readonly level: 'a' | 'aa' | 'aaa'
    readonly tags: readonly string[]
    readonly failOnViolations: boolean
  }

  readonly logLevel: 'error' | 'warn' | 'info' | 'debug'
  readonly startWebServer: boolean
  readonly ignoreHttpsErrors: boolean
}

// ---------------------------------------------------------------------------
// WCAG tag resolution
// ---------------------------------------------------------------------------

const WCAG_TAGS_BY_LEVEL: Record<'a' | 'aa' | 'aaa', readonly string[]> = {
  a: ['wcag2a', 'wcag21a'],
  aa: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  aaa: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
}

function readA11yLevel(): 'a' | 'aa' | 'aaa' {
  const value = str('A11Y_WCAG_LEVEL', 'aa').toLowerCase()
  if (value !== 'a' && value !== 'aa' && value !== 'aaa') {
    throw new Error(`A11Y_WCAG_LEVEL must be one of a|aa|aaa, got "${value}".`)
  }
  return value
}

function readA11yTags(level: 'a' | 'aa' | 'aaa'): readonly string[] {
  const explicit = raw('A11Y_WCAG_TAGS')
  if (explicit === undefined) {
    return WCAG_TAGS_BY_LEVEL[level]
  }
  return explicit
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

let cached: EnvConfig | null = null

export function readEnvConfig(): EnvConfig {
  if (cached !== null) {
    return cached
  }

  const gatewayBaseUrl = origin('PACCO_GATEWAY_BASE_URL', 'http://localhost:5000')
  const signInPath = str('PACCO_SIGN_IN_PATH', '/identity/sign-in')
  const level = readA11yLevel()

  const logLevelRaw = str('LOG_LEVEL', 'info').toLowerCase()
  if (!['error', 'warn', 'info', 'debug'].includes(logLevelRaw)) {
    throw new Error(`LOG_LEVEL must be one of error|warn|info|debug, got "${logLevelRaw}".`)
  }

  cached = {
    suiteRoot: SUITE_ROOT,
    webBaseUrl: origin('PACCO_WEB_BASE_URL', 'http://localhost:5173'),
    gatewayBaseUrl,
    signInPath,
    signInUrl: `${gatewayBaseUrl}${signInPath}`,
    protectedRoutePath: str('PACCO_PROTECTED_ROUTE_PATH', '/parcels'),
    disallowedOriginUrl: origin('PACCO_DISALLOWED_ORIGIN_URL', 'http://localhost:4173'),

    clientRepoDir: absolute(str('PACCO_CLIENT_REPO_DIR', CLIENT_REPO_DEFAULT)),
    gatewayConfigDir: resolveSibling(
      'PACCO_GATEWAY_CONFIG_DIR',
      ['hianshul100_Pacco.APIGateway', 'Pacco.APIGateway', 'pacco.apigateway'],
      join('src', 'Pacco.APIGateway'),
      GATEWAY_CONFIG_FILES,
    ),
    composeDir: resolveSibling(
      'PACCO_COMPOSE_DIR',
      ['hianshul100_Pacco', 'Pacco', 'pacco'],
      'compose',
      ['infrastructure.yml', 'services.yml'],
    ),
    gatewayBaselineRev: str('PACCO_GATEWAY_BASELINE_REV', 'origin/main'),
    signInServiceName: str('PACCO_SIGNIN_SERVICE_NAME', 'identity-service'),

    accounts: {
      standard: { email: required('PACCO_USER_EMAIL'), password: required('PACCO_USER_PASSWORD') },
      admin: { email: required('PACCO_ADMIN_EMAIL'), password: required('PACCO_ADMIN_PASSWORD') },
      other: { email: required('PACCO_OTHER_EMAIL'), password: required('PACCO_USER_PASSWORD') },
      unknownEmail: required('PACCO_UNKNOWN_EMAIL'),
      unknownEmailStubbed: required('PACCO_UNKNOWN_EMAIL_STUBBED'),
      wrongPassword: required('PACCO_WRONG_PASSWORD'),
      wrongPasswordLive: required('PACCO_WRONG_PASSWORD_LIVE'),
      wrongPasswordSequence: csv('PACCO_WRONG_PASSWORD_SEQUENCE'),
      adminShapedEmail: required('PACCO_ADMIN_SHAPED_EMAIL'),
    },

    canaries: {
      password: required('PACCO_PASSWORD_CANARY'),
      refreshToken: required('PACCO_REFRESH_TOKEN_CANARY'),
      reason: required('PACCO_REASON_CANARY'),
    },

    timeouts: {
      signInMs: int('PACCO_SIGN_IN_TIMEOUT_MS', 15_000),
      actionMs: int('PACCO_ACTION_TIMEOUT_MS', 10_000),
      expectMs: int('PACCO_EXPECT_TIMEOUT_MS', 10_000),
      navigationMs: int('PACCO_NAVIGATION_TIMEOUT_MS', 30_000),
      testMs: int('PACCO_TEST_TIMEOUT_MS', 90_000),
      slowResponseMs: int('PACCO_SLOW_RESPONSE_DELAY_MS', 2_000),
      abortDelayMs: int('PACCO_ABORT_DELAY_MS', 300),
      idleObservationMs: int('PACCO_IDLE_OBSERVATION_MS', 3_000),
      telemetryHoldMs: int('PACCO_TELEMETRY_HOLD_MS', 1_500),
      inFlightHoldMs: int('PACCO_IN_FLIGHT_HOLD_MS', 5_000),
      shortSessionSeconds: int('PACCO_SHORT_SESSION_SECONDS', 2),
      clockAdvanceMs: int('PACCO_CLOCK_ADVANCE_MS', 5_000),
    },

    repetitions: {
      latencySamples: int('PACCO_LATENCY_SAMPLES', 5),
      failedAttempts: int('PACCO_FAILED_ATTEMPTS', 6),
      duplicateClicks: int('PACCO_DUPLICATE_CLICKS', 4),
    },

    a11y: {
      level,
      tags: readA11yTags(level),
      failOnViolations: bool('A11Y_FAIL_ON_VIOLATIONS', true),
    },

    logLevel: logLevelRaw as EnvConfig['logLevel'],
    startWebServer: bool('PACCO_START_WEB_SERVER', false),
    // TLS verification is ON unless a run explicitly relaxes it.
    ignoreHttpsErrors: bool('PACCO_IGNORE_HTTPS_ERRORS', false),
  }

  return cached
}

/**
 * Fails the run before a single browser starts when configuration is incomplete.
 * Called from `playwright.config.ts` and from the global setup.
 */
export function validateEnvConfig(): EnvConfig {
  const missing = REQUIRED_CREDENTIAL_VARS.filter((name) => raw(name) === undefined)
  if (missing.length > 0) {
    throw new Error(
      [
        'The Playwright suite for JIRA 13652 is not configured.',
        `Missing: ${missing.join(', ')}.`,
        'Copy .env.example to .env in the suite root and fill every value.',
        'None of these has a default baked into source - a committed credential',
        'default is exactly what this suite exists to prove does not happen.',
      ].join('\n'),
    )
  }

  const config = readEnvConfig()

  if (config.timeouts.signInMs <= 0) {
    throw new Error('PACCO_SIGN_IN_TIMEOUT_MS must be greater than zero.')
  }
  if (config.a11y.tags.length === 0) {
    throw new Error('A11Y_WCAG_TAGS resolved to an empty list; an accessibility scan needs tags.')
  }
  if (!existsSync(config.clientRepoDir)) {
    throw new Error(`PACCO_CLIENT_REPO_DIR does not exist: ${config.clientRepoDir}`)
  }

  return config
}
