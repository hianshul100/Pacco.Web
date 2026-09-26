/**
 * Edge-configuration checks of LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.5 and
 * SPECIFICATION.md §16 AC-15: the four `ntrada*.yml` CORS blocks must be
 * byte-identical, `allowedOrigins` must hold EXACTLY ONE entry carrying scheme,
 * host and port, no `'*'` may remain, and `allowCredentials`,
 * `allowedMethods`, `allowedHeaders` and `exposedHeaders` must be unchanged.
 *
 * The gateway repository is a sibling checkout of this one; see
 * `gatewayConfigDir.ts` for how it is located and why the guard of record lives
 * in the gateway repository rather than here.
 *
 * ⚠️ Missing checkout: a previous revision flipped to `describe.skip` and then
 * asserted `typeof available === 'boolean'`, a tautology that reported green
 * while checking nothing. It now FAILS LOUDLY whenever `CI` is set, and locally
 * still fails the availability test with the full search path, so an absent
 * checkout can never read as a discharged AC-15.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { DEV_SERVER_ORIGIN } from '@/config/devServerOrigin'

import {
  CONFIG_FILES,
  MISSING_CHECKOUT_MESSAGE,
  isContinuousIntegration,
  resolveGatewayConfigDir,
} from './gatewayConfigDir'

const configDir = resolveGatewayConfigDir()

// In CI the assertions run unconditionally: with no checkout they throw on the
// first read, which is exactly the loud failure a gate needs.
const describeGateway = configDir !== null || isContinuousIntegration() ? describe : describe.skip

function readConfig(name: string): string {
  if (configDir === null) {
    throw new Error(MISSING_CHECKOUT_MESSAGE)
  }
  return readFileSync(join(configDir, name), 'utf8')
}

/**
 * Extracts the `extensions.cors` block verbatim, preserving bytes. The block
 * ends at the next sibling key under `extensions:` — a line indented by exactly
 * two spaces — not at the next column-zero line, because everything under
 * `extensions:` is nested and the sibling `tracing.udpHost` legitimately differs
 * between the plain and `.docker` variants.
 */
function corsBlock(name: string): string {
  const content = readConfig(name)
  const start = content.indexOf('  cors:')
  expect(start).toBeGreaterThan(-1)
  const rest = content.slice(start + '  cors:'.length)
  const end = rest.search(/\n {2}(?=\S)/)
  return content.slice(start, end === -1 ? undefined : start + '  cors:'.length + end)
}

function allowedOrigins(block: string): string[] {
  const section = block.slice(block.indexOf('allowedOrigins:') + 'allowedOrigins:'.length)
  const lines = section.split('\n').slice(1)
  const entries: string[] = []
  for (const line of lines) {
    const match = /^\s{6}- '?([^'\n]+)'?\s*$/.exec(line)
    if (match === null) {
      break
    }
    entries.push(match[1])
  }
  return entries
}

describeGateway('gateway CORS configuration', () => {
  it('keeps all four configuration files byte-identical in their cors block', () => {
    const blocks = CONFIG_FILES.map(corsBlock)
    for (const block of blocks) {
      expect(block).toBe(blocks[0])
    }
  })

  it.each(CONFIG_FILES)('%s allows EXACTLY ONE origin, with scheme, host and port', (name) => {
    const origins = allowedOrigins(corsBlock(name))
    expect(origins).toHaveLength(1)
    expect(origins[0]).toBe(DEV_SERVER_ORIGIN)
    expect(origins[0]).toMatch(/^https?:\/\/[^/\s:]+:\d+$/)
  })

  it.each(CONFIG_FILES)('%s retains no wildcard origin', (name) => {
    expect(allowedOrigins(corsBlock(name))).not.toContain('*')
  })

  it.each(CONFIG_FILES)('%s names the origin this client actually serves from', (name) => {
    expect(allowedOrigins(corsBlock(name))[0]).toBe(DEV_SERVER_ORIGIN)
  })

  it.each(CONFIG_FILES)('%s leaves allowCredentials true', (name) => {
    expect(corsBlock(name)).toContain('allowCredentials: true')
  })

  it.each(CONFIG_FILES)(
    '%s leaves allowedMethods, allowedHeaders and exposedHeaders untouched',
    (name) => {
      const block = corsBlock(name)
      expect(block).toContain('allowedMethods:\n      - post\n      - put\n      - delete')
      expect(block).toContain("allowedHeaders:\n      - '*'")
      expect(block).toContain(
        'exposedHeaders:\n      - Request-ID\n      - Resource-ID\n      - Trace-ID\n      - Total-Count',
      )
    },
  )

  it.each(CONFIG_FILES)(
    '%s adds no logout or revoke route and changes no auth flag on the sign-in route',
    (name) => {
      const content = readConfig(name)
      expect(content).not.toMatch(/upstream:\s*\/?(logout|sign-out|revoke)/i)
      expect(content).not.toMatch(/revoke-(access|refresh)-token/i)
    },
  )
})

describe('gateway configuration availability', () => {
  it('locates the four ntrada*.yml files, or fails with the full search path', () => {
    // A skipped edge check must be visible and must not read as a pass. The
    // failure carries the whole search path, so the reason is actionable rather
    // than "suite skipped".
    if (configDir === null) {
      throw new Error(MISSING_CHECKOUT_MESSAGE)
    }
    expect(CONFIG_FILES.map((name) => existsSync(join(configDir, name)))).toEqual(
      CONFIG_FILES.map(() => true),
    )
  })
})
