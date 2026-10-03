/**
 * The API Gateway's cross-origin policy.
 *
 * Source rows: TC-13652-044, 045, 046, 069, 070.
 *
 * The change under test replaces a wildcard allowed origin with the browser
 * client's exact local origin, keeps credentials enabled, and touches nothing
 * else. Two of these rows read the gateway's four configuration files; three
 * put real requests through the running edge.
 *
 * All five are tagged `@live` because all five need the gateway checkout - the
 * configuration rows need its files, the request rows need it running. The
 * offline projects therefore exclude them, and CI supplies both in the
 * `live-tests` job. README.md records the two environment variables that point
 * the suite at a checkout in a different place.
 */
import { GATEWAY_CONFIG_FILES } from '../../support/env'
import { expect, test } from '../../support/fixtures'
import { readAtRevision, readGatewayConfig } from '../../support/sourceScan'

/**
 * Pulls the allowed-origin entries out of an Ntrada configuration file.
 *
 * A regex rather than a YAML dependency: the suite adds no parser for one key,
 * and the shape being matched is a flat list under a known heading.
 */
function allowedOrigins(config: string): readonly string[] {
  const block = /allowedOrigins\s*:\s*\n((?:\s*-\s*.*\n?)+)/.exec(config)
  if (block === null) {
    // A single inline value is also valid YAML.
    const inline = /allowedOrigins\s*:\s*(.+)/.exec(config)
    const value = inline?.[1]?.trim() ?? ''
    return value === '' ? [] : [value.replace(/^['"]|['"]$/g, '')]
  }
  return (block[1] ?? '')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*-\s*/, '')
        .trim()
        .replace(/^['"]|['"]$/g, ''),
    )
    .filter((line) => line.length > 0)
}

function booleanKey(config: string, key: string): boolean | null {
  const found = new RegExp(`${key}\\s*:\\s*(true|false)`, 'i').exec(config)
  const value = found?.[1]
  return value === undefined ? null : value.toLowerCase() === 'true'
}

test.describe('Gateway cross-origin policy @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-044 Verify that all four gateway configuration files carry the identical single-origin policy @live @layer:static @ac:AC-15 @intent:regression', async ({
    env,
    logger,
  }) => {
    expect(
      env.gatewayConfigDir,
      'no gateway checkout was found; set PACCO_GATEWAY_CONFIG_DIR',
    ).not.toBeNull()

    const policies = GATEWAY_CONFIG_FILES.map((fileName) => {
      const config = readGatewayConfig(env.gatewayConfigDir, fileName)
      expect(config, `${fileName} is missing from the gateway checkout`).not.toBeNull()
      return { fileName, origins: allowedOrigins(config ?? ''), config: config ?? '' }
    })

    expect(policies, 'the CSV names four configuration files').toHaveLength(4)
    logger.info('read gateway configuration files', { count: policies.length })

    for (const policy of policies) {
      // Exactly one origin, and it is the client's own.
      expect(
        policy.origins,
        `${policy.fileName} must allow exactly the browser client's origin`,
      ).toEqual([env.webBaseUrl])
      expect(policy.origins, `${policy.fileName} must not allow a wildcard origin`).not.toContain(
        '*',
      )

      // Credentials stay enabled, which is what makes the exact origin
      // mandatory: a wildcard and credentials cannot be combined.
      expect(
        booleanKey(policy.config, 'allowCredentials'),
        `${policy.fileName} must keep credentials enabled`,
      ).toBe(true)
    }

    // And the four files agree with one another, not merely with the client.
    const distinct = new Set(policies.map((policy) => policy.origins.join('|')))
    expect(distinct.size, `the four files disagree: ${[...distinct].join(' / ')}`).toBe(1)
  })

  test('TC-13652-045 Verify that a browser request from the allowed origin is accepted and echoed @live @layer:api @ac:AC-16 @intent:smoke', async ({
    env,
    request,
  }) => {
    const response = await request.post(env.signInUrl, {
      headers: { origin: env.webBaseUrl, 'content-type': 'application/json' },
      data: { email: env.accounts.standard.email, password: env.accounts.standard.password },
      failOnStatusCode: false,
    })

    expect(response.status(), 'the allowed origin must be served normally').toBe(200)

    const headers = response.headers()
    // The exact origin is echoed back - never a wildcard, which the browser
    // would refuse to combine with credentials.
    expect(headers['access-control-allow-origin']).toBe(env.webBaseUrl)
    expect(headers['access-control-allow-origin']).not.toBe('*')
    expect(headers['access-control-allow-credentials']).toBe('true')
    expect(headers['vary'] ?? '', 'the response must vary on Origin').toContain('Origin')

    // The pre-flight agrees with the actual response.
    const preflight = await request.fetch(env.signInUrl, {
      method: 'OPTIONS',
      headers: {
        origin: env.webBaseUrl,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
      failOnStatusCode: false,
    })
    expect(preflight.headers()['access-control-allow-origin']).toBe(env.webBaseUrl)
    expect(preflight.headers()['access-control-allow-methods'] ?? '').toContain('POST')
  })

  test('TC-13652-046 Verify that a browser request from a different origin is refused by the cross-origin policy @live @layer:api @ac:AC-16 @intent:regression', async ({
    env,
    request,
  }) => {
    const response = await request.post(env.signInUrl, {
      headers: { origin: env.disallowedOriginUrl, 'content-type': 'application/json' },
      data: { email: env.accounts.standard.email, password: env.accounts.standard.password },
      failOnStatusCode: false,
    })

    const allowOrigin = response.headers()['access-control-allow-origin']

    // The gateway may still process the request - cross-origin rules are
    // enforced by the browser - but it must never tell the browser that this
    // origin is permitted, and never answer with a wildcard.
    expect(
      allowOrigin,
      `the gateway echoed the disallowed origin ${env.disallowedOriginUrl}`,
    ).not.toBe(env.disallowedOriginUrl)
    expect(allowOrigin, 'the gateway must not answer with a wildcard origin').not.toBe('*')

    // The pre-flight refuses it too, which is where a real browser stops.
    const preflight = await request.fetch(env.signInUrl, {
      method: 'OPTIONS',
      headers: {
        origin: env.disallowedOriginUrl,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
      failOnStatusCode: false,
    })
    expect(preflight.headers()['access-control-allow-origin']).not.toBe(env.disallowedOriginUrl)
    expect(preflight.headers()['access-control-allow-origin']).not.toBe('*')
  })

  test('TC-13652-069 Verify that the gateway configuration change touches only the allowed-origin key @live @layer:static @ac:AC-24 @intent:regression', async ({
    env,
  }) => {
    expect(
      env.gatewayConfigDir,
      'no gateway checkout was found; set PACCO_GATEWAY_CONFIG_DIR',
    ).not.toBeNull()

    let compared = 0

    for (const fileName of GATEWAY_CONFIG_FILES) {
      const current = readGatewayConfig(env.gatewayConfigDir, fileName)
      expect(current, `${fileName} is missing from the gateway checkout`).not.toBeNull()

      const baseline = readAtRevision(env.gatewayConfigDir ?? '', env.gatewayBaselineRev, fileName)
      if (baseline === null) {
        // A shallow checkout has no baseline to diff against. Say so loudly
        // rather than letting the row pass on nothing.
        continue
      }
      compared += 1

      // Compare every line except the allowed-origin list. Nothing else in
      // these files may have moved: not a route, not a method, not an
      // authentication flag.
      const strip = (text: string): string =>
        text
          .split('\n')
          .filter((line) => !/allowedOrigins|^\s*-\s*https?:\/\//.test(line))
          .join('\n')

      expect(strip(current ?? ''), `${fileName} changed outside the allowed-origin key`).toBe(
        strip(baseline),
      )

      // And the one key that did change moved from a wildcard to the client.
      expect(allowedOrigins(current ?? '')).toEqual([env.webBaseUrl])
    }

    expect(
      compared,
      `no baseline revision "${env.gatewayBaselineRev}" was available to compare against`,
    ).toBeGreaterThan(0)
  })

  test('TC-13652-070 Verify that a non-browser caller sending no origin header still succeeds @live @layer:api @ac:AC-25 @intent:regression', async ({
    env,
    request,
  }) => {
    // No Origin header at all: a service-to-service or command-line caller.
    const response = await request.post(env.signInUrl, {
      headers: { 'content-type': 'application/json' },
      data: { email: env.accounts.standard.email, password: env.accounts.standard.password },
      failOnStatusCode: false,
    })

    expect(
      response.status(),
      'tightening the browser policy must not break non-browser callers',
    ).toBe(200)

    const body = (await response.json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(
      ['accessToken', 'expires', 'refreshToken', 'role'].sort(),
    )
    expect(typeof body['accessToken']).toBe('string')
  })
})
