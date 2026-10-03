/**
 * The role-aware landing screen.
 *
 * The heading is the whole decision: `Welcome to Admin Area` for the one
 * recognised administrator role, `Welcome` for everything else. Both are
 * exposed separately so a spec can assert the presence of one and the absence
 * of the other, which several rows require.
 */
import type { Locator, Page } from '@playwright/test'

import { LANDING_COPY, ROUTES } from '../support/expectedCopy'
import { BasePage } from './BasePage'

export class WelcomePage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get path(): string {
    return ROUTES.welcome
  }

  get adminHeading(): Locator {
    return this.page.getByRole('heading', { name: LANDING_COPY.adminHeading, exact: true })
  }

  get standardHeading(): Locator {
    return this.page.getByRole('heading', { name: LANDING_COPY.standardHeading, exact: true })
  }

  /** Whichever welcome heading the screen chose to render. */
  get heading(): Locator {
    return this.page.getByRole('heading', {
      name: new RegExp(`^(?:${LANDING_COPY.adminHeading}|${LANDING_COPY.standardHeading})$`),
    })
  }

  get supportingLine(): Locator {
    return this.page.getByText(LANDING_COPY.supporting, { exact: true })
  }

  get logout(): Locator {
    return this.page.getByRole('button', { name: LANDING_COPY.logout, exact: true })
  }

  /**
   * The paragraph immediately following the heading in document order.
   * TC-120 asserts the confirmation line is *directly beneath* the heading,
   * which an unanchored text query cannot express.
   */
  get lineBeneathHeading(): Locator {
    return this.card.locator('[data-testid="welcome-heading"] + p')
  }

  /** The guidance line beneath the divider (TC-121). */
  get closingLine(): Locator {
    return this.page.getByText(LANDING_COPY.closing, { exact: true })
  }

  /** The element stating the signed-in role in words (TC-047, TC-057, TC-114). */
  get roleIndicator(): Locator {
    return this.page.getByTestId('role-chip')
  }

  /**
   * The decorative glyph inside the role chip; must be hidden from AT.
   * `src/components/icons.tsx` gives it no test id of its own, so it is
   * reached through the chip that owns it.
   */
  get roleGlyph(): Locator {
    return this.roleIndicator.locator('svg')
  }

  /** The white band across the top of the landing screen (TC-122). */
  get topBar(): Locator {
    return this.page.getByTestId('landing-top-bar')
  }

  /**
   * The brand mark in the top bar, which is decorative and carries no
   * accessible name.
   *
   * ⚠️ Scoped to the top bar deliberately. `PaccoLockup` renders twice on this
   * screen - once in the band and once at the head of the card - so an
   * unscoped `pacco-lockup` query would resolve to two elements and TC-071's
   * "exactly one brand mark in the chrome" assertion would be meaningless.
   */
  get brandMark(): Locator {
    return this.topBar.getByTestId('pacco-lockup')
  }

  /** The brand mark stacked above the heading inside the card. */
  get cardBrandMark(): Locator {
    return this.card.getByTestId('pacco-lockup')
  }

  /** The card the landing content sits in, for the width rows. */
  get card(): Locator {
    return this.page.getByTestId('welcome-card')
  }

  /** The decorative rule between the confirmation line and the guidance line. */
  get divider(): Locator {
    return this.page.getByTestId('welcome-divider')
  }

  /** The three content regions TC-071 permits, and nothing else. */
  get contentRegions(): readonly Locator[] {
    return [this.heading, this.brandMark, this.roleIndicator]
  }
}
