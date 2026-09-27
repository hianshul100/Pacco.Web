/**
 * The layout at every supported width.
 *
 * Source rows: TC-13652-091, 092, 093, 094.
 *
 * The CSV classifies all four as UI rows whose type of testing is Usability,
 * so they carry `@layer:ui` and run in the `ui` project alongside the other
 * screen rows - not in the accessibility project, which is reserved for the
 * rows the CSV marks as Accessibility.
 *
 * The four widths live in `support/testData.ts`, so adding a breakpoint is a
 * data change rather than a test change.
 */
import type { Locator, Page } from '@playwright/test'

import { readA11yConfig } from '../../config/a11y.config'
import { fillCredentials, openPath, submitSignIn } from '../../support/actions'
import { LANDING_COPY, LOGIN_COPY, ROUTES } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { seedSession } from '../../support/sessionSeed'
import { viewportById } from '../../support/testData'

/** No content may require sideways scrolling at any supported width. */
async function assertNoHorizontalScrolling(page: Page, label: string): Promise<void> {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflows, `${label} requires horizontal scrolling`).toBe(false)
}

/** Every control is on screen, inside the viewport, and large enough to hit. */
async function assertControlsUsable(
  page: Page,
  controls: Locator,
  label: string,
  minimumEdgePx: number,
): Promise<void> {
  const count = await controls.count()
  expect(count, `${label} shows no controls at all`).toBeGreaterThan(0)

  const viewport = page.viewportSize()
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index)
    await expect(control, `${label}: control ${index} is not visible`).toBeVisible()

    const box = await control.boundingBox()
    expect(box, `${label}: control ${index} has no box`).not.toBeNull()
    expect(
      (box?.x ?? 0) >= -1 && (box?.x ?? 0) + (box?.width ?? 0) <= (viewport?.width ?? 0) + 1,
      `${label}: control ${index} sits outside the viewport`,
    ).toBe(true)
    expect(
      box?.height ?? 0,
      `${label}: control ${index} is shorter than the minimum touch target`,
    ).toBeGreaterThanOrEqual(minimumEdgePx)
  }
}

test.describe('Responsive layout @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-091 Verify that the Login screen is usable at the narrowest supported width @layer:ui @ac:AC-1 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    const viewport = viewportById('narrowest')
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await signInStub.succeed({ role: 'user' })
    await openPath(page, ROUTES.login)

    // Everything the screen promises is still present and legible.
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
    await expect(loginPage.subheading).toHaveText(LOGIN_COPY.subheading)
    await expect(loginPage.identifier).toBeVisible()
    await expect(loginPage.password).toBeVisible()
    await expect(loginPage.submit).toHaveText(LOGIN_COPY.submit)

    await assertNoHorizontalScrolling(page, viewport.label)

    // No label is truncated away: the accessible name survives the squeeze.
    await expect(loginPage.identifier).toHaveAccessibleName(LOGIN_COPY.identifierLabel)
    await expect(loginPage.password).toHaveAccessibleName(LOGIN_COPY.passwordLabel)

    // And the form still works end to end at this width.
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()
    await assertNoHorizontalScrolling(page, `${viewport.label} (landing)`)
  })

  test('TC-13652-092 Verify that both screens are usable on a typical mobile viewport @layer:ui @ac:AC-1 @ac:AC-26 @intent:regression', async ({
    page,
    loginPage,
    welcomePage,
  }) => {
    const a11y = readA11yConfig()
    const viewport = viewportById('mobile')
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    await openPath(page, ROUTES.login)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
    await assertNoHorizontalScrolling(page, `${viewport.label} (Login)`)
    await assertControlsUsable(
      page,
      loginPage.interactiveElements,
      `${viewport.label} (Login)`,
      a11y.minimumTouchTargetPx,
    )

    await seedSession(page, { role: 'user' })
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await assertNoHorizontalScrolling(page, `${viewport.label} (landing)`)
    await assertControlsUsable(
      page,
      welcomePage.interactiveElements,
      `${viewport.label} (landing)`,
      a11y.minimumTouchTargetPx,
    )
  })

  test('TC-13652-093 Verify that both screens are usable at the tablet breakpoint @layer:ui @ac:AC-1 @ac:AC-26 @intent:regression', async ({
    page,
    loginPage,
    welcomePage,
  }) => {
    const a11y = readA11yConfig()
    const viewport = viewportById('tablet')
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    await openPath(page, ROUTES.login)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
    await expect(loginPage.form).toBeVisible()
    await assertNoHorizontalScrolling(page, `${viewport.label} (Login)`)

    // The card is centred rather than stretched across the whole width.
    const formBox = await loginPage.form.boundingBox()
    expect(formBox, 'the form must have a box at the tablet breakpoint').not.toBeNull()
    expect(
      formBox?.width ?? 0,
      'the form must not stretch to the full tablet width',
    ).toBeLessThanOrEqual(viewport.width)

    await assertControlsUsable(
      page,
      loginPage.interactiveElements,
      `${viewport.label} (Login)`,
      a11y.minimumTouchTargetPx,
    )

    await seedSession(page, { role: 'admin' })
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)
    await assertNoHorizontalScrolling(page, `${viewport.label} (landing)`)
    await expect(welcomePage.logout).toBeVisible()
  })

  test('TC-13652-094 Verify that both screens render correctly at the desktop width @layer:ui @ac:AC-1 @ac:AC-26 @intent:regression', async ({
    page,
    loginPage,
    welcomePage,
  }) => {
    const viewport = viewportById('desktop')
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    await openPath(page, ROUTES.login)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
    await expect(loginPage.subheading).toHaveText(LOGIN_COPY.subheading)
    await expect(loginPage.needHelp).toBeVisible()
    await assertNoHorizontalScrolling(page, `${viewport.label} (Login)`)

    // The card stays a card: centred, bounded, not edge to edge.
    const formBox = await loginPage.form.boundingBox()
    expect(formBox?.width ?? viewport.width, 'the form must stay bounded on a wide screen').toBeLessThan(
      viewport.width,
    )
    const leftGap = formBox?.x ?? 0
    const rightGap = viewport.width - ((formBox?.x ?? 0) + (formBox?.width ?? 0))
    expect(
      Math.abs(leftGap - rightGap),
      'the form must be centred horizontally',
    ).toBeLessThanOrEqual(2)

    // Nothing needs vertical scrolling to reach at this height either.
    const needsVerticalScroll = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    )
    expect(needsVerticalScroll, 'the Login screen must fit the desktop viewport').toBe(false)

    await seedSession(page, { role: 'user' })
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    await expect(welcomePage.supportingLine).toHaveText(LANDING_COPY.supporting)
    await expect(welcomePage.logout).toBeVisible()
    await assertNoHorizontalScrolling(page, `${viewport.label} (landing)`)
  })
})
