/**
 * Correlation identifiers.
 *
 * One id per test, stamped into every log line and every report attachment so
 * a failure in CI can be traced from the JUnit entry to the log stream to the
 * captured evidence.
 *
 * Note this id never leaves the suite: the client deliberately sends no
 * correlation header to the gateway (see `src/gateway/gatewayClient.ts`), and
 * this suite does not add one.
 */
import { randomUUID } from 'node:crypto'

/** Trims a CSV-derived title down to the `TC-13652-nnn` identifier. */
export function testCaseIdFrom(title: string): string {
  const match = /TC-\d{5}-\d{3}/.exec(title)
  return match === null ? 'TC-13652-000' : match[0]
}

export function newCorrelationId(seed?: string): string {
  const unique = randomUUID()
  return seed === undefined ? unique : `${seed}:${unique}`
}
