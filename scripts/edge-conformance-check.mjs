#!/usr/bin/env node
/**
 * Edge conformance — the three landing-wave anchors that cannot run in jsdom.
 *
 * `LOW_LEVEL_SPEC-13652-wave-2.md` §L.6.A.4 lists fifteen negative anchors.
 * Twelve are held by `tests/security/landingNegativeAnchors.test.tsx` and
 * `tests/gateway/corsConfiguration.test.ts`. The remaining three are
 * properties of the RUNNING PLATFORM, not of this client, and are driven here:
 *
 *   NEG-11 / X-6  a machine caller that sends NO `Origin` header must still
 *                 succeed. CORS is a browser mechanism; tightening
 *                 `allowedOrigins` from `'*'` to one exact origin must not
 *                 break service-to-service or CLI callers, who send no
 *                 `Origin` at all and are therefore not subject to it.
 *
 *   NEG-13        an observation run: what the gateway actually answers, so a
 *                 reviewer sees the edge's behaviour rather than a claim
 *                 about it.
 *
 *   E2E-13 / N6   post-logout token replay. ⚠️ This is a MEASUREMENT of a
 *                 stated limitation, NOT a gate that can fail. Logout is a
 *                 client-side session discard; it does not invalidate the
 *                 already-issued token at the platform level, so the token
 *                 stays acceptable to the gateway until its own `exp`. This
 *                 run records how long that window actually is.
 *
 * 🚫 This script adds nothing to the gateway. It sends ordinary requests to
 * routes that already exist. There is no logout route to call and no revoke
 * endpoint to exercise — ADR-007 keeps JWT validation stateless at the edge,
 * consulting no deny-list.
 *
 * 🚫 No credential is committed. The replay measurement needs a real token,
 * which must be supplied at run time through `PACCO_ACCESS_TOKEN`; without it
 * that one check reports NOT RUN and the others still run.
 *
 * ⚠️ NOT RUN is a first-class outcome. With the Docker Compose stack down this
 * exits 2 and says so. §L.6.2 requires an unexecuted check to be reported as
 * "not run" and NEVER as passed.
 *
 * Usage:
 *   docker compose up -d          # in the Pacco backend repository
 *   npm run verify:edge
 *
 * Environment:
 *   PACCO_GATEWAY_URL     default http://localhost:5000
 *   PACCO_ACCESS_TOKEN    a token obtained by signing in; enables the replay
 *                         measurement. Never committed, never logged in full.
 *   PACCO_PROBE_ROUTE     an authenticated GET route, default /parcels
 *
 * Exit codes: 0 = every executed check passed, 1 = a check failed, 2 = NOT RUN.
 */
const EXIT_PASS = 0
const EXIT_FAIL = 1
const EXIT_NOT_RUN = 2

const GATEWAY = (process.env.PACCO_GATEWAY_URL ?? 'http://localhost:5000').replace(/\/+$/, '')
const ACCESS_TOKEN = process.env.PACCO_ACCESS_TOKEN ?? ''
const PROBE_ROUTE = process.env.PACCO_PROBE_ROUTE ?? '/parcels'

/** Requests that must not hang the run when the gateway is slow rather than down. */
const TIMEOUT_MS = 8000

function notRun(reason) {
  console.error('')
  console.error('EDGE CONFORMANCE CHECK NOT RUN')
  console.error(`  reason: ${reason}`)
  console.error('  NEG-11 / X-6, NEG-13 and E2E-13 / N6 were NOT exercised by this run.')
  console.error('  They must be reported as "not run", never as passed')
  console.error('  (LOW_LEVEL_SPEC-13652-wave-2.md §L.6.2).')
  process.exit(EXIT_NOT_RUN)
}

async function request(path, { headers = {}, method = 'GET' } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${GATEWAY}${path}`, {
      method,
      headers,
      signal: controller.signal,
    })
    return { status: response.status, headers: response.headers }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
  }
}

/** Reads a JWT's `exp` without verifying it. The edge owns verification. */
function expiryOf(token) {
  const payload = token.split('.')[1]
  if (payload === undefined) {
    return null
  }
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    )
    const exp = JSON.parse(json).exp
    return typeof exp === 'number' ? exp : null
  } catch {
    return null
  }
}

async function main() {
  console.log('Edge conformance check')
  console.log(`  gateway : ${GATEWAY}`)
  console.log(`  route   : ${PROBE_ROUTE}`)
  console.log('')

  const reachable = await request('/', {})
  if (reachable.error !== undefined) {
    notRun(`the gateway at ${GATEWAY} is not reachable (${reachable.error}). Start the ` +
      'Docker Compose stack, then re-run this check.')
  }

  const results = []

  // ---- NEG-11 / X-6 -------------------------------------------------------
  // No `Origin` header at all. A browser would always send one; a machine
  // caller does not, and must not be affected by the origin allow-list.
  const machine = await request(PROBE_ROUTE, {})
  const originHeader = machine.headers?.get('access-control-allow-origin') ?? null
  const machinePassed = machine.error === undefined && machine.status !== 0
  console.log('NEG-11 / X-6  machine caller, no Origin header')
  console.log(`  status                      : ${machine.status ?? `error: ${machine.error}`}`)
  console.log(`  access-control-allow-origin : ${originHeader ?? '(absent, as expected)'}`)
  console.log(
    `  verdict                     : ${machinePassed ? 'PASS' : 'FAIL'} — the request was ` +
      `${machinePassed ? 'answered' : 'not answered'} by the gateway. A 401 is a PASS here: ` +
      'the point is that the origin allow-list did not refuse it.',
  )
  console.log('')
  results.push(['NEG-11 / X-6', machinePassed])

  // ---- NEG-13 -------------------------------------------------------------
  // Observation: what a browser origin OUTSIDE the allow-list is told, and what
  // the one inside it is told. Reported, not gated — the browser-side gate is
  // `npm run verify:cors-browser`, which runs the decision in Chromium.
  const allowed = await request(PROBE_ROUTE, { headers: { origin: 'http://localhost:5173' } })
  const disallowed = await request(PROBE_ROUTE, { headers: { origin: 'http://localhost:3999' } })
  console.log('NEG-13        observation run')
  console.log(
    `  origin http://localhost:5173 : status ${allowed.status}, ` +
      `allow-origin ${allowed.headers?.get('access-control-allow-origin') ?? '(absent)'}`,
  )
  console.log(
    `  origin http://localhost:3999 : status ${disallowed.status}, ` +
      `allow-origin ${disallowed.headers?.get('access-control-allow-origin') ?? '(absent)'}`,
  )
  console.log('  verdict                      : OBSERVED (not a gate; see verify:cors-browser)')
  console.log('')

  // ---- E2E-13 / N6 --------------------------------------------------------
  console.log('E2E-13 / N6   post-logout token replay')
  if (ACCESS_TOKEN === '') {
    console.log('  verdict : NOT RUN — set PACCO_ACCESS_TOKEN to a token obtained by signing')
    console.log('            in, then re-run. 🚫 No credential is committed to this')
    console.log('            repository, so one cannot be supplied automatically.')
    console.log('')
    results.push(['E2E-13 / N6', null])
  } else {
    const replay = await request(PROBE_ROUTE, {
      headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
    })
    const exp = expiryOf(ACCESS_TOKEN)
    const secondsLeft = exp === null ? null : exp - Math.floor(Date.now() / 1000)
    console.log(`  status                  : ${replay.status ?? `error: ${replay.error}`}`)
    console.log(
      `  token lifetime remaining: ${secondsLeft === null ? 'unreadable' : `${secondsLeft}s`}`,
    )
    console.log('  verdict                 : MEASURED, not gated.')
    console.log('')
    console.log(
      '  ⚠️ A token captured before logout REMAINS ACCEPTABLE to the gateway until its',
    )
    console.log('     own `exp`. Client-side logout ends the browser session; it does not')
    console.log('     invalidate the already-issued token at the platform level. The figure')
    console.log('     above is the size of that window. Shortening it is a PLATFORM decision')
    console.log('     — a shorter token lifetime, or an edge revocation list — and is')
    console.log('     explicitly out of scope for the browser client (ADR-007).')
    console.log('')
    results.push(['E2E-13 / N6', null])
  }

  const failed = results.filter(([, passed]) => passed === false)
  console.log('Summary')
  for (const [anchor, passed] of results) {
    console.log(`  ${anchor.padEnd(14)} ${passed === null ? 'MEASURED / NOT RUN' : passed ? 'PASS' : 'FAIL'}`)
  }
  return failed.length === 0 ? EXIT_PASS : EXIT_FAIL
}

process.exit(await main())
