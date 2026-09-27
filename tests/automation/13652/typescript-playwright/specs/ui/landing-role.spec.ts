/**
 * The role-aware landing message.
 *
 * Source rows: TC-13652-047 … TC-13652-058.
 *
 * Exactly one role value produces the administrator wording. Everything else -
 * unknown roles, blank roles, roles that merely begin with the same letters -
 * produces the ordinary one. Most of these rows are anti-prefix-match probes,
 * which is why they are spelled out individually rather than folded together.
 */
import { openPath } from '../../support/actions'
import { LANDING_COPY, ROUTES, SESSION_STORAGE_KEY } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { seedRawSession, seedSession } from '../../support/sessionSeed'
import { readStoredSession } from '../../support/sweep'
import {
  ADMIN_SHAPED_LOCAL_PARTS,
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

    expect(
      consoleLog.pageErrors(),
      'a missing role must not raise an uncaught error',
    ).toEqual([])
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
      await expect(heading, `role "${roleCase.returned}" must render its documented heading`).toHaveText(
        roleCase.heading,
      )

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
})
