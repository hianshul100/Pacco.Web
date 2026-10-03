/**
 * Browser-generated correlation ids.
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 9 (Q4): the correlation id is
 * generated in the browser and is NOT propagated as a request header. It exists
 * so the six `login.*` telemetry events for one submission can be tied together
 * locally, and for nothing else.
 *
 * It carries no user data: no identifier, no password, no token, no role.
 */

export function newCorrelationId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  // Fallback for environments without `crypto.randomUUID` (e.g. older jsdom).
  // Non-cryptographic by design -- this value is a local log key, not a secret.
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
