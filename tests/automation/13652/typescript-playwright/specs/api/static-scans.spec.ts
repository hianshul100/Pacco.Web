/**
 * What is written in the repository.
 *
 * Source rows: TC-13652-020, 021, 022, 043, 059, 072.
 *
 * None of these rows can be answered by driving a browser: they ask whether a
 * second backend address is hard-coded somewhere, whether a credential was
 * committed, whether a logging call site could ever receive a token. So they
 * read the checkout instead, and run in the `static-analysis` project.
 *
 * A scan that finds nothing because it looked at nothing is worthless, so each
 * row first asserts that it actually had files to read.
 */
import { join } from 'node:path'

import { expect, test } from '../../support/fixtures'
import {
  ABSOLUTE_ADDRESS_PATTERN,
  builtBundleFiles,
  clientScannableFiles,
  clientSourceFiles,
  describeScanHits,
  DIAGNOSTIC_CALL_PATTERN,
  directoryHasContent,
  findInSources,
  SECRET_PATTERNS,
} from '../../support/sourceScan'

/** Hosts that are namespaces or documentation links, never network calls. */
const NON_NETWORK_HOSTS = ['www.w3.org', 'w3.org', 'schema.org', 'developer.mozilla.org']

function hostOf(address: string): string {
  try {
    return new URL(address).host
  } catch {
    return address
  }
}

test.describe('Static source scans @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-020 Verify that no host or port other than the configured gateway appears in source @layer:static @ac:AC-6 @intent:regression', async ({
    env,
    logger,
  }) => {
    const files = clientSourceFiles(env.clientRepoDir)
    expect(files.length, `no client sources were found under ${env.clientRepoDir}/src`).toBeGreaterThan(0)

    const hits = findInSources(files, ABSOLUTE_ADDRESS_PATTERN)
    logger.info('absolute address literals found', { count: hits.length })

    const allowedHosts = new Set([
      hostOf(env.gatewayBaseUrl),
      hostOf(env.webBaseUrl),
      ...NON_NETWORK_HOSTS,
    ])
    const unexpected = hits.filter((hit) => !allowedHosts.has(hostOf(hit.match)))

    expect(
      unexpected,
      `an address outside the configured gateway is hard-coded:\n${describeScanHits(unexpected)}`,
    ).toEqual([])

    // The gateway address itself is declared in exactly one place, and it is
    // read from configuration rather than written into a component.
    const declarations = findInSources(
      files,
      /(?:VITE_[A-Z_]*API[A-Z_]*|apiBaseUrl|gatewayBaseUrl|BASE_URL)\s*[:=]/,
    )
    const declaringFiles = new Set(declarations.map((hit) => hit.relativePath))
    expect(
      declaringFiles.size,
      `the backend address is declared in ${declaringFiles.size} modules: ${[...declaringFiles].join(', ')}`,
    ).toBe(1)
  })

  test('TC-13652-021 Verify that a secret scan of the client source finds no credential @layer:static @ac:AC-7 @intent:regression', async ({
    env,
    logger,
  }) => {
    const files = clientScannableFiles(env.clientRepoDir)
    expect(files.length, `nothing was scanned under ${env.clientRepoDir}`).toBeGreaterThan(0)
    logger.info('scanning client sources for secrets', { fileCount: files.length })

    for (const rule of SECRET_PATTERNS) {
      const hits = findInSources(files, rule.pattern)
      expect(
        hits,
        `a committed credential matched "${rule.name}":\n${describeScanHits(hits)}`,
      ).toEqual([])
    }

    // No real environment file was committed alongside the template.
    const committedEnv = files.filter(
      (file) => file.relativePath === '.env' || /(^|\/)\.env\.(?!example)/.test(file.relativePath),
    )
    expect(
      committedEnv.map((file) => file.relativePath),
      'only .env.example may be committed',
    ).toEqual([])
  })

  test('TC-13652-022 Verify that a secret scan of the built browser bundle finds no credential @layer:static @ac:AC-7 @intent:regression', async ({
    env,
    logger,
  }) => {
    const distDir = join(env.clientRepoDir, 'dist')

    // The bundle has to exist for this row to mean anything. Failing here says
    // "build the client first" rather than passing on an empty scan.
    expect(
      directoryHasContent(distDir),
      `no built bundle at ${distDir}; run the client's build before this project`,
    ).toBe(true)

    const files = builtBundleFiles(env.clientRepoDir)
    expect(files.length, 'the built bundle contained no scannable files').toBeGreaterThan(0)
    logger.info('scanning the built bundle for secrets', { fileCount: files.length })

    for (const rule of SECRET_PATTERNS) {
      const hits = findInSources(files, rule.pattern)
      expect(
        hits,
        `the bundle carries a credential matching "${rule.name}":\n${describeScanHits(hits)}`,
      ).toEqual([])
    }

    // And the synthetic account values never reached the bundle either.
    for (const value of [
      env.accounts.standard.password,
      env.accounts.admin.password,
      env.canaries.password,
    ]) {
      const carrying = files.filter((file) => file.text.includes(value))
      expect(
        carrying.map((file) => file.relativePath),
        'a test credential was baked into the bundle',
      ).toEqual([])
    }

    // The bundle addresses the gateway through configuration, so no second
    // backend host may appear in it.
    const addresses = findInSources(files, ABSOLUTE_ADDRESS_PATTERN)
    const allowedHosts = new Set([
      hostOf(env.gatewayBaseUrl),
      hostOf(env.webBaseUrl),
      ...NON_NETWORK_HOSTS,
    ])
    const unexpected = addresses.filter((hit) => !allowedHosts.has(hostOf(hit.match)))
    expect(
      unexpected,
      `the bundle points at an unexpected host:\n${describeScanHits(unexpected)}`,
    ).toEqual([])
  })

  test('TC-13652-043 Verify that no client logging call site can emit a request body or token @layer:static @ac:AC-14 @intent:regression', async ({
    env,
  }) => {
    const files = clientSourceFiles(env.clientRepoDir)
    expect(files.length).toBeGreaterThan(0)

    const callSites = findInSources(files, DIAGNOSTIC_CALL_PATTERN)

    // Every diagnostic call site is inspected for a sensitive argument. This
    // is a call-site rule, not a value rule: a call that *could* receive a
    // token is a finding even if today it never does.
    const forbiddenArgument =
      /\b(password|passphrase|accessToken|refreshToken|token|credentials|requestBody|payload\.password|body|reason)\b/
    const offending = callSites.filter((hit) => forbiddenArgument.test(hit.text))

    expect(
      offending,
      `a logging call site can receive a credential or body:\n${describeScanHits(offending)}`,
    ).toEqual([])

    // Raw console use in application code is itself the finding: diagnostics
    // go through the client's own telemetry module, which redacts.
    const rawConsole = findInSources(files, /\bconsole\.(log|info|debug|warn|error|trace|dir)\s*\(/)
    expect(
      rawConsole,
      `application code writes to the console directly:\n${describeScanHits(rawConsole)}`,
    ).toEqual([])
  })

  test('TC-13652-059 Verify that no presentation decision reads the identifier or negates the ordinary role @layer:static @ac:AC-19 @intent:regression', async ({
    env,
  }) => {
    const files = clientSourceFiles(env.clientRepoDir)
    expect(files.length).toBeGreaterThan(0)

    // The landing decision is made on the session role and nothing else.
    const presentation = files.filter((file) =>
      /(?:welcome|landing|role)/i.test(file.relativePath),
    )
    expect(
      presentation.length,
      'no presentation module was found to inspect',
    ).toBeGreaterThan(0)

    const identifierDrivenDecision =
      /if\s*\([^)]*\b(email|identifier|username|userName|login)\b[^)]*\)|\b(email|identifier|username)\b[^\n]*\?\s/
    const identifierHits = findInSources(presentation, identifierDrivenDecision)
    expect(
      identifierHits,
      `a presentation decision reads the identifier:\n${describeScanHits(identifierHits)}`,
    ).toEqual([])

    // Nor is the administrator branch reached by negating the ordinary role.
    const negatedRole = /role\s*!==?\s*['"]user['"]|!\s*\w*[Ii]sUser\b/
    const negationHits = findInSources(presentation, negatedRole)
    expect(
      negationHits,
      `the administrator branch is decided by negating "user":\n${describeScanHits(negationHits)}`,
    ).toEqual([])

    // A positive comparison against the one recognised role must exist.
    const positiveHits = findInSources(files, /===\s*['"]admin['"]|['"]admin['"]\s*===/)
    expect(
      positiveHits.length,
      'the administrator role must be recognised by an exact comparison',
    ).toBeGreaterThan(0)
  })

  test('TC-13652-072 Verify that the client source contains no renewal path or refresh route reference @layer:static @ac:AC-27 @intent:regression', async ({
    env,
  }) => {
    const files = clientSourceFiles(env.clientRepoDir)
    expect(files.length).toBeGreaterThan(0)

    const renewalPatterns: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
      { name: 'a refresh route', pattern: /['"`][^'"`]*refresh[-_]?tokens?[^'"`]*['"`]/i },
      { name: 'a renewal call', pattern: /\b(renewSession|refreshSession|silentRefresh|reAuthenticate|renewToken)\b/ },
      { name: 'a scheduled renewal', pattern: /\bset(?:Interval|Timeout)\s*\([^)]*\b(refresh|renew)\b/i },
      { name: 'a revocation route', pattern: /['"`][^'"`]*\/(?:logout|revoke|sign-out)[^'"`]*['"`]/i },
    ]

    for (const rule of renewalPatterns) {
      const hits = findInSources(files, rule.pattern)
      expect(
        hits,
        `the client references ${rule.name}:\n${describeScanHits(hits)}`,
      ).toEqual([])
    }

    // The refresh token may be named where the response shape is described -
    // it has to be, in order to be dropped - but it must never be persisted.
    const persisted = findInSources(
      files,
      /(?:setItem|localStorage|sessionStorage|document\.cookie)[^\n]*refreshToken/,
    )
    expect(
      persisted,
      `the refresh token is written to storage:\n${describeScanHits(persisted)}`,
    ).toEqual([])
  })
})
