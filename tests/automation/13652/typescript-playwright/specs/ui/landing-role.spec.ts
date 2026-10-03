/**
 * The role-aware landing message.
 *
 * Source rows: TC-13652-047 … TC-13652-058, TC-13652-114, TC-13652-131.
 *
 * Exactly one role value produces the administrator wording. Everything else -
 * unknown roles, blank roles, roles that merely begin with the same letters -
 * produces the ordinary one. Most of these rows are anti-prefix-match probes,
 * which is why they are spelled out individually rather than folded together.
 */
import {
  goBack,
  goForward,
  hardReload,
  navigateInApp,
  openPath,
  signIn,
} from '../../support/actions'
import { LANDING_COPY, ROUTES, SESSION_STORAGE_KEY } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { seedRawSession, seedSession } from '../../support/sessionSeed'
import { readStoredSession } from '../../support/sweep'
import {
  ADMIN_SHAPED_LOCAL_PARTS,
  PLANTED_ADMIN_VALUE,
  PLANTED_SESSION_KEY,
  ROLE_AGREEMENT_CASES,
  WHITESPACE_ROLES,
} from '../../support/testData'
import { epochSeconds, mintAccessToken } from '../../support/jwt'

test.describe('Role-aware landing @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-047 Verify that the role admin renders the administrator welcome message @layer:ui @ac:AC-17 @intent:smoke', async ({
    page,
    welcomePage,
  }) => {
    await seedSession(page, { role: 'admin' })
    await openPath(page, ROUTES.welcome)

    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)
    await expect(welcomePage.supportingLine).toHaveText(LANDING_COPY.supporting)
    // The indicator and the heading tell the same story.
    await expect(welcomePage.roleIndicator).toContainText(/admin/i)
  })

  test('TC-13652-048 Verify that the role Admin in mixed case renders the administrator welcome message @layer:ui @ac:AC-17 @intent:regression', async ({
    page,
    welcomePage,
  }) => {
    await seedSession(page, { role: 'Admin' })
    await openPath(page, ROUTES.welcome)

    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)

    const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(stored?.['role'], 'the stored role is lower-cased, not re-cased on render').toBe('admin')
  })

  test('TC-13652-049 Verify that the role ADMIN in upper case renders the administrator welcome message @layer:ui @ac:AC-17 @intent:regression', async ({
    page,
    welcomePage,
  }) => {
    await seedSession(page, { role: 'ADMIN' })
    await openPath(page, ROUTES.welcome)

    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)
    const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(stored?.['role']).toBe('admin')
  })

  test('TC-13652-050 Verify that the role user renders the ordinary welcome message @layer:ui @ac:AC-18 @intent:smoke', async ({
    page,
    welcomePage,
  }) => {
    await seedSession(page, { role: 'user' })
    await openPath(page, ROUTES.welcome)

    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await expect(welcomePage.adminHeading).toHaveCount(0)

    // "Absent" means absent from the markup entirely - not merely hidden, and
    // not tucked into an attribute.
    const markup = await page.content()
    expect(markup, 'administrator wording must not exist anywhere in the document').not.toContain(
      LANDING_COPY.adminHeading,
    )
  })

  test('TC-13652-051 Verify that an empty role renders the ordinary welcome message @layer:ui @ac:AC-18 @intent:regression', async ({
    page,
    welcomePage,
  }) => {
    await seedSession(page, { role: '' })
    await openPath(page, ROUTES.welcome)

    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await expect(welcomePage.adminHeading).toHaveCount(0)
  })

  test('TC-13652-052 Verify that a whitespace-only role renders the ordinary welcome message @layer:ui @ac:AC-18 @intent:regression', async ({
    page,
    welcomePage,
    logger,
  }) => {
    for (const variant of WHITESPACE_ROLES) {
      logger.debug('seeding a whitespace-only role', { variant: variant.label })
      await page.context().clearCookies()
      await seedSession(page, { role: variant.value })
      await openPath(page, ROUTES.welcome)

      await expect(
        welcomePage.standardHeading,
        `a role of ${variant.label} must render the ordinary welcome`,
      ).toHaveText(LANDING_COPY.standardHeading)
      await expect(welcomePage.adminHeading).toHaveCount(0)
    }
  })

  test('TC-13652-053 Verify that an absent role renders the ordinary welcome message without error @layer:ui @ac:AC-18 @intent:regression', async ({
    page,
    welcomePage,
    consoleLog,
  }) => {
    const expiresAt = epochSeconds(3600)

    // Case 1: the role key is not in the stored object at all.
    await seedRawSession(
      page,
      JSON.stringify({ accessToken: mintAccessToken({ expSeconds: expiresAt }), expiresAt }),
    )
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)

    // Case 2: the role key is present but null.
    await seedRawSession(
      page,
      JSON.stringify({
        accessToken: mintAccessToken({ expSeconds: expiresAt }),
        role: null,
        expiresAt,
      }),
    )
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)

    expect(consoleLog.pageErrors(), 'a missing role must not raise an uncaught error').toEqual([])
  })

  test('TC-13652-054 Verify that the role administrator does not render the administrator welcome message @layer:ui @ac:AC-18 @intent:regression', async ({
    page,
    welcomePage,
  }) => {
    // The anti-prefix-match probe: "administrator" starts with "admin".
    await seedSession(page, { role: 'administrator' })
    await openPath(page, ROUTES.welcome)

    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await expect(welcomePage.adminHeading).toHaveCount(0)

    const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(stored?.['role'], 'the unrecognised role is stored verbatim, not replaced').toBe(
      'administrator',
    )
  })

  test('TC-13652-055 Verify that the role superuser does not render the administrator welcome message @layer:ui @ac:AC-18 @intent:regression', async ({
    page,
    welcomePage,
  }) => {
    await seedSession(page, { role: 'superuser' })
    await openPath(page, ROUTES.welcome)

    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await expect(welcomePage.adminHeading).toHaveCount(0)

    const stored = await readStoredSession(page, SESSION_STORAGE_KEY)
    expect(stored?.['role']).toBe('superuser')
  })

  test('TC-13652-056 Verify that the heading and the role indicator always agree across every role value @layer:ui @ac:AC-17 @intent:regression', async ({
    page,
    welcomePage,
  }) => {
    // Nine values; the heading and the indicator must never disagree.
    const adminCount = ROLE_AGREEMENT_CASES.filter((entry) => entry.isAdmin).length
    expect(adminCount, 'three of the nine values are the recognised administrator').toBe(3)
    expect(ROLE_AGREEMENT_CASES.length - adminCount, 'the other six are ordinary').toBe(6)

    for (const roleCase of ROLE_AGREEMENT_CASES) {
      await seedSession(page, { role: roleCase.returned })
      await openPath(page, ROUTES.welcome)

      const heading = welcomePage.heading
      await expect(
        heading,
        `role "${roleCase.returned}" must render its documented heading`,
      ).toHaveText(roleCase.heading)

      const indicator = (await welcomePage.roleIndicator.textContent()) ?? ''
      const indicatorSaysAdmin = /\badmin\b/i.test(indicator)
      expect(
        indicatorSaysAdmin,
        `the indicator ("${indicator.trim()}") must agree with the heading for role "${roleCase.returned}"`,
      ).toBe(roleCase.isAdmin)
    }
  })

  test('TC-13652-057 Verify that the role indicator conveys role as text, not colour or icon alone @layer:a11y @ac:AC-18 @intent:regression', async ({
    page,
    welcomePage,
  }) => {
    await seedSession(page, { role: 'admin' })
    await openPath(page, ROUTES.welcome)

    // The indicator states the role in words, in its accessible name.
    const accessibleName = await welcomePage.roleIndicator.getAttribute('aria-label')
    const visibleText = (await welcomePage.roleIndicator.textContent()) ?? ''
    expect(
      `${accessibleName ?? ''} ${visibleText}`,
      'the role must be stated in words, not implied by styling',
    ).toMatch(/\badmin/i)

    // The decorative glyph beside it is hidden from assistive technology.
    if ((await welcomePage.roleGlyph.count()) > 0) {
      await expect(welcomePage.roleGlyph).toHaveAttribute('aria-hidden', 'true')
    }

    // With colour removed the indicator still reads the same.
    await page.emulateMedia({ forcedColors: 'active' })
    await expect(welcomePage.roleIndicator).toBeVisible()
    const monochromeText = (await welcomePage.roleIndicator.textContent()) ?? ''
    expect(monochromeText.trim(), 'removing colour must not remove meaning').toBe(
      visibleText.trim(),
    )
    await page.emulateMedia({ forcedColors: 'none' })
  })

  test('TC-13652-058 Verify that an address beginning with admin does not produce the administrator welcome message @layer:ui @ac:AC-19 @intent:regression', async ({
    env,
    page,
    welcomePage,
  }) => {
    const domain = env.accounts.adminShapedEmail.split('@')[1] ?? ''

    for (const localPart of ADMIN_SHAPED_LOCAL_PARTS) {
      // The identifier only looks administrative; the session role is ordinary.
      await seedSession(page, { role: 'user' })
      await openPath(page, ROUTES.welcome)

      await expect(
        welcomePage.standardHeading,
        `an identifier of ${localPart}@${domain} must not change the landing message`,
      ).toHaveText(LANDING_COPY.standardHeading)
      await expect(welcomePage.adminHeading).toHaveCount(0)
    }

    // Nor does asking for it in the address bar.
    await seedSession(page, { role: 'user' })
    await openPath(page, ROUTES.welcomeWithRoleParam)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await expect(welcomePage.adminHeading).toHaveCount(0)
  })

  test('TC-13652-114 Verify that the welcome message follows the session role and ignores planted values @layer:ui @ac:AC-18 @ac:AC-19 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    /** Asserts the ordinary presentation, whatever was planted. */
    const assertOrdinaryPresentation = async (state: string): Promise<void> => {
      await expect(
        welcomePage.standardHeading,
        `${state}: the heading must stay the plain welcome`,
      ).toHaveText(LANDING_COPY.standardHeading)
      await expect(welcomePage.adminHeading, `${state}: no administrator heading`).toHaveCount(0)

      // Stronger than "the admin heading is absent": the phrase must not be
      // anywhere in the rendered page, in any element.
      const rendered = await page.locator('body').innerText()
      expect(rendered, `${state}: "${LANDING_COPY.adminEmphasis}" must not appear`).not.toContain(
        LANDING_COPY.adminEmphasis,
      )

      // Expected result 5: the indicator and the heading never disagree.
      await expect(
        welcomePage.roleIndicator,
        `${state}: the role indicator must agree with the heading`,
      ).toHaveText(LANDING_COPY.chipStandard)
    }

    // Step 1: an administrator-shaped identifier, an ordinary role.
    await signInStub.succeed({ role: 'user' })
    await openPath(page, ROUTES.login)
    await signIn(loginPage, {
      identifier: env.accounts.adminShapedEmail,
      password: env.accounts.standard.password,
    })
    await assertOrdinaryPresentation('an administrator-shaped identifier')

    // Step 2: a second storage key holding the administrator role value.
    await page.evaluate(
      ([key, value]: [string, string]) => {
        window.sessionStorage.setItem(key, value)
        window.localStorage.setItem(key, value)
      },
      [PLANTED_SESSION_KEY, PLANTED_ADMIN_VALUE] as [string, string],
    )
    await openPath(page, ROUTES.welcome)
    await assertOrdinaryPresentation('a planted second storage key')

    // Step 3: the address bar parameter.
    await openPath(page, ROUTES.welcomeWithRoleParam)
    await assertOrdinaryPresentation('a planted address-bar parameter')

    // Step 4: all three at once - the planted keys survived the reloads, the
    // identifier is still the administrator-shaped one, and the parameter is
    // back on the address.
    const planted = await page.evaluate(
      (key: string) => window.sessionStorage.getItem(key),
      PLANTED_SESSION_KEY,
    )
    expect(planted, 'the planted key must still be present for the combined state').toBe(
      PLANTED_ADMIN_VALUE,
    )
    await openPath(page, ROUTES.welcomeWithRoleParam)
    await assertOrdinaryPresentation('all three planted values together')

    // And the session the platform issued is untouched by any of it.
    expect(
      (await readStoredSession(page, SESSION_STORAGE_KEY))?.role,
      'the session role is the only source, and it did not change',
    ).toBe('user')
  })

  test('TC-13652-131 Verify that the stored role is unchanged by every landing screen interaction @layer:ui @ac:AC-17 @ac:AC-18 @ac:AC-19 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
    logger,
  }) => {
    const welcomeUrl = `${env.webBaseUrl}${ROUTES.welcome}`

    /** The stored record verbatim, for a character-for-character comparison. */
    const storedRecord = async (): Promise<string | null> =>
      page.evaluate((key: string) => window.sessionStorage.getItem(key), SESSION_STORAGE_KEY)

    /** Every reading also re-asserts the heading and the absence of the other. */
    const readAndAssert = async (state: string): Promise<string | null> => {
      await expect(page, `${state}: the landing screen is on show`).toHaveURL(welcomeUrl)
      await expect(welcomePage.standardHeading, `${state}: the heading`).toHaveText(
        LANDING_COPY.standardHeading,
      )
      await expect(welcomePage.adminHeading, `${state}: no administrator heading`).toHaveCount(0)
      return storedRecord()
    }

    // The history is built before signing in so Back and Forward have somewhere
    // to go that is still inside the application: sign-in replaces its own
    // entry rather than pushing one, so a single entry would send Back out of
    // the client altogether.
    await openPath(page, ROUTES.root)
    await expect(loginPage.heading).toBeVisible()
    await navigateInApp(page, ROUTES.login)

    // Step 1.
    await signInStub.succeed({ role: 'user' })
    await signIn(loginPage, {
      identifier: env.accounts.other.email,
      password: env.accounts.other.password,
    })
    const afterSignIn = await readAndAssert('after signing in')
    expect(
      (await readStoredSession(page, SESSION_STORAGE_KEY))?.role,
      'the platform issued the ordinary role',
    ).toBe('user')

    // Step 2: a full reload.
    await hardReload(page)
    const afterReload = await readAndAssert('after reloading')

    // Step 3: back, then forward. The root entry resolves to the landing
    // screen now that the session is live, so both ends stay in the app.
    await goBack(page)
    await expect(page).toHaveURL(welcomeUrl)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await goForward(page)
    const afterHistory = await readAndAssert('after navigating back and forward')

    // Step 4: the root address.
    await openPath(page, ROUTES.root)
    const afterRoot = await readAndAssert('after opening the root address')

    // Step 5: all four readings, character for character.
    const readings = [afterSignIn, afterReload, afterHistory, afterRoot]
    logger.info('stored session readings', { distinct: new Set(readings).size })
    expect(afterSignIn, 'a session must have been stored to compare').not.toBeNull()
    for (const [index, reading] of readings.entries()) {
      expect(reading, `reading ${index + 1} must match the record written at sign-in`).toBe(
        afterSignIn,
      )
    }
    await expect(
      welcomePage.adminHeading,
      'the administrator heading was never rendered',
    ).toHaveCount(0)
  })
})
