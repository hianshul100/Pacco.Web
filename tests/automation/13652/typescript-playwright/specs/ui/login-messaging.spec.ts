/**
 * What the Login screen says, and what it does afterwards.
 *
 * Source rows: TC-13652-027, 038, 039, 040, 041, 042, 123, 124, 125, 126.
 */
import type { Page } from '@playwright/test'

import type { LoginPage } from '../../pages/LoginPage'
import {
  fillCredentials,
  hardReload,
  openPath,
  submitSignIn,
  tabThrough,
  typeCharacter,
} from '../../support/actions'
import {
  LANDING_COPY,
  MESSAGES,
  ROUTES,
  SESSION_STORAGE_KEY,
  SIGN_IN_FAILURE_MESSAGES,
} from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { epochSeconds } from '../../support/jwt'
import { clearAllStorage, seedSession } from '../../support/sessionSeed'
import { malformedSuccessBodies } from '../../support/stubs'
import { describeHits, readStoredSession, sweepForValue } from '../../support/sweep'

/** The marker TC-126 plants to prove the document was never re-fetched. */
// Lower-case on purpose: the suite's lint rule treats a mixed-case token with
// a digit and a symbol as credential-shaped, and this is just a window key.
const NO_RELOAD_MARKER = 'pacco.13652.no-reload-marker'

/**
 * Asserts one failure message is on screen, that it says exactly `expected`,
 * and that neither of the other two registry messages survived alongside it.
 *
 * `FormMessage` is always mounted, so "exactly one" is a claim about the text
 * the regions carry rather than about how many regions exist (TC-125).
 */
async function assertSoleFailureMessage(
  page: Page,
  login: LoginPage,
  expected: string,
): Promise<void> {
  await expect(login.formMessage).toHaveCount(1)
  await expect(login.formMessage).toHaveText(expected)
  await expect(login.alertRegion).toHaveCount(1)
  for (const other of SIGN_IN_FAILURE_MESSAGES) {
    if (other === expected) {
      continue
    }
    await expect(
      page.getByText(other, { exact: true }),
      `"${other}" belongs to an earlier outcome and must not still be on screen`,
    ).toHaveCount(0)
  }
}

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

  test('TC-13652-123 Verify that the Login screen shows no session notice when opened without one @layer:ui @ac:AC-21 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
  }) => {
    // Step 1: a genuinely cold entry - storage emptied, then the address typed.
    await clearAllStorage(page)
    await openPath(page, ROUTES.login)

    await expect(loginPage.identifier).toHaveValue('')
    await expect(loginPage.password).toHaveValue('')

    // Step 2: the status region carries nothing.
    await expect(loginPage.sessionNotice).toHaveText('')
    await expect(loginPage.sessionNotice).toBeHidden()
    await expect(page.getByText(MESSAGES.sessionExpired, { exact: true })).toHaveCount(0)

    // Step 3: and neither does any other message region.
    await expect(loginPage.formMessage).toHaveText('')
    await expect(loginPage.formMessage).toBeHidden()
    for (const message of SIGN_IN_FAILURE_MESSAGES) {
      await expect(
        page.getByText(message, { exact: true }),
        `the screen must carry no message on entry, but showed "${message}"`,
      ).toHaveCount(0)
    }

    // Step 4: a reload does not conjure one either.
    await hardReload(page)
    await expect(loginPage.heading).toBeVisible()
    await expect(loginPage.sessionNotice).toHaveText('')
    await expect(loginPage.sessionNotice).toBeHidden()

    // Step 5: only the expiry path populates the region - which is what makes
    // the four assertions above a statement about the notice rather than about
    // a region that never renders at all.
    await seedSession(page, { role: 'user', expiresAt: epochSeconds(-60) })
    await openPath(page, ROUTES.welcome)

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    await expect(welcomePage.heading).toHaveCount(0)
    await expect(loginPage.sessionNotice).toBeVisible()
    await expect(loginPage.sessionNotice).toHaveText(MESSAGES.sessionExpired)
  })

  test('TC-13652-124 Verify that a sign-in failure message does not displace the session-ended notice @layer:ui @ac:AC-21 @ac:AC-9 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    // Step 1: arrive at the Login screen the way an expired session arrives.
    await seedSession(page, { role: 'user', expiresAt: epochSeconds(-60) })
    await openPath(page, ROUTES.welcome)

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    // The landing screen was never painted on the way past.
    await expect(welcomePage.heading).toHaveCount(0)

    // Step 2: the notice is in the status region, not in the alert region.
    await expect(loginPage.sessionNotice).toHaveText(MESSAGES.sessionExpired)
    await expect(loginPage.statusRegion).toContainText(MESSAGES.sessionExpired)
    await expect(loginPage.alertRegion).not.toContainText(MESSAGES.sessionExpired)

    // Step 3: a failing attempt on top of it.
    signInStub.reset()
    await signInStub.rejectWith('invalid_credentials', 'Invalid credentials.')
    await fillCredentials(loginPage, {
      identifier: env.accounts.other.email,
      password: env.accounts.wrongPassword,
    })
    await submitSignIn(loginPage)

    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)
    expect(signInStub.count(), 'the rejected attempt must have reached the edge').toBe(1)

    // Step 4: both are on screen at once, in their own regions.
    await expect(loginPage.sessionNotice).toBeVisible()
    await expect(loginPage.sessionNotice).toHaveText(MESSAGES.sessionExpired)
    await expect(loginPage.formMessage).toBeVisible()
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)
    // Neither region swallowed the other's text.
    await expect(loginPage.statusRegion).not.toContainText(MESSAGES.credentials)
    await expect(loginPage.alertRegion).not.toContainText(MESSAGES.sessionExpired)
    // Two regions, two roles: `status` announces politely, `alert` assertively.
    await expect(loginPage.statusRegion).toHaveCount(1)
    await expect(loginPage.alertRegion).toHaveCount(1)

    // Step 5: the corrected attempt clears both by leaving the screen entirely.
    await signInStub.succeed({ role: 'user' })
    await loginPage.password.fill(env.accounts.other.password)
    await submitSignIn(loginPage)

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await expect(loginPage.sessionNotice).toHaveCount(0)
    await expect(loginPage.formMessage).toHaveCount(0)
  })

  test('TC-13652-125 Verify that a new failure outcome replaces the previous message rather than stacking @layer:ui @ac:AC-9 @ac:AC-11 @ac:AC-12 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
  }) => {
    const credentials = {
      identifier: env.accounts.other.email,
      password: env.accounts.wrongPassword,
    }

    // The screen starts clean, which is what makes "replaced" observable.
    await expect(loginPage.formMessage).toHaveText('')

    // --- Attempt 1: the credentials rejection -----------------------------
    await signInStub.rejectWith('invalid_credentials', 'Invalid credentials.')
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)

    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)
    // Step 1: the screen is usable again before the next attempt is made.
    await expect(loginPage.identifier).toBeEditable()
    await expect(loginPage.password).toBeEditable()
    // Step 2.
    await assertSoleFailureMessage(page, loginPage, MESSAGES.credentials)

    // --- Attempt 2: a platform failure at the edge ------------------------
    await signInStub.respondWithStatus(503)
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)

    await expect(loginPage.formMessage).toHaveText(MESSAGES.unavailable)
    // Step 3: the previous message is gone, not pushed down the page.
    await assertSoleFailureMessage(page, loginPage, MESSAGES.unavailable)

    // --- Attempt 3: a success whose body is unusable ----------------------
    const [firstMalformed] = malformedSuccessBodies()
    expect(firstMalformed, 'the malformed-body table must not be empty').toBeDefined()
    await signInStub.succeedWithRawBody(firstMalformed?.body ?? '')
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)

    await expect(loginPage.formMessage).toHaveText(MESSAGES.generic)
    // Step 4.
    await assertSoleFailureMessage(page, loginPage, MESSAGES.generic)

    // Step 5: three attempts, no session.
    expect(
      await readStoredSession(page, SESSION_STORAGE_KEY),
      'none of the three attempts may write a session',
    ).toBeNull()
  })

  test('TC-13652-126 Verify that typing in either field clears the displayed sign-in failure message @layer:ui @ac:AC-13 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    const identifier = env.accounts.other.email

    // Planted before the first submission: if the document were re-fetched at
    // any point, this global would be gone (step 5).
    await page.evaluate((marker: string) => {
      ;(window as unknown as Record<string, unknown>)[marker] = true
    }, NO_RELOAD_MARKER)

    // --- Step 1: a failure message is on screen ---------------------------
    await signInStub.rejectWith('invalid_credentials', 'Invalid credentials.')
    await fillCredentials(loginPage, { identifier, password: env.accounts.wrongPassword })
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)

    // --- Step 2: one keystroke in the password field ----------------------
    // The failure path cleared the password value, so this is a keystroke into
    // an empty field rather than an edit of the rejected value.
    await typeCharacter(loginPage.password, 'a')
    await expect(loginPage.formMessage).toHaveText('')
    await expect(loginPage.formMessage).toBeHidden()

    // --- Step 3: bring the message back -----------------------------------
    await loginPage.password.fill(env.accounts.wrongPassword)
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)

    // --- Step 4: one keystroke in the address field -----------------------
    await typeCharacter(loginPage.identifier, 'x')
    await expect(loginPage.formMessage).toHaveText('')
    await expect(loginPage.formMessage).toBeHidden()

    // --- Step 5: the corrected entry signs in -----------------------------
    // The keystroke above left a stray character on the end of the address, so
    // the address is restored before the corrected password is submitted;
    // otherwise the final attempt would be correcting two things, not one.
    await loginPage.identifier.fill(identifier)
    await signInStub.succeed({ role: 'user' })
    await loginPage.password.fill(env.accounts.other.password)
    await submitSignIn(loginPage)

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)

    // And the whole sequence ran in one page session.
    const survived = await page.evaluate(
      (marker: string) => marker in (window as unknown as Record<string, unknown>),
      NO_RELOAD_MARKER,
    )
    expect(survived, 'the recovery must not have required a page reload').toBe(true)
  })
})
