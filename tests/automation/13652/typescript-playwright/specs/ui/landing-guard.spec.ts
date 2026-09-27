/**
 * The route guard, session expiry and logout.
 *
 * Source rows: TC-13652-060 … 068, 071, 073, 074, 107.
 *
 * Two themes run through all of them. First, the guard fails closed: anything
 * it cannot read is treated as no session at all. Second, none of this touches
 * the platform - the session lives in the browser, so expiry and logout are
 * both decided locally and must issue zero backend requests.
 */
import { goBack, goForward, hardReload, openPath } from '../../support/actions'
import {
  LANDING_COPY,
  LOGIN_COPY,
  MESSAGES,
  ROUTES,
  SESSION_STORAGE_KEY,
  SIGN_IN_FAILURE_MESSAGES,
} from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { epochSeconds } from '../../support/jwt'
import { watchForBackendTraffic } from '../../support/network'
import {
  clearAllStorage,
  makeSessionReadThrow,
  seedRawSession,
  seedSession,
} from '../../support/sessionSeed'
import { allStorageIsEmpty, readStoredSession } from '../../support/sweep'
import { EXPIRY_BOUNDARIES } from '../../support/testData'

test.describe('Landing guard, expiry and logout @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-060 Verify that opening the landing address with no session redirects to the Login screen @layer:ui @ac:AC-20 @intent:smoke', async ({
    env,
    page,
    loginPage,
    welcomePage,
    navigation,
  }) => {
    navigation.clear()
    await openPath(page, ROUTES.welcome)

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)

    // Not merely "ends on /login": the landing content is never rendered, so a
    // flash of it before the redirect would fail this row.
    await expect(welcomePage.heading).toHaveCount(0)
    const markup = await page.content()
    expect(markup).not.toContain(LANDING_COPY.adminHeading)
    expect(markup).not.toContain(LANDING_COPY.supporting)
  })

  test('TC-13652-061 Verify that reloading the landing address with no session redirects to the Login screen @layer:ui @ac:AC-20 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
  }) => {
    await openPath(page, ROUTES.welcome)
    await hardReload(page)

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
    await expect(welcomePage.heading).toHaveCount(0)
  })

  test('TC-13652-062 Verify that returning to the landing address with no session redirects to Login @layer:ui @ac:AC-20 @intent:regression', async ({
    env,
    page,
    loginPage,
  }) => {
    const loginUrl = `${env.webBaseUrl}${ROUTES.login}`

    await openPath(page, ROUTES.login)
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(loginUrl)

    await goBack(page)
    await expect(page).toHaveURL(loginUrl)
    await expect(loginPage.heading).toBeVisible()

    await goForward(page)
    await expect(page).toHaveURL(loginUrl)
    await expect(loginPage.heading).toBeVisible()

    await goBack(page)
    await goBack(page)
    await expect(page).toHaveURL(loginUrl)
    await expect(loginPage.heading).toBeVisible()
  })

  test('TC-13652-063 Verify that a live session survives a landing screen reload with no network call @layer:ui @ac:AC-26 @intent:regression', async ({
    page,
    welcomePage,
    traffic,
  }) => {
    await seedSession(page, { role: 'admin' })
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)

    traffic.clear()
    await hardReload(page)

    // The same message, from the same local session.
    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)
    expect(traffic.backend(), 'a reload must not re-contact the platform').toEqual([])
  })

  test('TC-13652-064 Verify that an expired session is discarded and reported with its own distinct notice @layer:ui @ac:AC-21 @intent:smoke', async ({
    env,
    page,
    loginPage,
    traffic,
  }) => {
    // An expiry one hour in the past.
    await seedSession(page, { role: 'admin', expiresAt: epochSeconds(-3600) })
    traffic.clear()
    await openPath(page, ROUTES.welcome)

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)

    // The notice is its own message, in a status region, and is not any of the
    // three sign-in failure messages.
    await expect(loginPage.sessionNotice).toHaveText(MESSAGES.sessionExpired)
    await expect(loginPage.statusRegion).toContainText(MESSAGES.sessionExpired)
    for (const failure of SIGN_IN_FAILURE_MESSAGES) {
      expect(MESSAGES.sessionExpired, 'the notice must be distinct from every failure message').not.toBe(
        failure,
      )
      await expect(loginPage.sessionNotice).not.toContainText(failure)
    }

    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
    expect(traffic.backend(), 'discarding an expired session contacts nothing').toEqual([])
  })

  test('TC-13652-065 Verify that the expiry decision is correct at its boundary and fails closed when unreadable @layer:ui @ac:AC-21 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    consoleLog,
  }) => {
    const loginUrl = `${env.webBaseUrl}${ROUTES.login}`
    const welcomeUrl = `${env.webBaseUrl}${ROUTES.welcome}`

    // The three boundary cases, each asserted on its own.
    for (const boundary of EXPIRY_BOUNDARIES) {
      await clearAllStorage(page)
      await seedSession(page, { role: 'user', expiresAt: epochSeconds(boundary.offsetSeconds) })
      await openPath(page, ROUTES.welcome)

      if (boundary.shouldBeLive) {
        await expect(page, `an expiry ${boundary.label} is still live`).toHaveURL(welcomeUrl)
        await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
      } else {
        await expect(page, `an expiry ${boundary.label} has passed`).toHaveURL(loginUrl)
        await expect(welcomePage.heading).toHaveCount(0)
      }
    }

    // Corruption case 1: the expiry is the word "later".
    await clearAllStorage(page)
    await seedRawSession(
      page,
      JSON.stringify({ accessToken: 'header.payload.signature', role: 'user', expiresAt: 'later' }),
    )
    await openPath(page, ROUTES.welcome)
    await expect(page, 'an unreadable expiry must fail closed').toHaveURL(loginUrl)

    // Corruption case 2: the expiry is an empty string.
    await clearAllStorage(page)
    await seedRawSession(
      page,
      JSON.stringify({ accessToken: 'header.payload.signature', role: 'user', expiresAt: '' }),
    )
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(loginUrl)

    // Corruption case 3: the key is absent entirely.
    await clearAllStorage(page)
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(loginUrl)

    // Corruption case 4: reading the key throws.
    await makeSessionReadThrow(page)
    await openPath(page, ROUTES.welcome)
    await expect(page, 'a storage read that throws must fail closed').toHaveURL(loginUrl)
    await expect(loginPage.heading).toBeVisible()

    expect(
      consoleLog.pageErrors(),
      'failing closed must not surface as an uncaught error',
    ).toEqual([])
  })

  test('TC-13652-066 Verify that logging out clears the session entirely and contacts the platform not at all @layer:ui @ac:AC-22 @intent:smoke', async ({
    env,
    page,
    loginPage,
    welcomePage,
    traffic,
  }) => {
    await seedSession(page, { role: 'admin' })
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.adminHeading).toBeVisible()

    traffic.clear()
    await welcomePage.logout.click()

    // Logout is a local discard. No revoke route is called because none exists.
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
    expect(traffic.backend(), 'logout must issue zero backend requests').toEqual([])

    // Every storage area is empty afterwards.
    expect(
      await allStorageIsEmpty(page),
      'session storage, local storage, cookies and IndexedDB must all be empty',
    ).toBe(true)

    // And the screen settles immediately - there is nothing to wait for.
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await expect(loginPage.submit).toBeEnabled()
  })

  test('TC-13652-067 Verify that navigating back after logout does not restore the landing screen @layer:ui @ac:AC-23 @intent:regression', async ({
    env,
    page,
    welcomePage,
  }) => {
    const loginUrl = `${env.webBaseUrl}${ROUTES.login}`

    await seedSession(page, { role: 'admin' })
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.adminHeading).toBeVisible()

    await welcomePage.logout.click()
    await expect(page).toHaveURL(loginUrl)

    // Back, Forward and Back again - including a restore from the back/forward
    // cache, which serves a page without re-running its scripts.
    await goBack(page)
    await expect(page).toHaveURL(loginUrl)
    await expect(welcomePage.heading).toHaveCount(0)

    await goForward(page)
    await expect(page).toHaveURL(loginUrl)
    await expect(welcomePage.heading).toHaveCount(0)

    await goBack(page)
    await expect(page).toHaveURL(loginUrl)
    await expect(welcomePage.heading).toHaveCount(0)
    expect(await page.content()).not.toContain(LANDING_COPY.adminHeading)
  })

  test('TC-13652-068 Verify that logout moves focus to the Login heading and a second sign-in succeeds @layer:ui @ac:AC-23 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    await seedSession(page, { role: 'admin' })
    await openPath(page, ROUTES.welcome)
    await welcomePage.logout.click()

    await expect(loginPage.heading).toBeVisible()
    // Focus lands on a live element, not on the document body.
    await expect(loginPage.heading).toBeFocused()
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? '')
    expect(focusedTag, 'focus must not fall back to the body').not.toBe('body')

    // A second sign-in works without reloading the client.
    await signInStub.succeed({ role: 'admin' })
    await loginPage.identifier.fill(env.accounts.admin.email)
    await loginPage.password.fill(env.accounts.admin.password)
    await loginPage.submit.click()

    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)
  })

  test('TC-13652-071 Verify that the landing screen shows only its four permitted elements and calls nothing @layer:ui @ac:AC-26 @intent:smoke', async ({
    env,
    page,
    welcomePage,
    traffic,
  }) => {
    await seedSession(page, { role: 'user' })
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.standardHeading).toBeVisible()

    // Exactly one interactive element, and it is logout.
    await expect(welcomePage.interactiveElements).toHaveCount(1)
    await expect(welcomePage.logout).toHaveText(LANDING_COPY.logout)

    // The permitted content: the welcome message, the brand mark and the role
    // indicator. Each is present exactly once.
    await expect(welcomePage.heading).toHaveCount(1)
    await expect(welcomePage.brandMark).toHaveCount(1)
    await expect(welcomePage.roleIndicator).toHaveCount(1)

    // Nothing polls. The window is watched for a request that must never come.
    traffic.clear()
    const stray = await watchForBackendTraffic(page, env.timeouts.idleObservationMs)
    expect(stray, 'the landing screen must issue no traffic while idle').toBeNull()

    // Nor on the way out.
    await welcomePage.logout.click()
    expect(traffic.backend(), 'unmounting the screen must issue no traffic').toEqual([])
  })

  test('TC-13652-073 Verify that an idle session issues no traffic and simply ends when its expiry passes @layer:ui @ac:AC-27 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    traffic,
  }) => {
    // A short-lived session, so the whole expiry window fits inside the test.
    const lifetimeSeconds = 3
    const seeded = await seedSession(page, {
      role: 'user',
      expiresAt: epochSeconds(lifetimeSeconds),
    })
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.standardHeading).toBeVisible()

    traffic.clear()
    const storedBefore = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(storedBefore?.['expiresAt']).toBe(seeded.expiresAt)

    // Watch the session out. No renewal request may appear, and none may be
    // scheduled - the expiry is simply noticed on the next navigation.
    const stray = await watchForBackendTraffic(page, (lifetimeSeconds + 1) * 1000)
    expect(stray, 'an idle session must issue no renewal traffic').toBeNull()

    const storedAfter = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(storedAfter?.['expiresAt'], 'the stored expiry must not have been extended').toBe(
      seeded.expiresAt,
    )

    // The next navigation finds the session expired.
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    await expect(loginPage.sessionNotice).toHaveText(MESSAGES.sessionExpired)
    expect(traffic.backend(), 'nothing in this window contacts the platform').toEqual([])
  })

  test('TC-13652-074 Verify that an expired session cannot return to the signed-in state without a fresh sign-in @layer:ui @ac:AC-21 @intent:regression', async ({
    env,
    page,
    welcomePage,
  }) => {
    const loginUrl = `${env.webBaseUrl}${ROUTES.login}`

    await seedSession(page, { role: 'admin', expiresAt: epochSeconds(-60) })

    // Route 1: typing the address.
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(loginUrl)

    // Route 2: the Back button.
    await goBack(page)
    await expect(page).toHaveURL(loginUrl)

    // Route 3: a hard reload.
    await hardReload(page)
    await expect(page).toHaveURL(loginUrl)

    // Route 4: re-seeding the same expired session and trying again. The guard
    // discards it a second time rather than trusting what it finds.
    await seedSession(page, { role: 'admin', expiresAt: epochSeconds(-60) })
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(loginUrl)
    await expect(welcomePage.heading).toHaveCount(0)
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
  })

  test('TC-13652-107 Verify that the application root resolves correctly in both session states @layer:ui @ac:AC-20 @intent:sanity', async ({
    env,
    page,
    loginPage,
    welcomePage,
  }) => {
    // With no session the root resolves to the Login screen.
    await openPath(page, ROUTES.root)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)

    // With a live session it resolves to the landing screen.
    await seedSession(page, { role: 'user' })
    await openPath(page, ROUTES.root)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)

    // The root renders nothing of its own: whatever it shows belongs to the
    // screen it resolved to.
    expect(page.url()).not.toBe(`${env.webBaseUrl}${ROUTES.root}`)
  })
})
