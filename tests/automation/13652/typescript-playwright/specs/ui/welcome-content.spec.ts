/**
 * What the landing card and the landing top bar actually contain.
 *
 * These rows are about *inventory and order*, not about the role decision
 * (which `landing-role.spec.ts` owns): the same confirmation line under both
 * headings, one divider and one guidance line in the agreed sequence, and a
 * top bar holding a decorative mark and exactly one announced action.
 *
 * Source rows: TC-13652-120, 121, 122.
 */
import type { Locator } from '@playwright/test'

import { hardReload, logout, openPath, signIn } from '../../support/actions'
import { LANDING_COPY, ROUTES } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'
import { viewportById } from '../../support/testData'

/**
 * One direct child of the welcome card, reduced to the two things the row
 * cares about: whether it is a separator, and what it says.
 */
interface CardItem {
  readonly kind: 'text' | 'separator' | 'other'
  readonly text: string
}

/**
 * Reads the card's children in document order.
 *
 * `textContent` rather than an accessible name: TC-121 asks for the text
 * regions as they appear, and the decorative lockup and the divider must show
 * up in the sequence as themselves rather than being filtered out before the
 * order can be checked.
 */
async function readCardItems(card: Locator): Promise<readonly CardItem[]> {
  return card.evaluate<CardItem[]>((section) =>
    Array.from(section.children).map((element) => {
      const isSeparator = element.getAttribute('data-testid') === 'welcome-divider'
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (isSeparator) {
        return { kind: 'separator', text: '' }
      }
      return { kind: text === '' ? 'other' : 'text', text }
    }),
  )
}

test.describe('Landing content and chrome @story:13652 @component:pacco-web-welcome', () => {
  test('TC-13652-120 Verify that the landing screen shows its confirmation line beneath the welcome heading @layer:ui @ac:AC-26 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    await openPath(page, ROUTES.login)

    // --- The administrator account ----------------------------------------
    await signInStub.succeed({ role: 'admin' })
    await signIn(loginPage, {
      identifier: env.accounts.admin.email,
      password: env.accounts.admin.password,
    })

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.adminHeading).toHaveText(LANDING_COPY.adminHeading)
    // Not "the line is somewhere on the page": the paragraph that immediately
    // follows the heading in document order.
    await expect(welcomePage.lineBeneathHeading).toHaveText(LANDING_COPY.supporting)
    await expect(welcomePage.supportingLine).toHaveCount(1)

    // --- The ordinary account ---------------------------------------------
    await logout(welcomePage)
    await expect(loginPage.form).toBeVisible()

    await signInStub.succeed({ role: 'user' })
    await signIn(loginPage, {
      identifier: env.accounts.other.email,
      password: env.accounts.other.password,
    })

    await expect(page).toHaveURL(`${env.webBaseUrl}${ROUTES.welcome}`)
    await expect(welcomePage.standardHeading).toHaveText(LANDING_COPY.standardHeading)
    // The same sentence, word for word: the line does not change with the role.
    await expect(welcomePage.lineBeneathHeading).toHaveText(LANDING_COPY.supporting)

    // Step 5: once on the screen, not once per region that happens to match.
    await expect(welcomePage.supportingLine).toHaveCount(1)
    await expect(welcomePage.adminHeading).toHaveCount(0)
  })

  test('TC-13652-121 Verify that the landing card renders its guidance line and divider exactly once @layer:ui @ac:AC-26 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    await openPath(page, ROUTES.login)
    await signInStub.succeed({ role: 'user' })
    await signIn(loginPage, {
      identifier: env.accounts.other.email,
      password: env.accounts.other.password,
    })
    await expect(welcomePage.standardHeading).toBeVisible()

    const before = await readCardItems(welcomePage.card)

    const indexOfText = (value: string): number =>
      before.findIndex((item) => item.kind === 'text' && item.text === value)

    const headingIndex = indexOfText(LANDING_COPY.standardHeading)
    const confirmationIndex = indexOfText(LANDING_COPY.supporting)
    const guidanceIndex = indexOfText(LANDING_COPY.closing)

    const describeOrder = before.map((item) => `${item.kind}:${item.text}`).join(' | ')

    expect(headingIndex, `the heading must be in the card; read: ${describeOrder}`).toBeGreaterThan(
      -1,
    )
    expect(
      confirmationIndex,
      `the confirmation line must follow the heading; read: ${describeOrder}`,
    ).toBeGreaterThan(headingIndex)
    // ⚠️ The role chip sits between the confirmation line and the divider. The
    // row fixes the *relative* order of these three text regions, not that
    // they are adjacent, and TC-047 owns the chip itself - so this asserts the
    // sequence rather than an exhaustive list that would duplicate that row.
    expect(
      guidanceIndex,
      `the guidance line must follow the confirmation line; read: ${describeOrder}`,
    ).toBeGreaterThan(confirmationIndex)

    // Step 3: exactly one separator, and it sits between the two lines.
    const separatorIndices = before
      .map((item, index) => (item.kind === 'separator' ? index : -1))
      .filter((index) => index > -1)
    expect(separatorIndices, `exactly one separator; read: ${describeOrder}`).toHaveLength(1)
    expect(separatorIndices[0]).toBeGreaterThan(confirmationIndex)
    expect(separatorIndices[0]).toBeLessThan(guidanceIndex)
    await expect(welcomePage.divider).toHaveCount(1)

    // Step 4: on the whole screen, not only inside the card.
    await expect(welcomePage.closingLine).toHaveCount(1)

    // Step 5: the arrangement survives a reload of the document.
    await hardReload(page)
    await expect(welcomePage.standardHeading).toBeVisible()
    const after = await readCardItems(welcomePage.card)
    expect(after, 'the card must read identically after a reload').toEqual(before)
    await expect(welcomePage.closingLine).toHaveCount(1)
    await expect(welcomePage.divider).toHaveCount(1)
  })

  test('TC-13652-122 Verify that the top bar carries the brand mark and a control named Logout @layer:ui @ac:AC-26 @intent:regression', async ({
    env,
    page,
    loginPage,
    welcomePage,
    signInStub,
  }) => {
    await openPath(page, ROUTES.login)
    await signInStub.succeed({ role: 'admin' })
    await signIn(loginPage, {
      identifier: env.accounts.admin.email,
      password: env.accounts.admin.password,
    })
    await expect(welcomePage.adminHeading).toBeVisible()

    // --- Step 2: what the bar holds ---------------------------------------
    const items = await welcomePage.topBar.evaluate<string[]>((bar) => {
      // The band wraps its two items in a single layout row; the row's
      // children are the things the bar holds.
      const row = bar.children.length === 1 ? bar.firstElementChild : bar
      return Array.from(row?.children ?? []).map(
        (element) => element.getAttribute('data-testid') ?? element.tagName.toLowerCase(),
      )
    })
    expect(items, 'the top bar holds the brand mark and one action, and nothing else').toEqual([
      'pacco-lockup',
      'logout-button',
    ])

    // The mark is on the left and the action on the right.
    const markBox = await welcomePage.brandMark.boundingBox()
    const actionBox = await welcomePage.logout.boundingBox()
    expect(markBox, 'the brand mark must be laid out').not.toBeNull()
    expect(actionBox, 'the logout control must be laid out').not.toBeNull()
    expect((markBox?.x ?? 0) + (markBox?.width ?? 0)).toBeLessThanOrEqual(actionBox?.x ?? 0)

    // --- Step 3: how the action announces ---------------------------------
    await expect(welcomePage.logout).toHaveCount(1)
    await expect(welcomePage.logout).toHaveRole('button')
    // A string argument is matched in full, so this is already exact.
    await expect(welcomePage.logout).toHaveAccessibleName(LANDING_COPY.logout)
    await expect(welcomePage.logout).toBeEnabled()

    // --- Step 4: the mark is decoration -----------------------------------
    // Neither image is exposed as an image, and the mark contributes no text.
    await expect(welcomePage.brandMark.getByRole('img')).toHaveCount(0)
    const markImages = welcomePage.brandMark.locator('img')
    await expect(markImages).toHaveAttribute('alt', '')
    await expect(markImages).toHaveAttribute('aria-hidden', 'true')
    expect(
      (await welcomePage.brandMark.innerText()).trim(),
      'the brand mark must contribute no announced text',
    ).toBe('')
    // So the only thing the bar announces is the action.
    expect((await welcomePage.topBar.innerText()).trim()).toBe(LANDING_COPY.logout)

    // --- Step 5: the narrowest supported width ----------------------------
    const narrowest = viewportById('narrowest')
    await page.setViewportSize({ width: narrowest.width, height: narrowest.height })

    await expect(
      welcomePage.brandMark,
      `at ${narrowest.label} the mark stays visible`,
    ).toBeVisible()
    await expect(
      welcomePage.logout,
      `at ${narrowest.label} the action must not collapse into a menu`,
    ).toBeVisible()
    // Not merely present in the tree: still inside the viewport and operable.
    const narrowBox = await welcomePage.logout.boundingBox()
    expect(narrowBox, 'the logout control must still occupy space').not.toBeNull()
    expect((narrowBox?.x ?? 0) + (narrowBox?.width ?? 0)).toBeLessThanOrEqual(narrowest.width)
    await expect(welcomePage.logout).toBeEnabled()
    // And nothing was traded for it: the bar still holds exactly two things.
    await expect(welcomePage.brandMark).toHaveCount(1)
    await expect(welcomePage.logout).toHaveCount(1)
  })
})
