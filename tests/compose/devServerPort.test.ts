/**
 * The dev-server port must be one this client can actually bind while the Pacco
 * Docker Compose backend is running.
 *
 * PR review on this branch: "Port 3000 is already in use by Pacco grafana docker
 * container, use some other port." The port moved to `5173`; these tests are why
 * it cannot move back onto an occupied one. They read the real
 * `Pacco/compose/*.yml` port map rather than a transcribed list, so a service
 * added to Compose tomorrow is covered without anyone remembering to update a
 * literal here.
 *
 * ADR-021 §4 ("Pacco.Web runs as a local process beside the Compose backend")
 * and §6.3 item 1 (the client takes no port in the platform's 5000-5009 block)
 * are the two rules being enforced.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { DEV_SERVER_ORIGIN } from '@/config/devServerOrigin'

import { resolveGatewayConfigDir } from '../gateway/gatewayConfigDir'

import {
  MISSING_COMPOSE_MESSAGE,
  isContinuousIntegration,
  readPublishedHostPorts,
  resolveComposeDir,
} from './composeHostPorts'

/** The platform's own service block; the gateway itself is 5000. */
const PLATFORM_PORT_BLOCK_START = 5000
const PLATFORM_PORT_BLOCK_END = 5009

const composeDir = resolveComposeDir()

// In CI the assertions run unconditionally: with no checkout they throw on the
// first read, which is exactly the loud failure a gate needs.
const describeCompose = composeDir !== null || isContinuousIntegration() ? describe : describe.skip

function publishedPorts(): ReturnType<typeof readPublishedHostPorts> {
  if (composeDir === null) {
    throw new Error(MISSING_COMPOSE_MESSAGE)
  }
  return readPublishedHostPorts(composeDir)
}

const devServerPort = Number(new URL(DEV_SERVER_ORIGIN).port)

describe('dev server origin', () => {
  it('carries an explicit port, because the gateway allowlists it exactly', () => {
    expect(new URL(DEV_SERVER_ORIGIN).port).not.toBe('')
    expect(Number.isInteger(devServerPort)).toBe(true)
  })

  it('stays outside the platform 5000-5009 service block', () => {
    expect(
      devServerPort >= PLATFORM_PORT_BLOCK_START && devServerPort <= PLATFORM_PORT_BLOCK_END,
    ).toBe(false)
  })
})

describeCompose('dev server port against the Compose backend', () => {
  it('is not a host port the Compose backend publishes', () => {
    const collision = publishedPorts().find((entry) => entry.port === devServerPort)
    // The message names the file and line, so the next person does not have to
    // go looking for which container already holds the port.
    expect(
      collision === undefined
        ? null
        : `${DEV_SERVER_ORIGIN} collides with compose/${collision.source}`,
    ).toBeNull()
  })

  it('reads a non-empty port map, so a parse failure cannot read as "no collision"', () => {
    const ports = publishedPorts().map((entry) => entry.port)
    expect(ports.length).toBeGreaterThan(10)
    // Anchors on the two the review turned on: grafana, and the gateway itself.
    expect(ports).toContain(3000)
    expect(ports).toContain(PLATFORM_PORT_BLOCK_START)
  })
})

/**
 * The gateway repository guards the same rule from its side
 * (`scripts/verify-cors-config.sh` check 4b), but it has no Pacco checkout to
 * read, so its port map is a literal. This test is the only place both files are
 * visible at once, which makes it the only place that literal can be held to the
 * real Compose map.
 */
const gatewayConfigDir = resolveGatewayConfigDir()
const gatewayRoot = gatewayConfigDir === null ? null : resolve(gatewayConfigDir, '..', '..')

const describeGuardDrift = composeDir !== null && gatewayRoot !== null ? describe : describe.skip

describeGuardDrift("gateway guard's transcribed Compose port list", () => {
  function guardPorts(): number[] {
    const script = readFileSync(
      join(gatewayRoot as string, 'scripts', 'verify-cors-config.sh'),
      'utf8',
    )
    const match = /^COMPOSE_HOST_PORTS=\(([^)]*)\)/m.exec(script)
    if (match === null) {
      throw new Error('COMPOSE_HOST_PORTS was not found in scripts/verify-cors-config.sh')
    }
    return match[1].trim().split(/\s+/).map(Number)
  }

  it('covers every host port the Compose backend publishes', () => {
    const declared = new Set(guardPorts())
    const missing = publishedPorts()
      .filter(
        (entry) =>
          !declared.has(entry.port) &&
          !(entry.port >= PLATFORM_PORT_BLOCK_START && entry.port <= PLATFORM_PORT_BLOCK_END),
      )
      .map((entry) => `${entry.port} (compose/${entry.source})`)

    expect(missing).toEqual([])
  })

  it('declares only numeric ports', () => {
    expect(guardPorts().every((port) => Number.isInteger(port) && port > 0)).toBe(true)
  })
})
