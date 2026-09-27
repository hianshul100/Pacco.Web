/**
 * The Login screen as it first renders.
 *
 * Source rows: TC-13652-001 … TC-13652-010 of tests/cases/13652-testcases.csv.
 * One test method per row, in the CSV's order.
 */
import { openPath } from '../../support/actions'
import { LOGIN_COPY, ROUTES, USER_TYPE_PATTERN } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { describeHits, sweepForValue } from '../../support/sweep'

test.describe('Login screen @story:13652 @component:pacco-web-login', () => {
  test.beforeEach(async ({ page }) => {
    await openPath(page, ROUTES.login)
  })

  test('TC-13652-001 Verify that one common Login screen is presented with no user-type selector @layer:ui @ac:AC-1 @intent:smoke', async ({
    page,
    loginPage,
    logger,
  }) => {
    // Step 1-2: the common screen renders its form for everyone.
    await expect(loginPage.heading).toBeVisible()
    await expect(loginPage.identifier).toBeVisible()
    await expect(loginPage.password).toBeVisible()
    await expect(loginPage.submit).toBeVisible()

    // Step 3: nothing on the screen lets a user declare a user type or role.
    const declaringElements = page.locator(
      'select, [role="radiogroup"], [role="radio"], [role="tablist"], [role="tab"], input[type="radio"], input[type="checkbox"]',
    )
    await expect(declaringElements).toHaveCount(0)

    const visibleText = (await page.locator('body').innerText()).trim()
    expect(visibleText, 'no visible copy may offer a user type or role choice').not.toMatch(
      USER_TYPE_PATTERN,
    )

    // Step 4: an administrator-specific entry point must not exist. The client
    // is a single-page application, so "does not exist" means "renders the
    // same one common Login screen", not "returns a 404 document".
    for (const probe of [ROUTES.adminLogin, ROUTES.loginWithRoleParam]) {
      await openPath(page, probe)
      logger.debug('probed an administrator-specific entry point', { probe })
      await expect(loginPage.identifier).toBeVisible()
      await expect(loginPage.password).toBeVisible()
      const probedText = (await page.locator('body').innerText()).trim()
      expect(probedText, `${probe} must not present administrator-specific copy`).not.toMatch(
        USER_TYPE_PATTERN,
      )
    }
  })

  test('TC-13652-002 Verify that the Login screen renders its approved copy word for word @layer:ui @ac:AC-1 @intent:sanity', async ({
    page,
    loginPage,
  }) => {
    // Exact-match queries throughout: a heading reading "Sign in to Pacco"
    // would satisfy a substring check and must not satisfy this one.
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
    await expect(loginPage.subheading).toBeVisible()
    await expect(page.getByText(LOGIN_COPY.identifierLabel, { exact: true })).toBeVisible()
    await expect(loginPage.identifierHelp).toBeVisible()
    await expect(page.getByText(LOGIN_COPY.passwordLabel, { exact: true })).toBeVisible()
    await expect(loginPage.passwordHelp).toBeVisible()
    await expect(loginPage.submit).toHaveText(LOGIN_COPY.submit)
    await expect(loginPage.needHelp).toHaveText(LOGIN_COPY.needHelp)
  })

  test('TC-13652-003 Verify that the identifier field is labelled, described and accepts typed input @layer:ui @ac:AC-1 @intent:sanity', async ({
    env,
    loginPage,
  }) => {
    const sample = env.accounts.standard.email

    await expect(loginPage.identifier).toBeVisible()
    await expect(loginPage.identifier).toBeEnabled()
    // Reached by its label, which is what proves the association exists.
    await expect(loginPage.identifier).toHaveAccessibleName(LOGIN_COPY.identifierLabel)
    await expect(loginPage.identifier).toHaveAccessibleDescription(LOGIN_COPY.identifierHelp)

    await loginPage.identifier.fill(sample)
    // Verbatim: not trimmed, not lower-cased, not reformatted.
    await expect(loginPage.identifier).toHaveValue(sample)
  })

  test('TC-13652-004 Verify that the password field is labelled, described and accepts typed input @layer:ui @ac:AC-2 @intent:sanity', async ({
    env,
    loginPage,
  }) => {
    const sample = env.accounts.standard.password

    await expect(loginPage.password).toBeVisible()
    await expect(loginPage.password).toBeEnabled()
    await expect(loginPage.password).toHaveAccessibleName(LOGIN_COPY.passwordLabel)
    await expect(loginPage.password).toHaveAccessibleDescription(LOGIN_COPY.passwordHelp)

    await loginPage.password.fill(sample)
    await expect(loginPage.password).toHaveValue(sample)
    expect(sample.length, 'the CSV fixture is a 22-character passphrase').toBe(22)
  })

  test('TC-13652-005 Verify that the Sign in action renders with its exact label and is enabled @layer:ui @ac:AC-1 @intent:smoke', async ({
    loginPage,
  }) => {
    await expect(loginPage.submit).toBeVisible()
    await expect(loginPage.submit).toBeEnabled()
    await expect(loginPage.submit).toHaveText(LOGIN_COPY.submit)
    // Not busy before anything has been submitted.
    await expect(loginPage.submit).not.toHaveAttribute('aria-busy', 'true')
    // Exactly one submit control on the screen.
    await expect(loginPage.submitControls).toHaveCount(1)
  })

  test('TC-13652-006 Verify that the Need help link renders and navigates nowhere outside the Login screen @layer:ui @ac:AC-1 @intent:sanity', async ({
    page,
    loginPage,
  }) => {
    await expect(loginPage.needHelp).toHaveCount(1)
    await expect(loginPage.needHelp).toBeVisible()
    await expect(loginPage.needHelp).toHaveText(LOGIN_COPY.needHelp)

    const pagesBefore = page.context().pages().length
    await loginPage.needHelp.click()

    // The path is unchanged and no second tab was opened.
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}(?:[?#].*)?$`))
    expect(page.context().pages().length, 'activating the link must not open a new tab').toBe(
      pagesBefore,
    )
  })

  test('TC-13652-007 Verify that no field on the Login screen is pre-filled when the screen loads @layer:ui @ac:AC-7 @intent:regression', async ({
    page,
    loginPage,
  }) => {
    const assertEmpty = async (): Promise<void> => {
      await expect(loginPage.identifier).toHaveValue('')
      await expect(loginPage.password).toHaveValue('')

      const prefilled = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input'))
          .filter((input) => input.value !== '' || input.defaultValue !== '')
          .map((input) => input.id || input.name || input.type),
      )
      expect(prefilled, 'no input may carry a value or a defaultValue on first render').toEqual([])
    }

    await assertEmpty()
    await page.reload()
    await assertEmpty()
  })

  test('TC-13652-008 Verify that the Password field masks its characters by default @layer:ui @ac:AC-2 @intent:smoke', async ({
    env,
    loginPage,
  }) => {
    await expect(loginPage.password).toHaveAttribute('type', 'password')

    await loginPage.password.fill(env.accounts.standard.password)
    // Still masked after typing.
    await expect(loginPage.password).toHaveAttribute('type', 'password')

    // The reveal control is present, unpressed, and names what it will do.
    await expect(loginPage.revealToggle).toBeVisible()
    await expect(loginPage.revealToggle).toHaveAttribute('aria-pressed', 'false')
    await expect(loginPage.revealToggle).toHaveAccessibleName(LOGIN_COPY.showPassword)
  })

  test('TC-13652-009 Verify that the password reveal control shows and then re-masks the typed value @layer:ui @ac:AC-2 @intent:sanity', async ({
    env,
    loginPage,
  }) => {
    const secret = env.accounts.standard.password
    await loginPage.password.fill(secret)

    await expect(loginPage.password).toHaveAttribute('type', 'password')
    await expect(loginPage.revealToggle).toHaveAccessibleName(LOGIN_COPY.showPassword)
    await expect(loginPage.revealToggle).toHaveAttribute('aria-pressed', 'false')

    // Reveal.
    await loginPage.revealToggle.click()
    await expect(loginPage.password).toHaveAttribute('type', 'text')
    await expect(loginPage.revealToggle).toHaveAccessibleName(LOGIN_COPY.hidePassword)
    await expect(loginPage.revealToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(loginPage.password).toHaveValue(secret)

    // Re-mask.
    await loginPage.revealToggle.click()
    await expect(loginPage.password).toHaveAttribute('type', 'password')
    await expect(loginPage.revealToggle).toHaveAccessibleName(LOGIN_COPY.showPassword)
    await expect(loginPage.revealToggle).toHaveAttribute('aria-pressed', 'false')
    // The value itself survived both flips unchanged.
    await expect(loginPage.password).toHaveValue(secret)
  })

  test('TC-13652-010 Verify that the typed password appears in no DOM node other than its own input @layer:ui @ac:AC-2 @intent:regression', async ({
    page,
    loginPage,
    env,
    consoleLog,
    telemetry,
    traffic,
  }) => {
    const canary = env.canaries.password
    await loginPage.password.fill(canary)
    await expect(loginPage.password).toHaveValue(canary)

    // The field's own live value is the one permitted home for it, so the
    // input-value surface is excluded and every other surface is not.
    const hits = await sweepForValue(page, canary, {
      consoleLog,
      telemetry,
      traffic,
      skip: ['input-values'],
    })

    expect(
      hits,
      `the typed password surfaced outside its own field:\n${describeHits(hits)}`,
    ).toEqual([])
  })
})
