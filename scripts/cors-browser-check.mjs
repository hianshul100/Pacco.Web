#!/usr/bin/env node
/**
 * AC-16 (SPECIFICATION.md §16) / FR-11 — the RUNTIME half of the cross-origin
 * change, run in a real browser engine.
 *
 * §19 counts FR-11's obligation as "1 four-file byte-identity diff, plus 2
 * cross-origin browser checks". The byte-identity diff is discharged statically
 * by `Pacco.APIGateway/scripts/verify-cors-config.sh` and by
 * `tests/gateway/corsConfiguration.test.ts`. This script is the other two: it
 * drives headless Chromium from two different page origins against the running
 * gateway and reports what the browser's own CORS implementation decided.
 *
 *   check 1 — ALLOWED origin (the origin in DEV_SERVER_ORIGIN, which is the
 *             single entry now in every `ntrada*.yml` allowedOrigins list):
 *             the cross-origin request must be ACCEPTED by the browser.
 *   check 2 — DISALLOWED origin (a port that is not in the list): the same
 *             request must be REJECTED by the browser. This is what a wildcard
 *             would fail, so it is the check that actually proves the wildcard
 *             is gone at runtime rather than only in the YAML.
 *
 * ⚠️ NOT RUN is a first-class outcome. Where Chromium or the Docker Compose
 * gateway is unavailable this exits 2 and says so in as many words. Per
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.6.2, an affected §L.6.A row in that
 * situation must be reported as "not run" and NEVER as passed.
 *
 * Usage:
 *   node scripts/cors-browser-check.mjs [gateway-base-url]
 * Environment overrides:
 *   PACCO_GATEWAY_URL        default http://localhost:5000
 *   PACCO_DISALLOWED_PORT    default 3999
 *   CHROMIUM_BIN             explicit path to a Chromium/Chrome binary
 *
 * No credential is sent. The probe body carries empty strings deliberately:
 * SPECIFICATION.md AC-7 forbids a real credential from living in the
 * repository, and the CORS decision is taken by the browser before the
 * gateway's response body matters. A 400 from the identity service is a
 * perfectly good ACCEPTED result — what is under test is whether the browser
 * surfaced the response at all.
 *
 * Exit codes: 0 = both checks passed, 1 = a check failed, 2 = NOT RUN.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const EXIT_PASS = 0
const EXIT_FAIL = 1
const EXIT_NOT_RUN = 2

const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_BIN,
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable',
].filter((candidate) => candidate !== undefined && candidate !== '')

const GATEWAY_URL = (
  process.argv[2] ??
  process.env.PACCO_GATEWAY_URL ??
  'http://localhost:5000'
).replace(/\/+$/, '')

const DISALLOWED_PORT = Number(process.env.PACCO_DISALLOWED_PORT ?? '3999')

/**
 * The allowed origin is read from the single source of truth the Vite dev
 * server and the gateway YAML both derive from, so this check can never drift
 * from the origin that was actually allowlisted.
 */
function readAllowedOrigin() {
  const source = readFileSync(join(REPO_ROOT, 'src', 'config', 'devServerOrigin.ts'), 'utf8')
  const match = /DEV_SERVER_ORIGIN\s*=\s*'([^']+)'/.exec(source)
  if (match === null) {
    throw new Error('Could not read DEV_SERVER_ORIGIN from src/config/devServerOrigin.ts')
  }
  return match[1]
}

function probePage() {
  // Rendered into the DOM so `--dump-dom` can read the verdict back out. The
  // marker is deliberately unmistakable in a dump of the whole document.
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>pacco cors probe</title></head>
<body><pre id="verdict">PENDING</pre>
<script>
  const say = (text) => { document.getElementById('verdict').textContent = 'PACCO_CORS_RESULT:' + text }
  fetch(${JSON.stringify(GATEWAY_URL)} + '/identity/sign-in', {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: '', password: '' }),
  }).then((response) => { say('ACCEPTED status=' + response.status) })
    .catch((error) => { say('REJECTED ' + String(error && error.message)) })
</script></body></html>`
}

function startOriginServer(port) {
  return new Promise((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(probePage())
    })
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => {
      resolve()
    })
  })
}

/** @returns the dumped DOM, or null when the binary could not be run. */
function dumpDom(binary, url) {
  return new Promise((resolve) => {
    const child = spawn(
      binary,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        // The probe origins bind to 127.0.0.1 only, while Chromium resolves
        // `localhost` to ::1 first on this platform and lands on its network
        // error page. Pinning the resolver keeps the page's Origin header as
        // `http://localhost:<port>` — the exact string the gateway allowlists —
        // which navigating to 127.0.0.1 directly would not.
        '--host-resolver-rules=MAP localhost 127.0.0.1',
        // Advances the page's clock so the fetch settles before the dump,
        // without this script having to poll or sleep.
        '--virtual-time-budget=10000',
        '--dump-dom',
        url,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )
    let out = ''
    child.stdout.on('data', (chunk) => {
      out += String(chunk)
    })
    child.once('error', () => {
      resolve(null)
    })
    child.once('close', (code) => {
      resolve(code === 0 || out !== '' ? out : null)
    })
  })
}

async function findChromium() {
  for (const candidate of CHROMIUM_CANDIDATES) {
    const dump = await dumpDom(candidate, 'data:text/html,<p>pacco</p>')
    if (dump !== null && dump.includes('pacco')) {
      return candidate
    }
  }
  return null
}

async function gatewayAnswers() {
  try {
    const response = await fetch(`${GATEWAY_URL}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    // Any HTTP answer proves something is listening; the status is irrelevant.
    return typeof response.status === 'number'
  } catch {
    return false
  }
}

function verdictOf(dump) {
  if (dump === null) {
    return null
  }
  const match = /PACCO_CORS_RESULT:([^<\n]*)/.exec(dump)
  return match === null ? null : match[1].trim()
}

function notRun(reason) {
  console.error('')
  console.error('AC-16 (FR-11) NOT RUN')
  console.error(`  reason: ${reason}`)
  console.error('  The two cross-origin browser checks did not execute, so AC-16 is NOT')
  console.error('  discharged. It must be reported as "not run", never as passed')
  console.error('  (LOW_LEVEL_SPEC-13652-wave-1.md §L.6.2).')
  process.exit(EXIT_NOT_RUN)
}

async function main() {
  const allowedOrigin = readAllowedOrigin()
  const allowedPort = Number(new URL(allowedOrigin).port)
  const disallowedOrigin = `http://localhost:${DISALLOWED_PORT}`

  console.log('AC-16 / FR-11 cross-origin browser checks')
  console.log(`  gateway           ${GATEWAY_URL}`)
  console.log(`  allowed origin    ${allowedOrigin}     (expect ACCEPTED)`)
  console.log(`  disallowed origin ${disallowedOrigin}  (expect REJECTED)`)
  console.log('')

  if (!Number.isInteger(allowedPort) || allowedPort === 0) {
    notRun(`DEV_SERVER_ORIGIN "${allowedOrigin}" carries no port to serve the probe from`)
  }
  if (allowedPort === DISALLOWED_PORT) {
    notRun('PACCO_DISALLOWED_PORT equals the allowed port, so the two checks are not distinct')
  }

  const chromium = await findChromium()
  if (chromium === null) {
    notRun(`no usable Chromium binary (tried: ${CHROMIUM_CANDIDATES.join(', ')})`)
  }
  console.log(`  chromium          ${chromium}`)

  if (!(await gatewayAnswers())) {
    notRun(`no gateway answering at ${GATEWAY_URL} — start the Docker Compose stack first`)
  }

  let allowedServer
  let disallowedServer
  try {
    allowedServer = await startOriginServer(allowedPort)
    disallowedServer = await startOriginServer(DISALLOWED_PORT)
  } catch (error) {
    if (allowedServer !== undefined) {
      await closeServer(allowedServer)
    }
    notRun(`could not bind a probe origin: ${error.message}`)
  }

  let allowedVerdict
  let disallowedVerdict
  try {
    allowedVerdict = verdictOf(await dumpDom(chromium, `${allowedOrigin}/`))
    disallowedVerdict = verdictOf(await dumpDom(chromium, `${disallowedOrigin}/`))
  } finally {
    await closeServer(allowedServer)
    await closeServer(disallowedServer)
  }

  if (allowedVerdict === null || disallowedVerdict === null) {
    notRun('the probe page did not report a verdict — Chromium produced no usable DOM')
  }

  console.log('')
  console.log(`  check 1  ${allowedOrigin} -> ${allowedVerdict}`)
  console.log(`  check 2  ${disallowedOrigin} -> ${disallowedVerdict}`)
  console.log('')

  const failures = []
  if (!allowedVerdict.startsWith('ACCEPTED')) {
    failures.push(
      `check 1 FAILED: the allowlisted origin ${allowedOrigin} was blocked by the browser ` +
        `(${allowedVerdict}). The gateway is not echoing this exact origin.`,
    )
  }
  if (!disallowedVerdict.startsWith('REJECTED')) {
    failures.push(
      `check 2 FAILED: the non-allowlisted origin ${disallowedOrigin} was ACCEPTED ` +
        `(${disallowedVerdict}). A wildcard or an over-broad origin is still in effect.`,
    )
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`  ${failure}`)
    }
    process.exit(EXIT_FAIL)
  }

  console.log('  AC-16 PASSED: both cross-origin browser checks behaved as specified.')
  process.exit(EXIT_PASS)
}

main().catch((error) => {
  notRun(`unexpected error: ${error.message}`)
})
