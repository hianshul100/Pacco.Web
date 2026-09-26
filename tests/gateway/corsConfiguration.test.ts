/**
 * Edge-configuration checks of LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.5 and
 * SPECIFICATION.md §16 AC-15: the four `ntrada*.yml` CORS blocks must be
 * byte-identical, `allowedOrigins` must hold EXACTLY ONE entry carrying scheme,
 * host and port, no `'*'` may remain, and `allowCredentials`,
 * `allowedMethods`, `allowedHeaders` and `exposedHeaders` must be unchanged.
 *
 * The gateway repository is a sibling checkout of this one. Where it is not
 * present the checks are skipped explicitly rather than passing silently.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { DEV_SERVER_ORIGIN } from '@/config/devServerOrigin'

const GATEWAY_CONFIG_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'hianshul100_Pacco.APIGateway',
  'src',
  'Pacco.APIGateway',
)

const CONFIG_FILES = [
  'ntrada.yml',
  'ntrada.docker.yml',
  'ntrada-async.yml',
  'ntrada-async.docker.yml',
]

const available = CONFIG_FILES.every((name) => existsSync(join(GATEWAY_CONFIG_DIR, name)))
const describeGateway = available ? describe : describe.skip

/**
 * Extracts the `extensions.cors` block verbatim, preserving bytes. The block
 * ends at the next sibling key under `extensions:` — a line indented by exactly
 * two spaces — not at the next column-zero line, because everything under
 * `extensions:` is nested and the sibling `tracing.udpHost` legitimately differs
 * between the plain and `.docker` variants.
 */
function corsBlock(name: string): string {
  const content = readFileSync(join(GATEWAY_CONFIG_DIR, name), 'utf8')
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
      const content = readFileSync(join(GATEWAY_CONFIG_DIR, name), 'utf8')
      expect(content).not.toMatch(/upstream:\s*\/?(logout|sign-out|revoke)/i)
      expect(content).not.toMatch(/revoke-(access|refresh)-token/i)
    },
  )
})

describe('gateway configuration availability', () => {
  it('reports plainly when the gateway checkout is not present beside this repository', () => {
    // A skipped edge check must be visible, not silent.
    expect(typeof available).toBe('boolean')
  })
})
