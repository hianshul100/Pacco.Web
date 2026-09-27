/**
 * Automated accessibility.
 *
 * Source rows: TC-13652-085, 086, 087, 088, 089, 090, 095.
 *
 * The scan configuration - WCAG level, tag list, failure policy, the pages to
 * visit - lives in `config/a11y.config.ts` and is driven by environment
 * variables, so none of it is written into these rows. No rule is muted: the
 * CSV asks for zero violations at the configured level, and `disabledRules` is
 * empty by design.
 *
 * An automated scan is not a substitute for a manual pass; TC-111 and TC-112
 * carry that, and they are recorded in `specs/manual/manual-review.spec.ts`.
 */
import type { TestInfo } from '@playwright/test'

import { readA11yConfig } from '../../config/a11y.config'
import { fillCredentials, openPath, submitSignIn, tabThrough } from '../../support/actions'
import { LOGIN_COPY, MESSAGES, ROUTES } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { seedSession } from '../../support/sessionSeed'

/** Attaches the full axe result so a violation explains itself in the report. */
async function attachScan(testInfo: TestInfo, name: string, results: unknown): Promise<void> {
  await testInfo.attach(`${name}-axe.json`, {
    body: Buffer.from(JSON.stringify(results, null, 2), 'utf8'),
    contentType: 'application/json',
  })
}

function describeViolations(
  violations: ReadonlyArray<{ id: string; impact?: string | null; help: string; nodes: unknown[] }>,
): string {
  return violations
    .map((violation) => `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} × ${violation.nodes.length}`)
    .join('\n')
}

test.describe('Accessibility @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-085 Verify that the Login screen has no automated accessibility violations @layer:a11y @ac:AC-1 @intent:regression', async ({
    page,
    loginPage,
    makeAxeBuilder,
    logger,
  }, testInfo) => {
    const a11y = readA11yConfig()
    await openPath(page, ROUTES.login)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)

    const results = await makeAxeBuilder().analyze()
    await attachScan(testInfo, 'login', results)
    logger.info('scanned the Login screen', {
      tags: a11y.wcagTags,
      violations: results.violations.length,
    })

    if (a11y.failOnViolations) {
      expect(
        results.violations,
        `the Login screen has accessibility violations at ${a11y.level.toUpperCase()}:\n${describeViolations(results.violations)}`,
      ).toEqual([])
    }

    // A scan that found nothing because it inspected nothing would pass
    // vacuously, so the scan must have had rules to run and nodes to run on.
    expect(results.passes.length, 'the scan inspected no elements').toBeGreaterThan(0)
  })

  test('TC-13652-086 Verify that the landing screen has no automated accessibility violations @layer:a11y @ac:AC-26 @intent:regression', async ({
    page,
    welcomePage,
    makeAxeBuilder,
  }, testInfo) => {
    const a11y = readA11yConfig()
    // Both landing variants: the administrator wording and the ordinary one.
    const variants = a11y.pages.filter((target) => target.seedRole !== null)
    expect(variants.length, 'both landing variants must be configured').toBe(2)

    for (const variant of variants) {
      await seedSession(page, { role: variant.seedRole ?? 'user' })
      await openPath(page, variant.path)
      await expect(welcomePage.heading).toBeVisible()

      const results = await makeAxeBuilder().analyze()
      await attachScan(testInfo, variant.id, results)

      if (a11y.failOnViolations) {
        expect(
          results.violations,
          `${variant.name} has accessibility violations:\n${describeViolations(results.violations)}`,
        ).toEqual([])
      }
      expect(results.passes.length, `${variant.name} inspected no elements`).toBeGreaterThan(0)
    }
  })

  test('TC-13652-087 Verify that the Login screen can be completed by keyboard in the documented order @layer:a11y @ac:AC-1 @ac:AC-3 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    await signInStub.succeed({ role: 'user' })
    await openPath(page, ROUTES.login)
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)

    // Tab from the top of the document: identifier, password, reveal, submit.
    await page.keyboard.press('Tab')
    await expect(loginPage.identifier, 'the first stop is the identifier').toBeFocused()

    const order = await tabThrough(page, 3)
    expect(order, 'three further stops follow the identifier').toHaveLength(3)
    await expect(loginPage.submit, 'the last stop is the submit control').toBeFocused()

    // Every stop is a real control - no keyboard trap, no focusable wrapper.
    await loginPage.identifier.focus()
    await page.keyboard.type(env.accounts.standard.email)
    await page.keyboard.press('Tab')
    await expect(loginPage.password).toBeFocused()
    await page.keyboard.type(env.accounts.standard.password)

    // The reveal control is operable by keyboard alone.
    await page.keyboard.press('Tab')
    await expect(loginPage.revealToggle).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(loginPage.password).toHaveAttribute('type', 'text')
    await page.keyboard.press('Enter')
    await expect(loginPage.password).toHaveAttribute('type', 'password')

    // And the whole form can be submitted without ever touching a pointer.
    await page.keyboard.press('Tab')
    await expect(loginPage.submit).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(welcomePage.heading).toBeVisible()
  })

  test('TC-13652-088 Verify that the landing screen is keyboard operable and focuses its heading on entry @layer:a11y @ac:AC-26 @ac:AC-22 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    await signInStub.succeed({ role: 'user' })
    await openPath(page, ROUTES.login)
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.standard.password,
    })
    await submitSignIn(loginPage)
    await expect(welcomePage.heading).toBeVisible()

    // Arriving on a new screen moves focus to its heading, so a screen-reader
    // user is told where they have landed rather than left at the document top.
    const focusedText = await page.evaluate(() => document.activeElement?.textContent ?? '')
    const headingText = (await welcomePage.heading.textContent()) ?? ''
    expect(
      focusedText.trim(),
      'focus must move to the landing heading on entry',
    ).toBe(headingText.trim())

    // The heading is programmatically focusable but not a tab stop of its own.
    await expect(welcomePage.heading).toHaveAttribute('tabindex', '-1')

    // The logout control is reachable and operable by keyboard alone.
    await page.keyboard.press('Tab')
    await expect(welcomePage.logout).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(loginPage.heading).toHaveText(LOGIN_COPY.heading)
  })

  test('TC-13652-089 Verify that error and status messages are announced to assistive technology @layer:a11y @ac:AC-3 @ac:AC-21 @intent:regression', async ({
    env,
    page,
    loginPage,
    signInStub,
  }) => {
    await openPath(page, ROUTES.login)

    // Field validation: the message is tied to its field and announced.
    await submitSignIn(loginPage)
    await expect(loginPage.identifierMessage).toHaveText(LOGIN_COPY.identifierRequired)
    await expect(loginPage.identifier).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await loginPage.identifier.getAttribute('aria-describedby')
    expect(describedBy ?? '', 'the field must point at its own message').not.toBe('')
    const messageId = await loginPage.identifierMessage.getAttribute('id')
    expect(describedBy ?? '').toContain(messageId ?? '')

    // Form-level failure: an assertive region, because it interrupts.
    await signInStub.rejectWith('invalid_credentials', 'Invalid credentials.')
    await fillCredentials(loginPage, {
      identifier: env.accounts.standard.email,
      password: env.accounts.wrongPassword,
    })
    await submitSignIn(loginPage)
    await expect(loginPage.formMessage).toHaveText(MESSAGES.credentials)
    await expect(loginPage.alertRegion).toHaveAttribute('role', 'alert')
    await expect(loginPage.alertRegion).toContainText(MESSAGES.credentials)

    // Progress is a polite status, because it must not interrupt typing.
    await signInStub.succeedSlowly(env.timeouts.slowResponseMs, { role: 'user' })
    await loginPage.password.fill(env.accounts.standard.password)
    await submitSignIn(loginPage)
    await expect(loginPage.statusRegion).toContainText(LOGIN_COPY.submitProcessing)
    await expect(loginPage.statusRegion).toHaveAttribute('aria-live', 'polite')

    // The live regions exist in the markup before they carry text, or the
    // first announcement is lost.
    const regions = await page.locator('[role="alert"], [role="status"], [aria-live]').count()
    expect(regions, 'the screen must declare its live regions').toBeGreaterThan(0)
  })

  test('TC-13652-090 Verify that text on both screens meets the minimum contrast ratio @layer:a11y @ac:AC-1 @ac:AC-26 @intent:regression', async ({
    page,
    loginPage,
    welcomePage,
    makeAxeBuilder,
    logger,
  }, testInfo) => {
    const a11y = readA11yConfig()
    logger.info('contrast thresholds', a11y.contrast)

    // Contrast is checked on its own so a failure names the colours rather
    // than being lost among other rule results.
    await openPath(page, ROUTES.login)
    await expect(loginPage.heading).toBeVisible()
    const loginResults = await makeAxeBuilder().withRules(['color-contrast']).analyze()
    await attachScan(testInfo, 'login-contrast', loginResults)
    expect(
      loginResults.violations,
      `the Login screen fails contrast:\n${describeViolations(loginResults.violations)}`,
    ).toEqual([])

    await seedSession(page, { role: 'admin' })
    await openPath(page, ROUTES.welcome)
    await expect(welcomePage.heading).toBeVisible()
    const landingResults = await makeAxeBuilder().withRules(['color-contrast']).analyze()
    await attachScan(testInfo, 'landing-contrast', landingResults)
    expect(
      landingResults.violations,
      `the landing screen fails contrast:\n${describeViolations(landingResults.violations)}`,
    ).toEqual([])

    // The thresholds the row names are the ones the rule enforces.
    expect(a11y.contrast.normalText).toBe(4.5)
    expect(a11y.contrast.largeText).toBe(3)
  })

  test('TC-13652-095 Verify that both screens remain usable at double magnification @layer:a11y @ac:AC-1 @ac:AC-26 @intent:regression', async ({
    page,
    loginPage,
    welcomePage,
    makeAxeBuilder,
  }, testInfo) => {
    const a11y = readA11yConfig()
    const viewport = page.viewportSize()
    expect(viewport, 'the project must define a viewport to magnify').not.toBeNull()

    // 200% magnification is modelled by halving the viewport: the same CSS
    // pixels, twice the apparent size, which is what a reflow rule measures.
    const magnified = {
      width: Math.round((viewport?.width ?? 0) / a11y.reflowZoomFactor),
      height: Math.round((viewport?.height ?? 0) / a11y.reflowZoomFactor),
    }
    await page.setViewportSize(magnified)

    for (const target of [
      { id: 'login', path: ROUTES.login, seedRole: null as 'user' | null },
      { id: 'welcome', path: ROUTES.welcome, seedRole: 'user' as 'user' | null },
    ]) {
      if (target.seedRole !== null) {
        await seedSession(page, { role: target.seedRole })
      }
      await openPath(page, target.path)

      const heading = target.id === 'login' ? loginPage.heading : welcomePage.heading
      await expect(heading).toBeVisible()

      // Content reflows into the narrower column: no two-dimensional scrolling.
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      expect(overflows, `${target.id} requires horizontal scrolling at double magnification`).toBe(
        false,
      )

      // Nothing is clipped away: every control is still on screen and usable.
      const controls = target.id === 'login' ? loginPage.interactiveElements : welcomePage.interactiveElements
      const count = await controls.count()
      expect(count, `${target.id} lost its controls at double magnification`).toBeGreaterThan(0)
      for (let index = 0; index < count; index += 1) {
        await expect(controls.nth(index)).toBeVisible()
      }

      const results = await makeAxeBuilder().analyze()
      await attachScan(testInfo, `${target.id}-magnified`, results)
      if (a11y.failOnViolations) {
        expect(
          results.violations,
          `${target.id} has violations at double magnification:\n${describeViolations(results.violations)}`,
        ).toEqual([])
      }
    }
  })
})
