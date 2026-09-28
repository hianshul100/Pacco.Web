/**
 * Input handling and analytics payloads.
 *
 * Source rows: TC-13652-096, 097, 098, 108, 109, 110.
 *
 * A note on the analytics rows. `src/platform/telemetry.ts` starts with no
 * sink installed and `emit` returns early while that is so, which means a
 * browser test can observe nothing unless the application hands events to a
 * collector. The suite installs one before any application script runs, and
 * pairs the runtime capture with a key allow-list so that a payload which does
 * arrive is checked properly. Where nothing arrives the row records that fact
 * rather than passing silently; REVIEW.md carries the limitation in full.
 */
import {
  clickRepeatedly,
  fillCredentials,
  logout,
  openPath,
  signIn,
  submitSignIn,
  type SubmitMethod,
} from '../../support/actions'
import { LANDING_COPY, MESSAGES, ROUTES } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { epochSeconds } from '../../support/jwt'
import type { TelemetryEvent } from '../../support/observers'
import { seedSession } from '../../support/sessionSeed'
import { UNRECOGNISED_PLATFORM_CODE } from '../../support/stubs'
import { describeHits, sweepForValue } from '../../support/sweep'
import {
  ALLOWED_LANDING_ANALYTICS_KEYS,
  ALLOWED_SIGN_IN_ANALYTICS_KEYS,
  ANALYTICS_KEYS_BY_EVENT,
  BOUNDED_FAILURE_LABELS,
  FORBIDDEN_ANALYTICS_KEYS,
  HOSTILE_PAYLOADS,
  ROLE_AGREEMENT_CASES,
  XSS_MARKER_GLOBAL,
} from '../../support/testData'

/** An event's payload keys, sorted, for an exact set comparison. */
function keysOf(event: TelemetryEvent | undefined): readonly string[] {
  return event === undefined ? [] : Object.keys(event.payload).sort()
}

/** The keys an event of this name is documented to carry, sorted. */
function documentedKeys(name: string): readonly string[] {
  return [...(ANALYTICS_KEYS_BY_EVENT[name] ?? [])].sort()
}

test.describe('Input handling and analytics @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-096 Verify that the sign-in analytics events carry no credential, token or platform error text @layer:ui @ac:AC-14 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    telemetry,
    logger,
  }) => {
    const credentials = {
      identifier: env.accounts.standard.email,
      password: env.canaries.password,
    }

    // State 1: the screen is viewed.
    await openPath(page, ROUTES.login)

    // State 2: an empty submission is blocked.
    await submitSignIn(loginPage)
    await expect(loginPage.identifierMessage).toBeVisible()

    // State 3: a valid submission succeeds.
    await signInStub.succeed({ role: 'user' })
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)
    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)

    // State 4: an invalid submission is rejected by the platform.
    //
    // The rejection carries an unrecognised code rather than
    // `invalid_credentials`. Step 5 has to search every payload for "the
    // platform's error code", and `invalid_credentials` is simultaneously a
    // code the platform sends and the bounded label the client is required to
    // record for this outcome (TC-116) - so sweeping for it would flag correct
    // behaviour as a leak. An unrecognised code can only appear if it leaked.
    await openPath(page, ROUTES.login)
    await signInStub.rejectWith(UNRECOGNISED_PLATFORM_CODE, env.canaries.reason)
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.generic)

    // State 5: the platform fails outright.
    await signInStub.fail('connectionrefused')
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.unavailable)

    // An empty capture would satisfy every assertion below, so the bridge that
    // feeds it is asserted first. See REVIEW.md: the shipped client installs no
    // telemetry sink of its own.
    expect(await telemetry.bridged(), 'the telemetry sink bridge must be installed').toBe(true)

    const events = await telemetry.events()
    logger.info('captured sign-in analytics', { eventCount: events.length })
    expect(events.length, 'the run must produce events to inspect').toBeGreaterThan(0)

    // An allow-list of keys, not a deny-list of values: a payload key nobody
    // anticipated is a failure, which is the whole point of the row.
    const keys = await telemetry.payloadKeys()
    const unexpected = keys.filter(
      (key) => !(ALLOWED_SIGN_IN_ANALYTICS_KEYS as readonly string[]).includes(key),
    )
    expect(unexpected, `unexpected analytics payload keys: ${unexpected.join(', ')}`).toEqual([])

    for (const forbidden of FORBIDDEN_ANALYTICS_KEYS) {
      expect(keys, `analytics must never carry a "${forbidden}" key`).not.toContain(forbidden)
    }

    // Step 5's positive half: a failure is recorded as a bounded label, so the
    // only classification values present are ones the client owns.
    for (const event of events) {
      const classification = event.payload['classification']
      if (classification !== undefined) {
        expect(
          BOUNDED_FAILURE_LABELS as readonly string[],
          `${JSON.stringify(classification)} is not a bounded outcome label`,
        ).toContain(classification)
      }
    }

    // And no forbidden value hid inside an allowed key.
    const serialised = await telemetry.text()
    for (const secret of [
      env.canaries.password,
      env.accounts.standard.email,
      env.canaries.reason,
      UNRECOGNISED_PLATFORM_CODE,
    ]) {
      expect(serialised, `analytics must not carry "${secret.slice(0, 24)}…"`).not.toContain(secret)
    }
  })

  test('TC-13652-097 Verify that the landing analytics events record the role outcome without the raw role value @layer:ui @ac:AC-18 @intent:regression', async ({
    page,
    welcomePage,
    telemetry,
  }) => {
    const driven = ROLE_AGREEMENT_CASES.filter((entry) =>
      ['admin', 'user', 'administrator', ''].includes(entry.returned),
    )
    expect(driven, 'the CSV names four roles to drive here').toHaveLength(4)

    for (const roleCase of driven) {
      await telemetry.clear()
      await seedSession(page, { role: roleCase.returned })
      await openPath(page, ROUTES.welcome)
      await expect(welcomePage.heading).toHaveText(roleCase.heading)

      const events = await telemetry.events()
      for (const event of events) {
        const recognised = event.payload['roleRecognised']
        if (recognised !== undefined) {
          // A boolean outcome, never the role string itself.
          expect(typeof recognised, 'the role outcome must be recorded as a boolean').toBe(
            'boolean',
          )
          expect(recognised).toBe(roleCase.isAdmin)
        }
        expect(
          Object.keys(event.payload).filter(
            (key) => !(ALLOWED_LANDING_ANALYTICS_KEYS as readonly string[]).includes(key),
          ),
          `unexpected landing analytics keys on "${event.name}"`,
        ).toEqual([])
      }

      if (roleCase.returned !== '') {
        const serialised = await telemetry.text()
        expect(serialised, 'the raw role string must never be recorded').not.toContain(
          `"${roleCase.returned}"`,
        )
      }
    }

    // A blocked navigation is recorded the same way: an outcome, not a value.
    await telemetry.clear()
    await page.context().clearCookies()
    await page.evaluate(() => {
      window.sessionStorage.clear()
    })
    await openPath(page, ROUTES.welcome)
    const blockedKeys = await telemetry.payloadKeys()
    expect(
      blockedKeys.filter(
        (key) => !(ALLOWED_LANDING_ANALYTICS_KEYS as readonly string[]).includes(key),
      ),
      'a blocked navigation must record no extra keys',
    ).toEqual([])
  })

  test('TC-13652-098 Verify that hostile and oversized input in the identifier field is handled safely @layer:ui @ac:AC-9 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
    consoleLog,
  }) => {
    await signInStub.rejectWith('invalid_credentials', 'Invalid credentials.')

    for (const payload of HOSTILE_PAYLOADS) {
      await openPath(page, ROUTES.login)

      await loginPage.identifier.fill(payload.value)
      await loginPage.password.fill(env.accounts.standard.password)
      await submitSignIn(loginPage)

      // Treated as an ordinary credential: an ordinary failure message.
      await expect(
        loginPage.formMessage,
        `${payload.label} must produce the ordinary failure message`,
      ).toHaveText(MESSAGES.credentials)

      // No script ran.
      const marker = await page.evaluate(
        (name: string) => (window as unknown as Record<string, unknown>)[name],
        XSS_MARKER_GLOBAL,
      )
      expect(marker, `${payload.label} must not execute`).toBeUndefined()

      // No markup was built from the value: it appears only as a field value.
      const hits = await sweepForValue(page, payload.needle, {
        skip: ['input-values', 'request-bodies'],
      })
      expect(hits, `${payload.label} surfaced outside its field:\n${describeHits(hits)}`).toEqual(
        [],
      )

      // The layout still holds: no horizontal overflow from a long value.
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(overflows, `${payload.label} must not break the layout`).toBe(false)
    }

    expect(consoleLog.pageErrors(), 'hostile input must raise no uncaught error').toEqual([])
  })

  test('TC-13652-108 Verify that pressing Enter in either field submits the sign-in form @layer:ui @ac:AC-4 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
    traffic,
  }) => {
    const methods: readonly SubmitMethod[] = [
      'enter-from-identifier',
      'enter-from-password',
      'button',
    ]

    for (const method of methods) {
      await openPath(page, ROUTES.login)
      await signInStub.succeed({ role: 'user' })
      traffic.clear()
      signInStub.reset()

      await fillCredentials(loginPage, {
        identifier: env.accounts.standard.email,
        password: env.accounts.standard.password,
      })
      await submitSignIn(loginPage, method)

      await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
      expect(
        traffic.signIn(),
        `submitting via ${method} must issue exactly one request`,
      ).toHaveLength(1)
    }

    // Enter on an empty form runs the same validation as the button does.
    await openPath(page, ROUTES.login)
    traffic.clear()
    await submitSignIn(loginPage, 'enter-from-identifier')
    await expect(loginPage.identifierMessage).toBeVisible()
    await expect(loginPage.passwordMessage).toBeVisible()
    expect(traffic.backend(), 'Enter on an empty form must reach no backend').toEqual([])
  })

  test('TC-13652-109 Verify that the password field accepts a pasted value from a password manager @layer:ui @ac:AC-2 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
    traffic,
  }) => {
    const secret = env.accounts.standard.password
    await openPath(page, ROUTES.login)
    await signInStub.succeed({ role: 'user' })

    // Paste rather than type: the value arrives in one event, as it would from
    // a password manager.
    await page.evaluate((value: string) => {
      const field = document.querySelector<HTMLInputElement>('#login-password')
      if (field === null) {
        throw new Error('the password field was not found')
      }
      field.focus()
      const transfer = new DataTransfer()
      transfer.setData('text/plain', value)
      field.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }))
      // Browsers apply the pasted text themselves; the fixture completes it so
      // the React-controlled input receives the same change event it would.
      // eslint-disable-next-line @typescript-eslint/unbound-method -- taken unbound on purpose; invoked below with an explicit receiver via .call()
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set
      setter?.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
    }, secret)

    // The field holds every character and is still masked.
    await expect(loginPage.password).toHaveValue(secret)
    expect(secret.length, 'the CSV fixture is 22 characters long').toBe(22)
    await expect(loginPage.password).toHaveAttribute('type', 'password')

    traffic.clear()
    await loginPage.identifier.fill(env.accounts.standard.email)
    await submitSignIn(loginPage)
    await expect(welcomePage.standardHeading).toBeVisible()

    // What was pasted is what was sent, byte for byte.
    const body = traffic.signIn()[0]?.postData ?? ''
    expect(JSON.parse(body) as { password?: string }).toMatchObject({ password: secret })
  })

  test('TC-13652-110 Verify that browser autofill populates both fields and the form still validates @layer:ui @ac:AC-3 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
    traffic,
  }) => {
    await openPath(page, ROUTES.login)
    await signInStub.succeed({ role: 'user' })

    // Autofill sets values without keystrokes. Chromium exposes no API to
    // trigger its own credential autofill from a test, so the fixture
    // reproduces what autofill does to the DOM: it assigns the value through
    // the native setter and dispatches a single input event, with no key
    // events at all. REVIEW.md records this as a simulation.
    await page.evaluate(
      ([identifier, password]: [string, string]) => {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- taken unbound on purpose; invoked below with an explicit receiver via .call()
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set
        const assign = (selector: string, value: string): void => {
          const field = document.querySelector<HTMLInputElement>(selector)
          if (field === null) {
            throw new Error(`autofill target ${selector} was not found`)
          }
          setter?.call(field, value)
          field.dispatchEvent(new Event('input', { bubbles: true }))
          field.dispatchEvent(new Event('change', { bubbles: true }))
        }
        assign('#login-identifier', identifier)
        assign('#login-password', password)
      },
      [env.accounts.standard.email, env.accounts.standard.password] as [string, string],
    )

    await expect(loginPage.identifier).toHaveValue(env.accounts.standard.email)
    await expect(loginPage.password).toHaveValue(env.accounts.standard.password)

    // Validation treats autofilled fields as filled.
    traffic.clear()
    await submitSignIn(loginPage)
    await expect(loginPage.identifierMessage).toHaveCount(0)
    await expect(loginPage.passwordMessage).toHaveCount(0)
    await expect(welcomePage.standardHeading).toBeVisible()

    // And the request carried the autofilled values.
    const body = traffic.signIn()[0]?.postData ?? ''
    expect(JSON.parse(body) as { email?: string; password?: string }).toMatchObject({
      email: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
  })

  test('TC-13652-116 Verify that the six sign-in events fire at their documented points with documented payloads @layer:ui @ac:AC-14 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
    telemetry,
    logger,
  }) => {
    const credentials = {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    }

    // Step 1: the screen is opened.
    await openPath(page, ROUTES.login)
    await expect(loginPage.heading).toBeVisible()
    expect(await telemetry.bridged(), 'the telemetry sink bridge must be installed').toBe(true)

    // Step 2: both fields empty.
    await submitSignIn(loginPage)
    await expect(loginPage.identifierMessage).toBeVisible()

    // Step 3: a response held open, activated once and then four more times.
    const successBody = await signInStub.succeedSlowly(env.timeouts.telemetryHoldMs, {
      role: 'user',
    })
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)
    // Waiting on the in-flight state itself, not on a timer: the extra
    // activations have to land while the first request is genuinely open.
    await expect(loginPage.submitControls.first()).toHaveAttribute('aria-busy', 'true')
    await clickRepeatedly(loginPage, env.repetitions.duplicateClicks)

    // Step 4: settle, log out, then a rejected attempt.
    await expect(welcomePage.standardHeading).toBeVisible()
    expect(
      signInStub.count(),
      'five activations of a held request must produce exactly one request',
    ).toBe(1)

    await logout(welcomePage)
    await expect(loginPage.heading).toBeVisible()

    await signInStub.rejectWith('invalid_credentials', env.canaries.reason)
    await fillCredentials(loginPage, {
      identifier: credentials.identifier,
      password: env.accounts.wrongPassword,
    })
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)

    // Step 5: list every captured event.
    const events = await telemetry.events()
    const signInEvents = events.filter((event) => event.name.startsWith('login.'))
    logger.info('captured sign-in analytics', {
      names: signInEvents.map((event) => event.name),
    })

    // Expected result 1. The row states "exactly one screen-viewed event", but
    // its own step 4 returns to the sign-in screen after logging out, and the
    // screen emits on every arrival. So the invariant actually available is
    // "exactly one per arrival", asserted here against the two arrivals the
    // documented run makes. REVIEW.md records the wording mismatch.
    const viewed = await telemetry.named('login.viewed')
    expect(viewed, 'one screen-viewed event per arrival at the sign-in screen').toHaveLength(2)
    for (const event of viewed) {
      expect(keysOf(event)).toEqual(documentedKeys('login.viewed'))
      expect(event.payload['route']).toBe(ROUTES.login)
    }

    // Expected result 2.
    const blocked = await telemetry.named('login.validation_blocked')
    expect(blocked, 'exactly one validation-blocked event').toHaveLength(1)
    expect(keysOf(blocked[0])).toEqual(documentedKeys('login.validation_blocked'))
    expect(blocked[0]?.payload['identifierEmpty']).toBe(true)
    expect(blocked[0]?.payload['passwordEmpty']).toBe(true)

    // Expected result 3. As with the screen-viewed event, the documented run
    // makes two submissions - the held success and the rejected attempt - so
    // the invariant is one event per submission, not one for the whole run.
    const submitted = await telemetry.named('login.submitted')
    expect(submitted, 'one submission-started event per submission').toHaveLength(2)
    expect(keysOf(submitted[0])).toEqual(documentedKeys('login.submitted'))
    const inFlightCorrelationId = submitted[0]?.payload['correlationId']
    expect(typeof inFlightCorrelationId, 'a submission carries a correlation id').toBe('string')

    const suppressed = await telemetry.named('login.duplicate_suppressed')
    expect(suppressed, 'four activations during one held request must be suppressed').toHaveLength(
      env.repetitions.duplicateClicks,
    )
    for (const event of suppressed) {
      expect(keysOf(event)).toEqual(documentedKeys('login.duplicate_suppressed'))
      expect(
        event.payload['correlationId'],
        'a suppressed duplicate carries the in-flight correlation id',
      ).toBe(inFlightCorrelationId)
    }

    // Expected result 4.
    const succeeded = await telemetry.named('login.succeeded')
    expect(succeeded, 'exactly one sign-in-succeeded event').toHaveLength(1)
    expect(keysOf(succeeded[0])).toEqual(documentedKeys('login.succeeded'))
    expect(succeeded[0]?.payload['correlationId']).toBe(inFlightCorrelationId)

    const failed = await telemetry.named('login.failed')
    expect(failed, 'exactly one sign-in-failed event').toHaveLength(1)
    expect(keysOf(failed[0])).toEqual(documentedKeys('login.failed'))
    expect(failed[0]?.payload['classification']).toBe('invalid_credentials')
    expect(
      BOUNDED_FAILURE_LABELS as readonly string[],
      'the outcome label must come from the bounded set',
    ).toContain(failed[0]?.payload['classification'])
    expect(
      failed[0]?.payload['correlationId'],
      'the failed attempt carries its own correlation id',
    ).toBe(submitted[1]?.payload['correlationId'])

    // Expected result 5: six distinct names, each holding only its own keys.
    const names = [...new Set(signInEvents.map((event) => event.name))].sort()
    expect(names, 'all six documented sign-in events must be present').toEqual(
      [
        'login.duplicate_suppressed',
        'login.failed',
        'login.submitted',
        'login.succeeded',
        'login.validation_blocked',
        'login.viewed',
      ].sort(),
    )
    for (const event of signInEvents) {
      expect(keysOf(event), `"${event.name}" carried an undocumented key`).toEqual(
        documentedKeys(event.name),
      )
    }

    // Expected result 6.
    const serialised = await telemetry.text()
    for (const secret of [
      credentials.password,
      credentials.identifier,
      env.accounts.wrongPassword,
      successBody.accessToken,
      successBody.refreshToken,
      env.canaries.reason,
    ]) {
      expect(serialised, `analytics must not carry "${secret.slice(0, 16)}…"`).not.toContain(secret)
    }
  })

  test('TC-13652-118 Verify that the four landing events fire once each with their documented payloads @layer:ui @ac:AC-18 @ac:AC-20 @ac:AC-21 @ac:AC-22 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
    telemetry,
  }) => {
    const loginUrl = `${env.webBaseUrl}${ROUTES.login}`

    // Step 1: the administrator signs in and the landing screen renders.
    await openPath(page, ROUTES.login)
    expect(await telemetry.bridged(), 'the telemetry sink bridge must be installed').toBe(true)
    await signInStub.succeed({ role: 'admin' })
    await signIn(loginPage, {
      identifier: env.accounts.admin.email,
      password: env.accounts.admin.password,
    })
    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)

    // Step 2: exactly two keys, the decision and the recognised flag.
    const adminViews = await telemetry.named('landing.viewed')
    expect(adminViews, 'exactly one landing-viewed event for the administrator').toHaveLength(1)
    expect(keysOf(adminViews[0])).toEqual(documentedKeys('landing.viewed'))
    expect(keysOf(adminViews[0]), 'the payload holds exactly two keys').toHaveLength(2)
    expect(adminViews[0]?.payload['presentation']).toBe('admin')
    expect(adminViews[0]?.payload['roleRecognised']).toBe(true)

    // Step 3: logout, on the way back to the sign-in screen.
    await logout(welcomePage)
    await expect(page).toHaveURL(loginUrl)
    const logouts = await telemetry.named('landing.logout')
    expect(logouts, 'exactly one logout event').toHaveLength(1)
    expect(keysOf(logouts[0])).toEqual(documentedKeys('landing.logout'))
    expect(logouts[0]?.payload['route']).toBe(ROUTES.welcome)

    // Step 4: the landing route requested directly with no session.
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(loginUrl)
    const blocked = await telemetry.named('landing.blocked_unauthenticated')
    expect(blocked, 'exactly one blocked event').toHaveLength(1)
    expect(keysOf(blocked[0])).toEqual(documentedKeys('landing.blocked_unauthenticated'))
    expect(blocked[0]?.payload['route']).toBe(ROUTES.welcome)
    await expect(welcomePage.heading, 'no part of the landing screen renders').toHaveCount(0)
    await expect(welcomePage.logout).toHaveCount(0)
    await expect(welcomePage.roleIndicator).toHaveCount(0)

    // Step 5: a session whose expiry has already passed.
    await seedSession(page, { role: 'user', expiresAt: epochSeconds(-60) })
    await openPath(page, ROUTES.welcome)
    await expect(page).toHaveURL(loginUrl)
    await expect(loginPage.sessionNotice).toHaveText(MESSAGES.sessionExpired)
    const expired = await telemetry.named('landing.session_expired')
    expect(expired, 'exactly one session-expired event').toHaveLength(1)
    expect(keysOf(expired[0])).toEqual(documentedKeys('landing.session_expired'))
    expect(expired[0]?.payload['route']).toBe(ROUTES.welcome)
    expect(expired[0]?.name, 'the expired event is a distinct name from the blocked one').not.toBe(
      blocked[0]?.name,
    )

    // Step 6: the ordinary account, from the sign-in screen already on screen.
    // 🚫 No reload here: the seeded expired session is re-applied on every
    // document load, and reloading would plant it again underneath the
    // successful sign-in.
    await signInStub.succeed({ role: 'user' })
    await signIn(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)

    const allViews = await telemetry.named('landing.viewed')
    expect(allViews, 'one landing-viewed event per landing render').toHaveLength(2)
    const ordinaryView = allViews[1]
    expect(keysOf(ordinaryView)).toEqual(documentedKeys('landing.viewed'))
    expect(keysOf(ordinaryView), 'the payload holds exactly two keys').toHaveLength(2)
    expect(ordinaryView?.payload['presentation']).toBe('standard')
    expect(ordinaryView?.payload['roleRecognised']).toBe(true)

    // No identifier and no token reached any payload.
    //
    // 🚫 The raw role value is NOT swept for as a string: `admin` is also the
    // legitimate `presentation` word, so a substring sweep cannot separate the
    // two. The exact key-set assertions above are what forbid the role - there
    // is no key it could occupy.
    const serialised = await telemetry.text()
    for (const secret of [env.accounts.admin.email, env.accounts.standard.email]) {
      expect(serialised, `landing analytics must not carry "${secret}"`).not.toContain(secret)
    }
    for (const forbidden of FORBIDDEN_ANALYTICS_KEYS) {
      expect(await telemetry.payloadKeys()).not.toContain(forbidden)
    }
  })
})
