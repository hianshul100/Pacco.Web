/**
 * What the Login screen says, and what it does afterwards.
 *
 * Source rows: TC-13652-027, 038, 039, 040, 041, 042.
 */
import { fillCredentials, openPath, submitSignIn, tabThrough } from '../../support/actions'
import {
  LANDING_COPY,
  MESSAGES,
  ROUTES,
  SESSION_STORAGE_KEY,
} from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { malformedSuccessBodies } from '../../support/stubs'
import { describeHits, readStoredSession, sweepForValue } from '../../support/sweep'

test.describe('Login messaging and recovery @story:13652 @component:pacco-web-login', () => {
  test.beforeEach(async ({ page }) => {
    await openPath(page, ROUTES.login)
  })

  test('TC-13652-027 Verify that a successful sign-in takes the user to the Welcome screen @layer:ui @ac:AC-8 @intent:smoke', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    await signInStub.succeed({ role: 'user' })

    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)

    // The address bar reads the landing address on the client's own origin.
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.heading).toBeVisible()
    // The sign-in form is gone, not merely hidden behind the landing content.
    await expect(loginPage.form).toHaveCount(0)
  })

  test('TC-13652-038 Verify that the Login screen shows one message at a time in an announced region @layer:ui @ac:AC-9 @intent:regression', async ({
    env,
    loginPage,
    signInStub,
  }) => {
    const credentials = {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    }

    // First failure: the credentials message.
    await signInStub.rejectWith('invalid_credentials', 'Invalid credentials.')
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)

    // The message lives in a region assistive technology announces.
    await expect(loginPage.alertRegion).toHaveCount(1)
    await expect(loginPage.alertRegion).toContainText(MESSAGES.credentials)

    // Second failure of a different kind: the message is REPLACED, not stacked.
    await signInStub.respondWithStatus(503)
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.unavailable)

    await expect(loginPage.formMessage).toHaveCount(1)
    await expect(loginPage.alertRegion).toHaveCount(1)
    await expect(loginPage.alertRegion).not.toContainText(MESSAGES.credentials)
  })

  test('TC-13652-039 Verify that the availability failure leaves the Login screen fully usable @layer:ui @ac:AC-11 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    traffic,
  }) => {
    await signInStub.fail('connectionrefused')
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    traffic.clear()
    signInStub.reset()
    await submitSignIn(loginPage)

    await expect(loginPage.formMessage).toHaveText(MESSAGES.unavailable)

    // No session was created by a failed attempt.
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()

    // All four controls are operable again.
    await expect(loginPage.identifier).toBeEditable()
    await expect(loginPage.password).toBeEditable()
    await expect(loginPage.revealToggle).toBeEnabled()
    await expect(loginPage.submit).toBeEnabled()

    // The tab order is intact: identifier, password, reveal, submit.
    await loginPage.identifier.focus()
    const reached = await tabThrough(page, 3)
    expect(reached, 'the documented tab order must survive a failure').toHaveLength(3)
    await expect(loginPage.submit).toBeFocused()

    // And a second attempt actually reaches the edge.
    await loginPage.password.fill(env.accounts.standard.password)
    await submitSignIn(loginPage)
    await expect.poll(() => traffic.signIn().length).toBe(2)
  })

  test('TC-13652-040 Verify that a malformed success keeps the user on the Login screen @layer:ui @ac:AC-12 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    navigation,
  }) => {
    const [firstMalformed] = malformedSuccessBodies()
    expect(firstMalformed, 'the malformed-body table must not be empty').toBeDefined()
    await signInStub.succeedWithRawBody(firstMalformed?.body ?? '')

    navigation.clear()
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)

    await expect(loginPage.formMessage).toHaveText(MESSAGES.generic)
    await expect(loginPage.form).toBeVisible()

    // The landing address was never entered, not even for a single frame.
    const visited = navigation.paths()
    expect(
      visited.filter((path) => path === ROUTES.welcome),
      `the landing address must never be entered; visited: ${visited.join(' -> ')}`,
    ).toEqual([])
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
  })

  test('TC-13652-041 Verify that after a failure the address is kept, the password cleared, and retry succeeds @layer:ui @ac:AC-13 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    const identifier = env.accounts.standard.email

    await signInStub.rejectWith('invalid_credentials', 'Invalid credentials.')
    await fillCredentials(loginPage, { identifier, password: env.accounts.wrongPassword })
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)

    // The address the user typed is still there; the password is not.
    await expect(loginPage.identifier).toHaveValue(identifier)
    await expect(loginPage.password).toHaveValue('')

    // Retrying needs only the password - no reload, no re-typing the address.
    await signInStub.succeed({ role: 'user' })
    await loginPage.password.fill(env.accounts.standard.password)
    await submitSignIn(loginPage)

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
  })

  test('TC-13652-042 Verify that the password never appears in the console, storage or telemetry @layer:ui @ac:AC-14 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
    traffic,
    consoleLog,
    telemetry,
  }) => {
    const canary = env.canaries.password
    await signInStub.succeed({ role: 'user' })

    await fillCredentials(loginPage, { identifier: env.accounts.standard.email, password: canary })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()

    // The request body is the one place the password legitimately appears, and
    // it is on the wire, not in the browser. Everything else is swept.
    const hits = await sweepForValue(page, canary, {
      traffic,
      consoleLog,
      telemetry,
      skip: ['request-bodies'],
    })
    expect(hits, `the password surfaced after sign-in:\n${describeHits(hits)}`).toEqual([])

    // And it did travel in the body, which is what makes the sweep meaningful.
    const carried = traffic.signIn().some((request) => (request.postData ?? '').includes(canary))
    expect(carried, 'the sign-in request must have carried the password in its body').toBe(true)
  })
})
