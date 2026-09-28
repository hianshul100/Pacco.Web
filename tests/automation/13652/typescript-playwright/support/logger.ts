/**
 * Structured logging with redaction wired in at the only exit point.
 *
 * Every line is one JSON object carrying the correlation id of the test that
 * emitted it, so a CI log can be filtered down to a single row's story.
 *
 * Redaction is not advisory. `redact()` runs over every payload before it
 * reaches the stream, so a helper that accidentally hands the logger a request
 * body still cannot print a password, a token or an e-mail address. The suite
 * asserts that the product does not leak these values (TC-042, TC-043); it
 * would be absurd for the suite's own logs to leak them.
 */
import { readEnvConfig } from './env'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

const LEVEL_ORDER: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }

export const REDACTED = '[redacted]'

/** Keys whose values are replaced wholesale, matched case-insensitively. */
const SENSITIVE_KEYS = [
  'password',
  'passphrase',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'token',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'apikey',
  'api_key',
  'credential',
  'credentials',
  'email',
  'identifier',
  'username',
  'reason',
]

/** Value shapes redacted wherever they appear, including inside free text. */
const SENSITIVE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // E-mail addresses.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED],
  // Anything shaped like a JWT.
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*/g, REDACTED],
  // Bearer credentials in a header string.
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${REDACTED}`],
]

function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z_]/g, '')
  return SENSITIVE_KEYS.some((candidate) => normalised.includes(candidate.replace(/[^a-z_]/g, '')))
}

function redactString(value: string): string {
  return SENSITIVE_PATTERNS.reduce<string>(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  )
}

/**
 * Deep-redacts a value. Exported so tests can assert the redactor itself
 * behaves, and so ad-hoc attachments can be cleaned before `testInfo.attach`.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return '[depth-limit]'
  }
  if (value === null || value === undefined) {
    return value
  }
  if (typeof value === 'string') {
    return redactString(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, depth + 1))
  }
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) }
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = isSensitiveKey(key) ? REDACTED : redact(entry, depth + 1)
    }
    return output
  }
  if (typeof value === 'bigint') {
    return `${value.toString()}n`
  }
  // Only symbols and functions reach here. Neither has a useful textual form,
  // and neither belongs in a log line, so record the kind and drop the value.
  return `[${typeof value}]`
}

export interface Logger {
  readonly correlationId: string
  error(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  debug(message: string, context?: Record<string, unknown>): void
  /** Derives a logger that inherits the correlation id and adds fixed context. */
  child(context: Record<string, unknown>): Logger
}

interface LoggerOptions {
  readonly correlationId: string
  readonly testId?: string
  readonly base?: Record<string, unknown>
}

export function createLogger(options: LoggerOptions): Logger {
  const threshold = LEVEL_ORDER[readEnvConfig().logLevel]
  const base = options.base ?? {}

  const write = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
    if (LEVEL_ORDER[level] > threshold) {
      return
    }
    const line = {
      timestamp: new Date().toISOString(),
      level,
      correlationId: options.correlationId,
      ...(options.testId === undefined ? {} : { testId: options.testId }),
      message: redactString(message),
      ...(redact({ ...base, ...(context ?? {}) }) as Record<string, unknown>),
    }
    // The single stream exit point for the whole suite.
    process.stdout.write(`${JSON.stringify(line)}\n`)
  }

  return {
    correlationId: options.correlationId,
    error: (message, context) => write('error', message, context),
    warn: (message, context) => write('warn', message, context),
    info: (message, context) => write('info', message, context),
    debug: (message, context) => write('debug', message, context),
    child: (context) =>
      createLogger({
        correlationId: options.correlationId,
        ...(options.testId === undefined ? {} : { testId: options.testId }),
        base: { ...base, ...context },
      }),
  }
}
