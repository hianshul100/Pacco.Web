/**
 * Traffic recorder.
 *
 * A great many rows in the CSV are counting rows: "exactly one request",
 * "zero backend requests", "exactly two distinct origins". Those counts have
 * to come from an observer that sees every request the page issues, including
 * the ones a stub later fulfils, so this attaches to `page.on('request')`
 * rather than inferring traffic from route handlers.
 *
 * Request bodies are retained so the leak sweeps (TC-042, TC-099) can search
 * what was actually put on the wire - and they are redacted before they reach
 * any log or attachment.
 */
import type { BrowserContext, Page, Request } from '@playwright/test'

import { readEnvConfig } from './env'

export interface RecordedRequest {
  readonly method: string
  readonly url: string
  readonly origin: string
  readonly path: string
  readonly resourceType: string
  readonly headers: Record<string, string>
  readonly postData: string | null
  readonly at: number
}

export interface TrafficRecorder {
  /** Every request the page issued, in order. */
  all(): readonly RecordedRequest[]
  /** Requests addressed to the API Gateway origin. */
  backend(): readonly RecordedRequest[]
  /** Requests addressed to the gateway's sign-in path. */
  signIn(): readonly RecordedRequest[]
  /** Distinct origins contacted, sorted, documents and assets included. */
  distinctOrigins(): readonly string[]
  /** Requests to any host that is neither the client nor the gateway. */
  foreign(): readonly RecordedRequest[]
  /** Forgets everything recorded so far. */
  clear(): void
}

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

/**
 * Starts recording. Attach at context level so requests issued by a page that
 * has not been created yet - or by one that navigates away - are still seen.
 */
export function recordTraffic(target: Page | BrowserContext): TrafficRecorder {
  const env = readEnvConfig()
  let recorded: RecordedRequest[] = []

  const onRequest = (request: Request): void => {
    recorded.push({
      method: request.method(),
      url: request.url(),
      origin: originOf(request.url()),
      path: pathOf(request.url()),
      resourceType: request.resourceType(),
      headers: request.headers(),
      postData: request.postData(),
      at: Date.now(),
    })
  }

  target.on('request', onRequest)

  const backend = (): readonly RecordedRequest[] =>
    recorded.filter((entry) => entry.origin === env.gatewayBaseUrl)

  return {
    all: () => recorded,
    backend,
    signIn: () => backend().filter((entry) => entry.path === env.signInPath),
    distinctOrigins: () => [...new Set(recorded.map((entry) => entry.origin))].sort(),
    foreign: () =>
      recorded.filter(
        (entry) => entry.origin !== env.gatewayBaseUrl && entry.origin !== env.webBaseUrl,
      ),
    clear: () => {
      recorded = []
    },
  }
}

/**
 * Watches for `windowMs` and resolves with whatever backend traffic arrived.
 *
 * This is how the "issues zero requests while idle" rows (TC-071, TC-073,
 * TC-082) observe a window without sleeping through it: the wait is for a
 * request *event*, and the expected outcome is that the event never fires. A
 * request arriving early ends the wait immediately, so a failing run fails
 * fast rather than sitting out the full window.
 */
export async function watchForBackendTraffic(
  page: Page,
  windowMs: number,
): Promise<RecordedRequest | null> {
  const env = readEnvConfig()
  try {
    const request = await page.waitForRequest(
      (candidate) => originOf(candidate.url()) === env.gatewayBaseUrl,
      { timeout: windowMs },
    )
    return {
      method: request.method(),
      url: request.url(),
      origin: originOf(request.url()),
      path: pathOf(request.url()),
      resourceType: request.resourceType(),
      headers: request.headers(),
      postData: request.postData(),
      at: Date.now(),
    }
  } catch {
    // The wait timed out, which is the outcome these rows want.
    return null
  }
}

/**
 * Records every address the page occupied, so "never entered /welcome, even
 * transiently" (TC-040) and the Back/Forward rows can be asserted against a
 * history of navigation events rather than a single final reading.
 */
export interface NavigationRecorder {
  urls(): readonly string[]
  paths(): readonly string[]
  clear(): void
}

export function recordNavigation(page: Page): NavigationRecorder {
  let seen: string[] = [page.url()]

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      seen.push(frame.url())
    }
  })

  return {
    urls: () => seen,
    paths: () => seen.map(pathOf),
    clear: () => {
      seen = [page.url()]
    },
  }
}
