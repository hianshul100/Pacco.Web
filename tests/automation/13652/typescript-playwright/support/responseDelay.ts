/**
 * The suite's ONLY timer, and the only file exempt from the no-fixed-delay
 * lint rule.
 *
 * This is not a test sleep. No test ever waits on it to decide whether
 * something has happened - every such wait in this suite is a web-first
 * assertion or an event. What this does is hold a *stubbed server response*
 * open, because several rows specify latency as part of the scenario itself:
 *
 *   TC-015  a response held for 2000 ms while five clicks arrive
 *   TC-016  a connection refused 300 ms after the request
 *   TC-017  a pending request whose busy state must be observable
 *   TC-035  a response held past the client's 15000 ms timeout
 *
 * Simulating that latency is the fixture's job. Using it to synchronise a test
 * would not be, and nothing here does.
 */

/** Holds a stubbed response open for `milliseconds` before it is fulfilled. */
export function holdResponse(milliseconds: number): Promise<void> {
  if (!Number.isInteger(milliseconds) || milliseconds < 0) {
    throw new Error(`holdResponse needs a non-negative integer, got ${String(milliseconds)}.`)
  }
  return new Promise<void>((settle) => {
    // eslint-disable-next-line no-restricted-syntax -- simulated server latency; see the file header.
    setTimeout(settle, milliseconds)
  })
}
