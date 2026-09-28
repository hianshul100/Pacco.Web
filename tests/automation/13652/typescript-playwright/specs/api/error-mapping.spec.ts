/**
 * How platform failures become screen messages.
 *
 * Source rows: TC-13652-028 … 037.
 *
 * The client shows exactly three failure messages. Every possible platform
 * outcome maps onto one of them, and the mapping is deliberately lossy: a
 * rejected credential and an unknown address must be indistinguishable, and
 * the platform's own reason text must never appear anywhere. These rows walk
 * the whole mapping, one platform outcome at a time.
 */
import { fillCredentials, openPath, submitSignIn } from '../../support/actions'
import { MESSAGES, ROUTES, SESSION_STORAGE_KEY } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { unusableTokens } from '../../support/jwt'
import {
  malformedSuccessBodies,
  SERVER_ERROR_STATUSES,
  successBody,
  TRANSPORT_FAULTS,
  UNMAPPED_FAILURE_CODES,
} from '../../support/stubs'
import { describeHits, readStoredSession, sweepForValue } from '../../support/sweep'

test.describe('Failure mapping @story:13652 @component:pacco-web-login', () => {
  test.beforeEach(async ({ page }) => {
    await openPath(page, ROUTES.login)
  })

  test('TC-13652-028 Verify that a rejected credential produces the fixed credentials message and no session @layer:api @ac:AC-9 @intent:smoke', async ({
    env,
    page,
    loginPage,
    signInStub,
  }) => {
    await signInStub.rejectWith('invalid_credentials', 'Invalid credentials.')

    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.wrongPassword,
    })
    await submitSignIn(loginPage)

    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()

    // The platform's own wording is not what the user reads.
    await expect(loginPage.formMessage).not.toHaveText('Invalid credentials.')
  })

  test('TC-13652-029 Verify that an unrecognised address produces the same message as a wrong password @layer:api @ac:AC-10 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
  }) => {
    // The platform distinguishes the two; the screen must not.
    await signInStub.rejectWith('invalid_credentials', 'Invalid credentials.')
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.wrongPassword,
    })
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)
    const wrongPasswordMarkup = await loginPage.formMessage.innerHTML()

    await openPath(page, ROUTES.login)
    await signInStub.rejectWith('invalid_email')
    await fillCredentials(loginPage, {
      identifier: env.accounts.unknownEmailStubbed,
      password: env.accounts.wrongPassword,
    })
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)

    // Character for character, including markup: nothing enumerates accounts.
    expect(await loginPage.formMessage.innerHTML(), 'both outcomes must render identically').toBe(
      wrongPasswordMarkup,
    )
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
  })

  test('TC-13652-030 Verify that an unrecognised platform error code produces the generic message @layer:api @ac:AC-12 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
  }) => {
    for (const code of UNMAPPED_FAILURE_CODES) {
      await openPath(page, ROUTES.login)
      await signInStub.rejectWith(code, 'Something the platform decided to say.')

      await fillCredentials(loginPage, {
        identifier: env.accounts.standard.email,
        password: env.accounts.standard.password,
      })
      await submitSignIn(loginPage)

      // Unmapped means generic - not the credentials message, which would
      // mislead, and not the platform's own words.
      await expect(
        loginPage.formMessage,
        `the code "${code}" is unmapped and must produce the generic message`,
      ).toHaveText(MESSAGES.generic)
      expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
    }
  })

  test('TC-13652-031 Verify that an error response with no code field produces the generic message @layer:api @ac:AC-12 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    consoleLog,
  }) => {
    const shapes: ReadonlyArray<{ readonly label: string; readonly body: string }> = [
      { label: 'an empty object', body: '{}' },
      { label: 'a reason with no code', body: JSON.stringify({ reason: 'Something happened.' }) },
      { label: 'a null code', body: JSON.stringify({ code: null }) },
      { label: 'an empty body', body: '' },
    ]

    for (const shape of shapes) {
      await openPath(page, ROUTES.login)
      await signInStub.rejectWithRawBody(shape.body)

      await fillCredentials(loginPage, {
        identifier: env.accounts.standard.email,
        password: env.accounts.standard.password,
      })
      await submitSignIn(loginPage)

      await expect(
        loginPage.formMessage,
        `${shape.label} must produce the generic message`,
      ).toHaveText(MESSAGES.generic)
      await expect(loginPage.submit).toBeEnabled()
      expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
    }

    expect(consoleLog.pageErrors(), 'a codeless error must not crash the screen').toEqual([])
  })

  test('TC-13652-032 Verify that platform reason text never reaches the screen, storage or telemetry @layer:api @ac:AC-9 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    traffic,
    consoleLog,
    telemetry,
  }) => {
    // The canary looks like the internal detail a platform sometimes leaks:
    // a driver exception with a class name, a repository and a line number.
    const canary = env.canaries.reason
    await signInStub.rejectWith('invalid_credentials', canary)

    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)

    const hits = await sweepForValue(page, canary, { traffic, consoleLog, telemetry })
    expect(hits, `the platform reason leaked:\n${describeHits(hits)}`).toEqual([])

    // Nor did a fragment of it: the class name alone is enough to be a leak.
    const fragment = canary.split(' ')[0] ?? canary
    const fragmentHits = await sweepForValue(page, fragment, { traffic, consoleLog, telemetry })
    expect(fragmentHits, `part of the reason leaked:\n${describeHits(fragmentHits)}`).toEqual([])
  })

  test('TC-13652-033 Verify that a server failure at the edge produces the temporarily-unavailable message @layer:api @ac:AC-11 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
  }) => {
    for (const status of SERVER_ERROR_STATUSES) {
      await openPath(page, ROUTES.login)
      await signInStub.respondWithStatus(status, JSON.stringify({ code: 'error' }))

      await fillCredentials(loginPage, {
        identifier: env.accounts.standard.email,
        password: env.accounts.standard.password,
      })
      await submitSignIn(loginPage)

      // A server-side failure is an availability problem, never a credential
      // one: telling the user to check their password would be wrong.
      await expect(
        loginPage.formMessage,
        `status ${status} must produce the unavailable message`,
      ).toHaveText(MESSAGES.unavailable)
      await expect(loginPage.formMessage).not.toHaveText(MESSAGES.credentials)
      expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
    }
  })

  test('TC-13652-034 Verify that a refused connection produces the temporarily-unavailable message and releases the lock @layer:api @ac:AC-11 @ac:AC-5 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    traffic,
  }) => {
    for (const transport of TRANSPORT_FAULTS) {
      await openPath(page, ROUTES.login)
      await signInStub.fail(transport.fault)
      traffic.clear()
      signInStub.reset()

      await fillCredentials(loginPage, {
        identifier: env.accounts.standard.email,
        password: env.accounts.standard.password,
      })
      await submitSignIn(loginPage)

      await expect(
        loginPage.formMessage,
        `${transport.label} must produce the unavailable message`,
      ).toHaveText(MESSAGES.unavailable)

      // The in-flight lock is released, not left latched by the failure: a
      // second attempt genuinely reaches the edge again.
      await expect(loginPage.submit).toBeEnabled()
      await loginPage.password.fill(env.accounts.standard.password)
      await submitSignIn(loginPage)
      await expect
        .poll(() => traffic.signIn().length, {
          message: `the lock was not released after ${transport.label}`,
        })
        .toBe(2)
    }
  })

  test('TC-13652-035 Verify that a request exceeding the configured timeout is aborted and reported as unavailable @layer:api @ac:AC-11 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
  }) => {
    // The CSV pairs a 15-second client limit with a 20-second edge. The delay
    // is derived from the configured limit rather than written as a literal,
    // so re-configuring the limit keeps the row meaningful.
    const heldForMs = env.timeouts.signInMs + env.timeouts.slowResponseMs
    test.setTimeout(env.timeouts.testMs + heldForMs)

    await signInStub.succeedSlowly(heldForMs, { role: 'user' })

    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)

    // The client gives up at its own limit: the message must appear before the
    // edge would have answered, which is what makes this a timeout test.
    await expect(loginPage.formMessage).toHaveText(MESSAGES.unavailable, {
      timeout: heldForMs,
    })
    await expect(loginPage.submit).toBeEnabled()
    expect(await readStoredSession(page, SESSION_STORAGE_KEY)).toBeNull()
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)

    // Stop intercepting so the abandoned response cannot be fulfilled after
    // the row has finished with it.
    await signInStub.dispose()
  })

  test('TC-13652-036 Verify that a success response with a malformed body creates no session @layer:api @ac:AC-12 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    navigation,
    consoleLog,
  }) => {
    for (const malformed of malformedSuccessBodies()) {
      await openPath(page, ROUTES.login)
      await signInStub.succeedWithRawBody(malformed.body)
      navigation.clear()

      await fillCredentials(loginPage, {
        identifier: env.accounts.standard.email,
        password: env.accounts.standard.password,
      })
      await submitSignIn(loginPage)

      // A 200 is not enough: the body has to be usable.
      await expect(
        loginPage.formMessage,
        `${malformed.label} must produce the generic message`,
      ).toHaveText(MESSAGES.generic)
      expect(
        await readStoredSession(page, SESSION_STORAGE_KEY),
        `${malformed.label} must leave no session`,
      ).toBeNull()
      expect(
        navigation.paths().filter((path) => path === ROUTES.welcome),
        `${malformed.label} must not reach the landing address`,
      ).toEqual([])
    }

    expect(consoleLog.pageErrors(), 'a malformed body must not raise an uncaught error').toEqual([])
  })

  test('TC-13652-037 Verify that a success response with an unusable token creates no session @layer:api @ac:AC-12 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    consoleLog,
  }) => {
    for (const unusable of unusableTokens()) {
      await openPath(page, ROUTES.login)

      // The envelope carries a perfectly good `expires`. If the client falls
      // back to it instead of reading the token, a session appears - which is
      // precisely the failure this row exists to catch.
      const body = successBody({ role: 'user', accessToken: unusable.token })
      await signInStub.succeedWithRawBody(JSON.stringify(body))

      await fillCredentials(loginPage, {
        identifier: env.accounts.standard.email,
        password: env.accounts.standard.password,
      })
      await submitSignIn(loginPage)

      await expect(
        loginPage.formMessage,
        `${unusable.label} must produce the generic message`,
      ).toHaveText(MESSAGES.generic)
      expect(
        await readStoredSession(page, SESSION_STORAGE_KEY),
        `${unusable.label} must leave no session`,
      ).toBeNull()
      await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.login}`)
    }

    expect(consoleLog.pageErrors(), 'an unusable token must not raise an uncaught error').toEqual(
      [],
    )
  })
})
