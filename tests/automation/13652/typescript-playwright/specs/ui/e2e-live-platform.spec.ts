/**
 * The whole journey against the running platform.
 *
 * Source rows: TC-13652-075 … 082, 084, 105, 106.
 *
 * Nothing in this file is stubbed. The `signInStub` fixture is deliberately
 * never requested, so no route handler is installed and every request leaves
 * the browser for the real gateway. That is the point of the rows: they are
 * the ones that would catch a contract drift the offline projects cannot see.
 *
 * All of them are tagged `@live` and therefore excluded from every offline
 * project by `grepInvert`. They require the Docker Compose backend and the
 * client dev server to be running; README.md sets out how.
 */
import {
  clickRepeatedly,
  fillCredentials,
  hardReload,
  logout,
  openPath,
  signInAndCaptureResponse,
  submitSignIn,
} from '../../support/actions'
import { LANDING_COPY, LOGIN_COPY, MESSAGES, ROUTES, SESSION_STORAGE_KEY } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { watchForBackendTraffic } from '../../support/network'
import {
  startService,
  stopService,
  waitForSignInService,
  waitForSignInServiceDown,
} from '../../support/platform'
import { readStoredSession } from '../../support/sweep'

test.describe('Live platform journeys @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-075 Verify that an ordinary user completes the whole journey against the running platform @live @layer:ui @ac:AC-28 @ac:AC-18 @ac:AC-8 @intent:smoke', async ({
    env,
    page,
    loginPage,
    welcomePage,
    traffic,
  }) => {
    await openPath(page, ROUTES.login)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)

    const response = await signInAndCaptureResponse(page, loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })

    // The real edge, the real status code.
    expect(response.status(), 'a valid credential must be accepted with 200').toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(Object.keys(body).sort(), 'the platform contract must not have drifted').toEqual(
      ['accessToken', 'expires', 'refreshToken', 'role'].sort(),
    )

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await expect(welcomePage.adminHeading).toHaveCount(0)

    // The session holds the token, the lower-cased role and an expiry.
    const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(stored?.['role']).toBe('user')
    expect(typeof stored?.['accessToken']).toBe('string')
    expect(typeof stored?.['expiresAt']).toBe('number')
    expect(stored?.['refreshToken'], 'the refresh token is never stored').toBeUndefined()

    // Logout discards the session in the browser and contacts nothing.
    const before = traffic.backend().length
    await logout(welcomePage)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
    expect(traffic.backend().length, 'logout must issue no backend request').toBe(before)
  })

  test('TC-13652-076 Verify that an administrator completes the whole journey against the running platform @live @layer:ui @ac:AC-28 @ac:AC-17 @intent:smoke', async ({
    env,
    page,
    loginPage,
    welcomePage,
  }) => {
    await openPath(page, ROUTES.login)

    const response = await signInAndCaptureResponse(page, loginPage, {
      identifier: env.accounts.admin.email,
      password: env.accounts.admin.password,
    })
    expect(response.status()).toBe(200)

    const body = (await response.json()) as { role?: unknown }
    expect(
      String(body.role).toLowerCase(),
      'the administrator account must carry the administrator role',
    ).toBe('admin')

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)
    await expect(welcomePage.supportingLine).toHaveText(LANDING_COPY.supporting)

    const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(stored?.['role']).toBe('admin')

    await logout(welcomePage)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
  })

  test('TC-13652-077 Verify that a wrong password against the running platform shows the credentials message @live @layer:ui @ac:AC-9 @ac:AC-13 @intent:smoke', async ({
    env,
    page,
    loginPage,
  }) => {
    await openPath(page, ROUTES.login)

    const response = await signInAndCaptureResponse(page, loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.wrongPasswordLive,
    })
    expect(response.status(), 'the platform rejects a wrong password with 400').toBe(400)

    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)

    // The address survives, the password does not, and no session was made.
    await expect(loginPage.identifier).toHaveValue(env.accounts.standard.email)
    await expect(loginPage.password).toHaveValue('')
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
  })

  test('TC-13652-078 Verify that an unknown address against the running platform is indistinguishable from a wrong password @live @layer:ui @ac:AC-10 @intent:regression', async ({
    env,
    page,
    loginPage,
  }) => {
    // Attempt one: a real account, the wrong password.
    await openPath(page, ROUTES.login)
    const knownResponse = await signInAndCaptureResponse(page, loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.wrongPasswordLive,
    })
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)
    const knownMessage = await loginPage.formMessage.textContent()
    const knownStatus = knownResponse.status()

    // Attempt two: an address the platform has never seen.
    await openPath(page, ROUTES.login)
    const unknownResponse = await signInAndCaptureResponse(page, loginPage, {
      identifier: env.accounts.unknownEmail,
      password: env.accounts.wrongPasswordLive,
    })
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)
    const unknownMessage = await loginPage.formMessage.textContent()

    // Same status, same wording, same screen: nothing enumerates accounts.
    expect(unknownResponse.status(), 'both rejections must share one status code').toBe(knownStatus)
    expect(unknownMessage, 'both rejections must share one message').toBe(knownMessage)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
  })

  test('TC-13652-079 Verify that empty fields against the running platform produce no traffic at all @live @layer:ui @ac:AC-3 @intent:regression', async ({
    page,
    loginPage,
    traffic,
  }) => {
    await openPath(page, ROUTES.login)
    traffic.clear()

    await submitSignIn(loginPage)

    await expect(loginPage.identifierMessage).toHaveText(LOGIN_COPY.identifierRequired)
    await expect(loginPage.passwordMessage).toHaveText(LOGIN_COPY.passwordRequired)

    // Validation happens in the browser; the platform is never asked.
    expect(traffic.backend(), 'an empty submission must reach no backend').toEqual([])
    await expect(loginPage.formMessage).toHaveCount(0)
  })

  test('TC-13652-080 Verify that rapid activations against the running platform reach it exactly once @live @layer:ui @ac:AC-4 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    traffic,
  }) => {
    await openPath(page, ROUTES.login)
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })

    traffic.clear()
    await clickRepeatedly(loginPage, 5)

    await expect(welcomePage.heading).toBeVisible()
    // Five activations, one request: the in-flight lock held against a real
    // round trip, not against a stub that could hide a race.
    expect(traffic.signIn(), 'five activations must produce exactly one request').toHaveLength(1)
  })

  test('TC-13652-081 Verify that the client recovers when the backend sign-in service is stopped and restarted @live @layer:ui @ac:AC-11 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    logger,
  }) => {
    const credentials = {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    }

    logger.info('stopping the sign-in service', { service: env.signInServiceName })
    await stopService(env.signInServiceName)

    try {
      await waitForSignInServiceDown(credentials.identifier, credentials.password)

      await openPath(page, ROUTES.login)
      await fillCredentials(loginPage, credentials)
      await submitSignIn(loginPage)

      // With the service down the client reports unavailability, not a
      // credential problem, and keeps the screen usable.
      await expect(loginPage.formMessage).toHaveText(MESSAGES.unavailable)
      await expect(loginPage.submit).toBeEnabled()
      expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
    } finally {
      logger.info('starting the sign-in service', { service: env.signInServiceName })
      await startService(env.signInServiceName)
    }

    await waitForSignInService(credentials.identifier, credentials.password)

    // No reload needed: the same screen retries and succeeds.
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.heading).toBeVisible()
  })

  test('TC-13652-082 Verify that the full round trip contacts only the gateway port across every screen @live @layer:ui @ac:AC-6 @ac:AC-8 @ac:AC-26 @intent:smoke', async ({
    env,
    page,
    loginPage,
    welcomePage,
    traffic,
  }) => {
    await openPath(page, ROUTES.login)
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()

    // Sit on the landing screen: nothing polls, nothing renews.
    const stray = await watchForBackendTraffic(page, env.timeouts.idleObservationMs)
    expect(stray, `the landing screen contacted ${stray?.url ?? ''} while idle`).toBeNull()

    await logout(welcomePage)
    await expect(loginPage.heading).toBeVisible()

    // Exactly two origins across the whole journey: the client and the gateway.
    const origins = traffic.distinctOrigins()
    expect(
      [...origins].sort(),
      `unexpected origins were contacted: ${origins.join(', ')}`,
    ).toEqual([env.gatewayBaseUrl, env.webBaseUrl].sort())
    expect(traffic.foreign(), 'no third host may be contacted').toEqual([])

    // And every backend request went to the gateway's port, not a service port.
    for (const request of traffic.backend()) {
      expect(request.origin).toBe(env.gatewayBaseUrl)
    }
  })

  test('TC-13652-084 Verify that the stitched journey covers both roles, reload, logout and re-entry @live @layer:ui @ac:AC-17 @ac:AC-18 @ac:AC-20 @ac:AC-22 @ac:AC-28 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    traffic,
  }) => {
    // Leg one: the ordinary user, reloaded.
    await openPath(page, ROUTES.login)
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)

    const beforeReload = await readStoredSession(page, SESSION_STORAGE_KEY)
    await hardReload(page)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    expect(
      await readStoredSession(page, SESSION_STORAGE_KEY),
      'a reload must neither lose nor re-mint the session',
    ).toEqual(beforeReload)

    // Leg two: logout, then the guard.
    await logout(welcomePage)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    await expect(welcomePage.heading).toHaveCount(0)

    // Leg three: the administrator, in the same tab.
    await fillCredentials(loginPage, {
      identifier: env.accounts.admin.email,
      password: env.accounts.admin.password,
    })
    await submitSignIn(loginPage)
    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)

    const adminSession = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(adminSession?.['role']).toBe('admin')
    expect(
      adminSession?.['accessToken'],
      're-entry must mint a new token, not reuse the discarded one',
    ).not.toBe(beforeReload?.['accessToken'])

    // Leg four: logout again, and the journey ends where it began.
    await logout(welcomePage)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()

    expect(traffic.foreign(), 'the stitched journey must contact no third host').toEqual([])
  })

  test('TC-13652-105 Verify that the browser client runs as its own local process on its own origin @live @layer:ui @ac:AC-6 @intent:regression', async ({
    env,
    page,
    loginPage,
    request,
    traffic,
  }) => {
    // The client and the gateway are two processes on two origins.
    expect(
      env.webBaseUrl,
      'the client must not share an origin with the gateway',
    ).not.toBe(env.gatewayBaseUrl)

    // The client's own origin serves the application document.
    const document = await page.goto(`${env.webBaseUrl}${ROUTES.login}`)
    expect(document?.status(), 'the client origin must serve the application').toBe(200)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)

    const documentUrl = document?.url() ?? ''
    expect(
      documentUrl.startsWith(env.webBaseUrl),
      `the document came from ${documentUrl} rather than the client origin`,
    ).toBe(true)

    // The gateway does not serve it: the client is not embedded behind Ntrada.
    const fromGateway = await request.get(`${env.gatewayBaseUrl}${ROUTES.login}`, {
      failOnStatusCode: false,
    })
    const gatewayBody = await fromGateway.text()
    expect(
      gatewayBody,
      'the gateway must not serve the browser client',
    ).not.toContain(LOGIN_COPY.heading)

    // Every asset the screen needed came from the client's own origin.
    const assetOrigins = new Set(
      traffic
        .all()
        .filter((entry) => entry.resourceType !== 'xhr' && entry.resourceType !== 'fetch')
        .map((entry) => entry.origin),
    )
    expect(
      [...assetOrigins],
      `assets were served from an unexpected origin: ${[...assetOrigins].join(', ')}`,
    ).toEqual([env.webBaseUrl])
  })

  test('TC-13652-106 Verify that a real sign-in session drives the guard and the welcome message @live @layer:ui @ac:AC-28 @ac:AC-8 @ac:AC-17 @ac:AC-20 @intent:smoke', async ({
    env,
    page,
    loginPage,
    welcomePage,
  }) => {
    // Nothing here is seeded. This row is the counterweight to every offline
    // row that writes a session itself: the guard is driven only by a session
    // the platform actually issued.
    await openPath(page, ROUTES.welcome)
    await expect(page, 'without a session the guard must redirect').toHaveURL(
      `${env.webBaseUrl}${ROUTES.login}`,
    )

    const response = await signInAndCaptureResponse(page, loginPage, {
      identifier: env.accounts.admin.email,
      password: env.accounts.admin.password,
    })
    expect(response.status()).toBe(200)

    // The guard now admits the same address it refused a moment ago.
    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)

    // The stored expiry is the token's own, read from the real token.
    const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
    const expiresAt = Number(stored?.['expiresAt'])
    expect(Number.isFinite(expiresAt), 'the session must carry a numeric expiry').toBe(true)
    expect(expiresAt, 'the real token must not already be expired').toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    )
  })
})
