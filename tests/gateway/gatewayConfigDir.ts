/**
 * Locates the sibling Pacco.APIGateway checkout that holds the four `ntrada*.yml`
 * files guarded by SPECIFICATION.md §16 AC-15.
 *
 * ⚠️ This resolver is a CONVENIENCE, not the guard of record. The authoritative,
 * self-contained AC-15 guard lives inside the gateway repository itself
 * (`Pacco.APIGateway/scripts/verify-cors-config.sh`, wired into
 * `scripts/test.sh`), so a regression in an `ntrada*.yml` fails that repository's
 * own build without depending on this checkout being present. The checks here
 * are a second pair of eyes from the client side, which is where
 * `DEV_SERVER_ORIGIN` — the value the origin must equal — is actually defined.
 *
 * Resolution order:
 *   1. `PACCO_GATEWAY_CONFIG_DIR`, an explicit absolute or relative path.
 *   2. Any of the known sibling directory names beside this repository.
 * An earlier revision hard-coded a single sibling name, which broke the moment a
 * workspace laid the checkout out under any other name.
 */
import { existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

export const CONFIG_FILES = [
  'ntrada.yml',
  'ntrada.docker.yml',
  'ntrada-async.yml',
  'ntrada-async.docker.yml',
] as const

/** Sibling checkout names seen in practice, most specific first. */
const SIBLING_NAMES = ['hianshul100_Pacco.APIGateway', 'Pacco.APIGateway', 'pacco.apigateway']

const CONFIG_SUBPATH = join('src', 'Pacco.APIGateway')

const WORKSPACE_ROOT = resolve(__dirname, '..', '..', '..')

function holdsEveryConfigFile(dir: string): boolean {
  return CONFIG_FILES.every((name) => existsSync(join(dir, name)))
}

/**
 * @returns the directory holding the four `ntrada*.yml` files, or `null` when no
 * candidate holds all four.
 */
export function resolveGatewayConfigDir(): string | null {
  const override = process.env.PACCO_GATEWAY_CONFIG_DIR
  if (override !== undefined && override !== '') {
    const dir = isAbsolute(override) ? override : resolve(process.cwd(), override)
    // An override that does not resolve is a mistake worth surfacing, so it is
    // returned even when incomplete rather than silently falling through to a
    // guessed sibling.
    return holdsEveryConfigFile(dir) ? dir : null
  }

  for (const name of SIBLING_NAMES) {
    const dir = join(WORKSPACE_ROOT, name, CONFIG_SUBPATH)
    if (holdsEveryConfigFile(dir)) {
      return dir
    }
  }

  return null
}

/** True when this run must not let a missing checkout pass as a skip. */
export function isContinuousIntegration(): boolean {
  const ci = process.env.CI
  return ci !== undefined && ci !== '' && ci.toLowerCase() !== 'false' && ci !== '0'
}

export const MISSING_CHECKOUT_MESSAGE = [
  'The Pacco.APIGateway checkout holding the four ntrada*.yml files was not found.',
  `Looked for ${CONFIG_SUBPATH} under ${SIBLING_NAMES.join(', ')} beside ${WORKSPACE_ROOT},`,
  'and at $PACCO_GATEWAY_CONFIG_DIR (unset or incomplete).',
  'AC-15 is therefore NOT discharged by this run. Set PACCO_GATEWAY_CONFIG_DIR, or run',
  "the gateway's own guard: Pacco.APIGateway/scripts/verify-cors-config.sh.",
].join('\n')
