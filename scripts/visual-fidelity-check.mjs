#!/usr/bin/env node
/**
 * Visual fidelity check — `/login` against its committed design reference.
 *
 * Review of the delivery raised that the visual result was **unverified**: the
 * agreement figure in `docs/DESIGN_APPROXIMATION.md` §4 was produced by hand,
 * and the reference it was measured against lived at the workspace root under
 * `.attachments/` — outside every repository, so nobody reviewing the pull
 * request could reproduce it. Both halves are fixed here: the reference is
 * committed at `docs/design-reference/02_login-page-ux.png`, and this script
 * re-measures against it on demand.
 *
 * ⚠️ There is no Figma file for this capability to re-fetch. The design source
 * of record is the four static images supplied with the ticket
 * (`LOW_LEVEL_SPEC-13652-wave-1.md` §L.12.1: "No Figma file, Figma URL or node
 * id exists for capability 13652"). A "missed Figma fetch" is therefore not a
 * defect that can be remedied — the comp IS the source, and this check measures
 * against it.
 *
 * What it does:
 *   1. serves `dist/` (build output) from an ephemeral loopback port;
 *   2. screenshots `/login` in headless Chromium at the reference image's own
 *      native size, so boxes can be compared without rescaling;
 *   3. draws the capture and the reference into two canvases in that same
 *      origin and computes the mean absolute per-channel difference;
 *   4. reports whole-page agreement plus a four-band breakdown, and compares
 *      the whole-page figure with the gate.
 *
 * The comparison runs inside Chromium rather than in Node because this
 * repository has no image-decoding dependency and must not acquire one for a
 * verification script. The same approach — drive the browser, read the verdict
 * back out of the DOM — is already used by `scripts/cors-browser-check.mjs`.
 *
 * ⚠️ NOT RUN is a first-class outcome, as it is for the cross-origin checks:
 * where Chromium is unavailable or `dist/` has not been built this exits 2 and
 * says so, because `LOW_LEVEL_SPEC-13652-wave-1.md` §L.6.2 requires an
 * unexecuted check to be reported as "not run" and never as passed.
 *
 * Usage:
 *   npm run build
 *   node scripts/visual-fidelity-check.mjs [--keep]
 *
 * Environment overrides:
 *   CHROMIUM_BIN        explicit path to a Chromium/Chrome binary
 *   PACCO_VISUAL_GATE   minimum whole-page agreement, percent (default 95)
 *
 * Exit codes: 0 = at or above the gate, 1 = below it, 2 = NOT RUN.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST_DIR = join(REPO_ROOT, 'dist')
const REFERENCE = join(REPO_ROOT, 'docs', 'design-reference', '02_login-page-ux.png')

const EXIT_PASS = 0
const EXIT_FAIL = 1
const EXIT_NOT_RUN = 2

/** The route under test, and the reference that fixes its layout. */
const ROUTE = '/login'

/** Vertical bands, reported separately so a residual can be located. */
const BAND_COUNT = 4

const GATE = Number(process.env.PACCO_VISUAL_GATE ?? '95')
const KEEP = process.argv.includes('--keep')

const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_BIN,
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable',
].filter((candidate) => candidate !== undefined && candidate !== '')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
}

function notRun(reason) {
  console.error('')
  console.error('VISUAL FIDELITY CHECK NOT RUN')
  console.error(`  reason: ${reason}`)
  console.error('  The screen was not measured against its reference, so its visual')
  console.error('  result is NOT verified by this run. It must be reported as "not run",')
  console.error('  never as passed (LOW_LEVEL_SPEC-13652-wave-1.md §L.6.2).')
  process.exit(EXIT_NOT_RUN)
}

/**
 * Reads a PNG's pixel dimensions out of its IHDR chunk. Eight bytes of header
 * parsing is cheaper — and far easier to audit — than a decoding dependency;
 * the pixels themselves are decoded by the browser, not here.
 */
function pngSize(path) {
  const header = readFileSync(path).subarray(0, 33)
  if (header.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${path} is not a PNG`)
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
}

/** Serves `dist/`, plus the two images and the comparison page, from one origin. */
function startServer(capturePath) {
  const extras = new Map([
    ['/__visual__/capture.png', capturePath],
    ['/__visual__/reference.png', REFERENCE],
  ])

  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname

      if (path === '/__visual__/compare') {
        response.writeHead(200, { 'content-type': MIME['.html'] })
        response.end(comparePage())
        return
      }

      const extra = extras.get(path)
      if (extra !== undefined && existsSync(extra)) {
        response.writeHead(200, { 'content-type': MIME['.png'] })
        response.end(readFileSync(extra))
        return
      }

      // `normalize` collapses any `..` segment before the prefix check, so a
      // traversal attempt resolves outside `dist/` and is refused below.
      const candidate = normalize(join(DIST_DIR, path))
      const isFile =
        candidate.startsWith(DIST_DIR) && existsSync(candidate) && statSync(candidate).isFile()

      // Anything that is not a real file falls back to index.html: the client
      // is a single-page application and `/login` exists only in its router.
      const file = isFile ? candidate : join(DIST_DIR, 'index.html')
      response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      response.end(readFileSync(file))
    })

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
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

/**
 * The page that does the measuring. Both images come from this page's own
 * origin, so the canvases stay untainted and `getImageData` is permitted.
 */
function comparePage() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>pacco visual compare</title></head>
<body><pre id="verdict">PENDING</pre>
<script>
  const BANDS = ${BAND_COUNT}
  const say = (text) => { document.getElementById('verdict').textContent = 'PACCO_VISUAL_RESULT:' + text }
  const load = (src) => new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('could not load ' + src))
    image.src = src
  })
  const pixels = (image) => {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    return context.getImageData(0, 0, canvas.width, canvas.height).data
  }
  Promise.all([load('/__visual__/capture.png'), load('/__visual__/reference.png')])
    .then(([capture, reference]) => {
      const width = reference.naturalWidth
      const height = reference.naturalHeight
      if (capture.naturalWidth !== width || capture.naturalHeight !== height) {
        say(JSON.stringify({ error: 'size-mismatch',
          capture: [capture.naturalWidth, capture.naturalHeight], reference: [width, height] }))
        return
      }
      const a = pixels(capture)
      const b = pixels(reference)
      // Alpha is skipped: both images are opaque, and including a constant
      // channel would dilute the figure towards a flattering number.
      let total = 0
      const bandTotal = new Array(BANDS).fill(0)
      const bandCount = new Array(BANDS).fill(0)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
          total += d
          const band = Math.min(BANDS - 1, Math.floor((x / width) * BANDS))
          bandTotal[band] += d
          bandCount[band] += 3
        }
      }
      say(JSON.stringify({
        width, height,
        mad: total / (width * height * 3),
        bands: bandTotal.map((sum, index) => sum / bandCount[index]),
      }))
    })
    .catch((error) => { say(JSON.stringify({ error: String(error && error.message) })) })
</script></body></html>`
}

/** Runs Chromium headless. Resolves to its stdout, or null when it could not run. */
function chromium(binary, args) {
  return new Promise((resolve) => {
    const child = spawn(
      binary,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        // Advances the page clock so images decode and the measurement settles
        // before the dump, without this script polling or sleeping.
        '--virtual-time-budget=15000',
        ...args,
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
    const dump = await chromium(candidate, ['--dump-dom', 'data:text/html,<p>pacco</p>'])
    if (dump !== null && dump.includes('pacco')) {
      return candidate
    }
  }
  return null
}

function verdictOf(dump) {
  if (dump === null) {
    return null
  }
  const match = /PACCO_VISUAL_RESULT:([^<\n]*)/.exec(dump)
  if (match === null) {
    return null
  }
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

async function main() {
  if (!existsSync(REFERENCE)) {
    notRun(`the design reference is missing at ${REFERENCE}`)
  }
  if (!existsSync(join(DIST_DIR, 'index.html'))) {
    notRun("dist/ has not been built. Run `npm run build` first, then re-run this check.")
  }

  const binary = await findChromium()
  if (binary === null) {
    notRun(
      `no usable Chromium binary was found (tried: ${CHROMIUM_CANDIDATES.join(', ')}). ` +
        'Set CHROMIUM_BIN to one.',
    )
  }

  const { width, height } = pngSize(REFERENCE)
  const workDir = mkdtempSync(join(tmpdir(), 'pacco-visual-'))
  const capturePath = join(workDir, 'capture.png')

  console.log('Visual fidelity check — /login against its committed reference')
  console.log(`  reference : docs/design-reference/02_login-page-ux.png (${width}×${height})`)
  console.log(`  chromium  : ${binary}`)
  console.log(`  gate      : ${GATE}% whole-page agreement`)
  console.log('')

  const server = await startServer(capturePath)
  const base = `http://127.0.0.1:${server.address().port}`

  // The status is returned rather than exited on from inside the block:
  // `process.exit` would terminate before the server was closed and before the
  // capture's fate was decided.
  let status = EXIT_PASS
  try {
    // The window is the reference's own native size, so the capture is
    // comparable pixel-for-pixel with no rescaling anywhere.
    const shot = await chromium(binary, [
      `--screenshot=${capturePath}`,
      `--window-size=${width},${height}`,
      `${base}${ROUTE}`,
    ])
    if (shot === null && !existsSync(capturePath)) {
      notRun(`Chromium did not produce a screenshot of ${ROUTE}`)
    }

    const verdict = verdictOf(await chromium(binary, ['--dump-dom', `${base}/__visual__/compare`]))
    if (verdict === null) {
      notRun('the comparison page did not report a result')
    }
    if (verdict.error === 'size-mismatch') {
      console.error(
        `  FAIL  capture is ${verdict.capture.join('×')}, reference is ${verdict.reference.join('×')} —` +
          ' the two cannot be compared pixel-for-pixel',
      )
      status = EXIT_FAIL
      return status
    }
    if (verdict.error !== undefined) {
      notRun(`the comparison page reported: ${verdict.error}`)
    }

    const agreement = 100 - (verdict.mad / 255) * 100
    console.log(`  whole page : ${agreement.toFixed(1)}% agreement (mean |Δ| ${verdict.mad.toFixed(2)}/255)`)
    console.log('')
    console.log('  Vertical bands, left to right:')
    verdict.bands.forEach((mad, index) => {
      const from = Math.round((index / BAND_COUNT) * width)
      const to = Math.round(((index + 1) / BAND_COUNT) * width)
      console.log(`    x ${String(from).padStart(4)}–${String(to).padStart(4)} : ` +
        `${(100 - (mad / 255) * 100).toFixed(1)}% (mean |Δ| ${mad.toFixed(2)}/255)`)
    })
    console.log('')

    if (agreement + 1e-9 < GATE) {
      console.error(`RESULT: FAIL — ${agreement.toFixed(1)}% is below the ${GATE}% gate.`)
      console.error(`        The capture is kept at ${capturePath} for inspection.`)
      status = EXIT_FAIL
      return status
    }

    console.log(`RESULT: PASS — ${agreement.toFixed(1)}% is at or above the ${GATE}% gate.`)
    console.log('')
    console.log('NOTE: a high pixel score says the supplied comp was matched. It says')
    console.log('      nothing about token names, ramp steps, or any state the comp does')
    console.log('      not show — see docs/DESIGN_APPROXIMATION.md.')
    return status
  } finally {
    await closeServer(server)
    // A failing capture is left on disk: the number alone does not show a
    // reviewer WHAT diverged.
    if (KEEP) {
      console.log(`Capture kept at ${capturePath}`)
    } else if (status !== EXIT_FAIL) {
      rmSync(workDir, { recursive: true, force: true })
    }
  }
}

process.exit(await main())
