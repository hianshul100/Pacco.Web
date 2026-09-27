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
  fillCredentials,
  openPath,
  submitSignIn,
  type SubmitMethod,
} from '../../support/actions'
import { LANDING_COPY, MESSAGES, ROUTES } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { seedSession } from '../../support/sessionSeed'
import { describeHits, sweepForValue } from '../../support/sweep'
import {
  ALLOWED_LANDING_ANALYTICS_KEYS,
  ALLOWED_SIGN_IN_ANALYTICS_KEYS,
  FORBIDDEN_ANALYTICS_KEYS,
  HOSTILE_PAYLOADS,
  ROLE_AGREEMENT_CASES,
  XSS_MARKER_GLOBAL,
} from '../../support/testData'

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
    await openPath(page, ROUTES.login)
    await signInStub.rejectWith('invalid_credentials', env.canaries.reason)
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)

    // State 5: the platform fails outright.
    await signInStub.fail('connectionrefused')
    await fillCredentials(loginPage, credentials)
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.unavailable)

    const events = await telemetry.events()
    logger.info('captured sign-in analytics', { eventCount: events.length })

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

    // And no forbidden value hid inside an allowed key.
    const serialised = await telemetry.text()
    for (const secret of [
      env.canaries.password,
      env.accounts.standard.email,
      env.canaries.reason,
      'invalid_credentials',
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
          expect(typeof recognised, 'the role outcome must be recorded as a boolean').toBe('boolean')
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
      expect(
        hits,
        `${payload.label} surfaced outside its field:\n${describeHits(hits)}`,
      ).toEqual([])

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
      expect(traffic.signIn(), `submitting via ${method} must issue exactly one request`).toHaveLength(1)
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
})
