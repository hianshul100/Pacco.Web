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

/**
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.6.A.4 NEG-10, second half: the landing wave
 * changes the gateway configuration in NO way at all.
 *
 * ⚠️ The task constraint is explicit -- "no new logout/revoke gateway route and
 * no change to the gateway's JWT validation/revocation behaviour" -- and
 * §L.9 lists every file under `Pacco.APIGateway` as a forbidden write. These
 * assertions are the client-side evidence that the constraint held.
 *
 * 🚫 No secret is reproduced here. The signing key lives in the gateway's own
 * configuration; these checks name KEYS and flags, never values.
 */
describeGateway('gateway configuration is untouched by the landing wave', () => {
  it.each(CONFIG_FILES)('%s keeps JWT validation stateless and deny-list free', (name) => {
    const content = readConfig(name)
    // ADR-007: validation at the edge is stateless. Logout is a client-side
    // session discard, so there is no revocation store for the edge to consult
    // and none was introduced.
    expect(content).not.toMatch(/revocation|deny-?list|black-?list|block-?list/i)
    // ADR-022: the session is bounded by the access token's own `exp`, which
    // only means anything while the edge still checks it.
    expect(content).toMatch(/validateLifetime:\s*true/)
    expect(content).toMatch(/validateIssuer:\s*true/)
  })

  it.each(CONFIG_FILES)('%s leaves the auth block and its role-claim mapping alone', (name) => {
    // The role the landing screen presents is the one the gateway maps from
    // this claim URI. 🚫 The client never invents, infers or renames it.
    expect(readConfig(name)).toContain(
      'auth:\n  enabled: true\n  global: false\n  claims:\n' +
        '    role: http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    )
  })

  it.each(CONFIG_FILES)('%s leaves customErrors alone', (name) => {
    expect(readConfig(name)).toContain('customErrors:\n    includeExceptionMessage: true')
  })

  it.each(CONFIG_FILES)('%s declares no route for the landing screen itself', (name) => {
    // The landing screen is a client route. It has no upstream, because it
    // makes no request: §L.3 item 3 rule 4.
    const content = readConfig(name)
    expect(content).not.toMatch(/upstream:\s*\/(welcome|landing)\b/i)
  })
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
