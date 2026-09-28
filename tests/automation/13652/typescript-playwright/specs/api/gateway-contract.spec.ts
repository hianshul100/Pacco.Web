/**
 * The contract between the browser client and the API Gateway.
 *
 * Source rows: TC-13652-018, 019, 023, 024, 025, 026, 099, 100.
 *
 * These rows are classified API in the CSV, but the party under test is the
 * client: what it puts on the wire, where it sends it, and what it keeps
 * afterwards. So they are driven through the browser with a stubbed edge,
 * which is the only way to pin a response shape precisely enough to assert
 * the whole of it. The `@live` rows in `specs/api/platform-regression.spec.ts`
 * cover the same ground against the real platform.
 */
import { fillCredentials, openPath, submitSignIn } from '../../support/actions'
import { ROUTES, SESSION_STORAGE_KEY } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { epochSeconds, mintAccessToken, readAccessTokenExpiry } from '../../support/jwt'
import { describeHits, readStoredSession, sweepForValue } from '../../support/sweep'
import { CASE_VARIANT_ROLES, UNRECOGNISED_ROLES } from '../../support/testData'

test.describe('Gateway contract @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-018 Verify that the browser client contacts only the local API Gateway address @layer:api @ac:AC-6 @intent:smoke', async ({
    env,
    page,
    loginPage,
    signInStub,
    traffic,
    welcomePage,
  }) => {
    const served = await signInStub.succeed({ role: 'user' })
    await openPath(page, ROUTES.login)
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()

    const requests = traffic.signIn()
    expect(requests, 'exactly one sign-in request must be issued').toHaveLength(1)

    const [signInRequest] = requests
    expect(signInRequest?.url, 'the request must go to the gateway address').toBe(env.signInUrl)
    expect(signInRequest?.method).toBe('POST')
    expect(signInRequest?.origin).toBe(env.gatewayBaseUrl)
    expect(signInRequest?.path).toBe(env.signInPath)
    expect(signInRequest?.headers['content-type']).toContain('application/json')

    // The response the edge returns carries the four documented fields.
    expect(Object.keys(served).sort()).toEqual(
      ['accessToken', 'expires', 'refreshToken', 'role'].sort(),
    )
    expect(served.role).toBe('user')
    expect(typeof served.expires, 'the expiry field is numeric').toBe('number')
    expect(signInStub.count(), 'the edge answered exactly once').toBe(1)

    // And nothing else was contacted: no service port, no third host.
    expect(traffic.foreign(), 'only the client and the gateway may be contacted').toEqual([])
  })

  test('TC-13652-019 Verify that the sign-in request body carries exactly the email and password fields @layer:api @ac:AC-6 @ac:AC-8 @intent:smoke', async ({
    env,
    page,
    loginPage,
    signInStub,
    traffic,
    welcomePage,
  }) => {
    const identifier = env.accounts.standard.email
    const password = env.accounts.standard.password

    await signInStub.succeed({ role: 'user' })
    await openPath(page, ROUTES.login)
    await fillCredentials(loginPage, { identifier, password })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()

    const body = traffic.signIn()[0]?.postData ?? ''
    const parsed = JSON.parse(body) as Record<string, unknown>

    // Exactly two fields, named exactly as the platform expects.
    expect(
      Object.keys(parsed).sort(),
      `unexpected request body: ${Object.keys(parsed).join(', ')}`,
    ).toEqual(['email', 'password'])
    expect(parsed['email'], 'the identifier is sent verbatim, untrimmed and unaltered').toBe(
      identifier,
    )
    expect(parsed['password']).toBe(password)

    // No client-invented field rode along.
    for (const invented of ['username', 'identifier', 'userType', 'role', 'rememberMe', 'client']) {
      expect(parsed, `the body must not carry a "${invented}" field`).not.toHaveProperty(invented)
    }
  })

  test('TC-13652-023 Verify that a successful sign-in establishes a session holding token, role and expiry @layer:api @ac:AC-8 @intent:smoke', async ({
    env,
    page,
    loginPage,
    signInStub,
    welcomePage,
  }) => {
    // The stub deliberately returns an `expires` field that disagrees with the
    // token's own `exp`, because the row requires the stored expiry to come
    // from the token rather than from the envelope around it.
    const tokenExp = epochSeconds(3600)
    const accessToken = mintAccessToken({ expSeconds: tokenExp, role: 'user' })
    await signInStub.succeed({ role: 'user', accessToken, expires: tokenExp + 9999 })

    await openPath(page, ROUTES.login)
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()

    const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(stored, 'a session must exist after a successful sign-in').not.toBeNull()
    expect(Object.keys(stored ?? {}).sort()).toEqual(['accessToken', 'expiresAt', 'role'].sort())

    expect(stored?.['accessToken']).toBe(accessToken)
    expect(stored?.['role']).toBe('user')
    expect(stored?.['expiresAt'], "the stored expiry is the token's own exp claim").toBe(tokenExp)
    expect(readAccessTokenExpiry(accessToken)).toBe(tokenExp)

    // It lives in sessionStorage, so it ends with the tab.
    const inLocalStorage = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      SESSION_STORAGE_KEY,
    )
    expect(inLocalStorage, 'the session must not be written to localStorage').toBeNull()
  })

  test('TC-13652-024 Verify that the refresh token is discarded and stored nowhere @layer:api @ac:AC-8 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    traffic,
    consoleLog,
    telemetry,
    welcomePage,
  }) => {
    const canary = env.canaries.refreshToken
    await signInStub.succeed({ role: 'user', refreshToken: canary })

    await openPath(page, ROUTES.login)
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()

    const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(stored, 'the session exists').not.toBeNull()
    expect(stored?.['refreshToken'], 'the refresh token must not be in the session').toBeUndefined()

    // It arrived in the response, so the sweep is meaningful - and it is gone
    // from every place the browser could have put it.
    const hits = await sweepForValue(page, canary, { traffic, consoleLog, telemetry })
    expect(hits, `the refresh token survived somewhere:\n${describeHits(hits)}`).toEqual([])
  })

  test('TC-13652-025 Verify that a mixed-case role from the platform is stored in lower case @layer:api @ac:AC-8 @ac:AC-17 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    welcomePage,
  }) => {
    for (const roleCase of CASE_VARIANT_ROLES) {
      await signInStub.succeed({ role: roleCase.returned })
      await openPath(page, ROUTES.login)
      await fillCredentials(loginPage, {
        identifier: env.accounts.standard.email,
        password: env.accounts.standard.password,
      })
      await submitSignIn(loginPage)
      await expect(welcomePage.heading).toBeVisible()

      const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
      expect(
        stored?.['role'],
        `the platform returned "${roleCase.returned}" and it must be stored lower-cased`,
      ).toBe(roleCase.stored)
      await expect(welcomePage.heading).toHaveText(roleCase.heading)
    }
  })

  test('TC-13652-026 Verify that an unrecognised role value is stored verbatim and not replaced by a default @layer:api @ac:AC-8 @ac:AC-18 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    welcomePage,
  }) => {
    for (const roleCase of UNRECOGNISED_ROLES) {
      await signInStub.succeed({ role: roleCase.returned })
      await openPath(page, ROUTES.login)
      await fillCredentials(loginPage, {
        identifier: env.accounts.standard.email,
        password: env.accounts.standard.password,
      })
      await submitSignIn(loginPage)
      await expect(welcomePage.heading).toBeVisible()

      const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
      // Stored as it came, only lower-cased; never rewritten to "user".
      expect(
        stored?.['role'],
        `the unrecognised role "${roleCase.returned}" must be kept, not defaulted`,
      ).toBe(roleCase.stored)
      // And it still lands on the ordinary screen.
      await expect(welcomePage.heading).toHaveText(roleCase.heading)
      await expect(welcomePage.adminHeading).toHaveCount(0)
    }
  })

  test('TC-13652-099 Verify that credentials never travel in the address, a header or the browser history @layer:api @ac:AC-14 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    traffic,
    navigation,
    welcomePage,
  }) => {
    const canary = env.canaries.password
    await signInStub.succeed({ role: 'user' })

    await openPath(page, ROUTES.login)
    navigation.clear()
    await fillCredentials(loginPage, { identifier: env.accounts.standard.email, password: canary })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()

    const signInRequest = traffic.signIn()[0]
    expect(signInRequest, 'the sign-in request must have been issued').toBeDefined()

    // Not in the address.
    expect(signInRequest?.url ?? '', 'the password must not be in the query string').not.toContain(
      canary,
    )
    expect(signInRequest?.url ?? '').not.toContain(env.accounts.standard.email)

    // Not in any header - not even one a client might add for convenience.
    for (const [name, value] of Object.entries(signInRequest?.headers ?? {})) {
      expect(value, `the password appeared in the "${name}" header`).not.toContain(canary)
    }
    expect(Object.keys(signInRequest?.headers ?? {})).not.toContain('authorization')

    // Not in any address the browser occupied, so not in the history either.
    for (const url of navigation.urls()) {
      expect(url, `the password appeared in a visited address: ${url}`).not.toContain(canary)
      expect(url).not.toContain(env.accounts.standard.email)
    }
    const historyEntries = await page.evaluate(() => window.history.length)
    expect(historyEntries, 'the journey produced history entries to check').toBeGreaterThan(0)

    // It travelled in the request body, and only there.
    expect((signInRequest?.postData ?? '').includes(canary)).toBe(true)
  })

  test('TC-13652-100 Verify that the sign-in call is anonymous and carries no ambient credentials @layer:api @ac:AC-16 @ac:AC-6 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    traffic,
    welcomePage,
  }) => {
    await signInStub.succeed({ role: 'user' })

    // A cookie exists on the client origin, so "no cookie was sent" is a real
    // observation rather than a vacuous one.
    await page.context().addCookies([
      {
        name: 'pacco_test_marker',
        value: 'present',
        url: env.webBaseUrl,
      },
    ])

    await openPath(page, ROUTES.login)
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()

    const headers = traffic.signIn()[0]?.headers ?? {}
    const headerNames = Object.keys(headers)

    // The call is anonymous: no bearer, no cookie, no ambient credential.
    expect(headerNames, 'sign-in must not carry an Authorization header').not.toContain(
      'authorization',
    )
    expect(headerNames, 'sign-in must not carry cookies').not.toContain('cookie')
    expect(headerNames).not.toContain('x-api-key')
    expect(headerNames).not.toContain('proxy-authorization')

    // The gateway set no session cookie of its own in response.
    const cookies = await page.context().cookies()
    const names = cookies.map((cookie) => cookie.name)
    expect(names, 'the marker cookie proves cookies were available to send').toContain(
      'pacco_test_marker',
    )
    expect(
      names.filter((name) => name !== 'pacco_test_marker'),
      'no session cookie may be created',
    ).toEqual([])
  })
})
