/**
 * Client-side validation and the submit lock.
 *
 * Source rows: TC-13652-011 … TC-13652-017.
 *
 * Every row here counts requests. The count comes from the traffic recorder,
 * which sees what the browser issued, so "blocked before any request" is
 * asserted against the wire rather than inferred from a message appearing.
 */
import {
  clickRepeatedly,
  fillCredentials,
  openPath,
  submitSignIn,
} from '../../support/actions'
import { LOGIN_COPY, MESSAGES, ROUTES } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { WHITESPACE_IDENTIFIER, WHITESPACE_PASSWORD } from '../../support/testData'

test.describe('Login validation and submit lock @story:13652 @component:pacco-web-login', () => {
  test.beforeEach(async ({ page }) => {
    await openPath(page, ROUTES.login)
  })

  test('TC-13652-011 Verify that submitting with both fields empty blocks the request and marks both fields @layer:ui @ac:AC-3 @intent:regression', async ({
    loginPage,
    traffic,
  }) => {
    traffic.clear()
    await submitSignIn(loginPage)

    // One message per empty field - two in total.
    await expect(loginPage.identifierMessage).toBeVisible()
    await expect(loginPage.passwordMessage).toBeVisible()
    await expect(loginPage.identifier).toHaveAttribute('aria-invalid', 'true')
    await expect(loginPage.password).toHaveAttribute('aria-invalid', 'true')

    // Focus moves to the first field that needs attention.
    await expect(loginPage.identifier).toBeFocused()

    expect(traffic.backend(), 'a blocked submission must reach no backend').toEqual([])
  })

  test('TC-13652-012 Verify that submitting with only the identifier empty blocks the request @layer:ui @ac:AC-3 @intent:regression', async ({
    env,
    loginPage,
    traffic,
  }) => {
    await loginPage.password.fill(env.accounts.standard.password)
    traffic.clear()
    await submitSignIn(loginPage)

    await expect(loginPage.identifierMessage).toBeVisible()
    await expect(loginPage.identifier).toHaveAttribute('aria-invalid', 'true')

    // The populated field is not marked.
    await expect(loginPage.passwordMessage).toHaveCount(0)
    await expect(loginPage.password).not.toHaveAttribute('aria-invalid', 'true')

    await expect(loginPage.identifier).toBeFocused()
    expect(traffic.backend(), 'a blocked submission must reach no backend').toEqual([])
  })

  test('TC-13652-013 Verify that submitting with only the password empty blocks the request @layer:ui @ac:AC-3 @intent:regression', async ({
    env,
    loginPage,
    traffic,
  }) => {
    await loginPage.identifier.fill(env.accounts.standard.email)
    traffic.clear()
    await submitSignIn(loginPage)

    await expect(loginPage.passwordMessage).toBeVisible()
    await expect(loginPage.password).toHaveAttribute('aria-invalid', 'true')

    await expect(loginPage.identifierMessage).toHaveCount(0)
    await expect(loginPage.identifier).not.toHaveAttribute('aria-invalid', 'true')

    // Focus moves to the field that needs attention, which here is the password.
    await expect(loginPage.password).toBeFocused()
    expect(traffic.backend(), 'a blocked submission must reach no backend').toEqual([])
  })

  test('TC-13652-014 Verify that whitespace-only entries are treated as empty and block the request @layer:ui @ac:AC-3 @intent:regression', async ({
    loginPage,
    traffic,
  }) => {
    // Three spaces and two tabs: visually "filled", semantically empty.
    await fillCredentials(loginPage, {
      identifier: WHITESPACE_IDENTIFIER,
      password: WHITESPACE_PASSWORD,
    })
    traffic.clear()
    await submitSignIn(loginPage)

    await expect(loginPage.identifierMessage).toBeVisible()
    await expect(loginPage.passwordMessage).toBeVisible()
    await expect(loginPage.identifier).toHaveAttribute('aria-invalid', 'true')
    await expect(loginPage.password).toHaveAttribute('aria-invalid', 'true')
    await expect(loginPage.identifier).toBeFocused()

    expect(traffic.backend(), 'whitespace must not be treated as a credential').toEqual([])
  })

  test('TC-13652-015 Verify that five rapid activations of Sign in produce exactly one request @layer:ui @ac:AC-4 @intent:regression', async ({
    env,
    loginPage,
    signInStub,
    traffic,
  }) => {
    // The response is held open for the whole burst, so every activation after
    // the first lands inside the request window. That window is what makes the
    // row meaningful; the clicks themselves are issued back to back rather than
    // spaced by a sleep.
    await signInStub.succeedSlowly(env.timeouts.slowResponseMs, { role: 'user' })

    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    traffic.clear()
    signInStub.reset()

    await clickRepeatedly(loginPage, 5)

    // While the request is in flight the action is unavailable and says so.
    await expect(loginPage.submit).toBeDisabled()
    await expect(loginPage.submit).toHaveAttribute('aria-busy', 'true')
    // And neither field can be edited underneath it.
    await expect(loginPage.identifier).not.toBeEditable()
    await expect(loginPage.password).not.toBeEditable()

    // The single request settles; the count is the assertion.
    await expect.poll(() => signInStub.count()).toBe(1)
    expect(traffic.signIn(), 'five activations must produce exactly one request').toHaveLength(1)
  })

  test('TC-13652-016 Verify that the submit lock is released after a failed request @layer:ui @ac:AC-5 @intent:regression', async ({
    env,
    loginPage,
    signInStub,
    traffic,
  }) => {
    // Refused after a short delay, so the lock is genuinely taken first.
    await signInStub.fail('connectionrefused', env.timeouts.abortDelayMs)

    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    traffic.clear()
    signInStub.reset()

    await submitSignIn(loginPage)

    await expect(loginPage.formMessage).toHaveText(MESSAGES.unavailable)

    // The lock is released: the action is usable again.
    await expect(loginPage.submit).toBeEnabled()
    await expect(loginPage.submit).not.toHaveAttribute('aria-busy', 'true')

    // A second activation reaches the edge, making two attempts in total.
    await loginPage.password.fill(env.accounts.standard.password)
    await submitSignIn(loginPage)
    await expect.poll(() => traffic.signIn().length).toBe(2)
  })

  test('TC-13652-017 Verify that the Sign in action announces its processing state during a request @layer:ui @ac:AC-4 @intent:regression', async ({
    env,
    loginPage,
    signInStub,
  }) => {
    await signInStub.succeedSlowly(env.timeouts.slowResponseMs, { role: 'user' })

    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)

    // While the request is pending the control is both busy and unavailable.
    await expect(loginPage.submit).toHaveAttribute('aria-busy', 'true')
    await expect(loginPage.submit).toBeDisabled()
    await expect(loginPage.submit).toHaveText(LOGIN_COPY.submitProcessing)

    // Once the attempt settles, both states are removed. The success navigates
    // away, so the assertion is that the busy control does not survive.
    await expect(loginPage.submit).toHaveCount(0)
  })
})
