/**
 * Reads the host ports the Pacco Docker Compose backend actually publishes.
 *
 * ## Why this exists
 *
 * PR review on this branch reported the concrete failure this module makes
 * impossible to repeat: "Port 3000 is already in use by Pacco grafana docker
 * container, use some other port." `DEV_SERVER_ORIGIN` is pinned with
 * `strictPort: true` (see `src/config/devServerOrigin.ts` and `vite.config.ts`)
 * so that the origin the gateway allowlists cannot silently stop matching —
 * which means a collision with the Compose backend is not a fallback to some
 * other port, it is a dev server that refuses to start while the backend is up.
 * ADR-021 §4 requires this client to run "as a local process beside the Compose
 * backend", so a port the backend publishes is a port this client cannot have.
 *
 * The port map is READ from `Pacco/compose/*.yml` rather than transcribed. A
 * transcribed list is only correct until someone adds a service: the gateway's
 * own guard carried one, and it had already fallen behind
 * `compose/services.yml:83` (`5015`, ordermaker-service) and
 * `compose/infrastructure.yml:46` (`5778`, jaeger). Reading the real files means
 * a new published port is covered the moment it lands.
 *
 * Resolution mirrors `../gateway/gatewayConfigDir.ts`: an explicit
 * `PACCO_COMPOSE_DIR` first, then the sibling checkout names seen in practice.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

/** Sibling checkout names seen in practice, most specific first. */
const SIBLING_NAMES = ['hianshul100_Pacco', 'Pacco', 'pacco']

const COMPOSE_SUBPATH = 'compose'

const WORKSPACE_ROOT = resolve(__dirname, '..', '..', '..')

/**
 * Files that must be present for a directory to be recognised as the Compose
 * directory — the two the Pacco README's runbook starts.
 */
const MARKER_FILES = ['infrastructure.yml', 'services.yml']

function holdsComposeFiles(dir: string): boolean {
  return MARKER_FILES.every((name) => existsSync(join(dir, name)))
}

/**
 * @returns the directory holding the Pacco Compose files, or `null` when no
 * candidate holds them.
 */
export function resolveComposeDir(): string | null {
  const override = process.env.PACCO_COMPOSE_DIR
  if (override !== undefined && override !== '') {
    const dir = isAbsolute(override) ? override : resolve(process.cwd(), override)
    // An override that does not resolve is a mistake worth surfacing, so it is
    // returned as `null` rather than silently falling through to a guessed
    // sibling that would then be checked instead of the one that was named.
    return holdsComposeFiles(dir) ? dir : null
  }

  for (const name of SIBLING_NAMES) {
    const dir = join(WORKSPACE_ROOT, name, COMPOSE_SUBPATH)
    if (holdsComposeFiles(dir)) {
      return dir
    }
  }

  return null
}

/** Where a published port was found, for an actionable failure message. */
export interface PublishedPort {
  readonly port: number
  readonly source: string
}

/**
 * Matches a Compose short-syntax port publication: `- 3000:3000`,
 * `- '9090:9090'`, `- 5775:5775/udp`, `- 5001:80 ` (trailing space, as in
 * `services.yml:20`). Both sides must be numeric, so a list entry that merely
 * contains a colon — a URL, a label, an env assignment — cannot be read as a
 * port publication.
 */
const SHORT_SYNTAX_PORT = /^\s*-\s*['"]?(\d+):(\d+)(?:\/(?:tcp|udp))?['"]?\s*$/

/**
 * @returns every host port published by any `*.yml` in `dir`, ascending, each
 * tagged with the `file:line` it came from.
 *
 * Every protocol is included. A UDP-only publication cannot literally collide
 * with the dev server's TCP bind, but a port the backend has claimed is still
 * not one this client should be serving on, and keeping the rule "the backend
 * publishes it, so we do not take it" free of protocol caveats is what makes it
 * checkable.
 */
export function readPublishedHostPorts(dir: string): PublishedPort[] {
  const found = new Map<number, string>()

  for (const name of readdirSync(dir)
    .filter((entry) => entry.endsWith('.yml'))
    .sort()) {
    const lines = readFileSync(join(dir, name), 'utf8').split('\n')
    lines.forEach((line, index) => {
      const match = SHORT_SYNTAX_PORT.exec(line)
      if (match === null) {
        return
      }
      const port = Number(match[1])
      if (!found.has(port)) {
        found.set(port, `${name}:${index + 1}`)
      }
    })
  }

  return [...found.entries()]
    .map(([port, source]) => ({ port, source }))
    .sort((a, b) => a.port - b.port)
}

/** True when this run must not let a missing checkout pass as a skip. */
export function isContinuousIntegration(): boolean {
  const ci = process.env.CI
  return ci !== undefined && ci !== '' && ci.toLowerCase() !== 'false' && ci !== '0'
}

export const MISSING_COMPOSE_MESSAGE = [
  'The Pacco checkout holding compose/*.yml was not found.',
  `Looked for ${COMPOSE_SUBPATH}/ under ${SIBLING_NAMES.join(', ')} beside ${WORKSPACE_ROOT},`,
  'and at $PACCO_COMPOSE_DIR (unset or incomplete).',
  'The dev-server port collision check is therefore NOT discharged by this run.',
  'Set PACCO_COMPOSE_DIR to the Pacco checkout compose directory.',
].join('\n')
