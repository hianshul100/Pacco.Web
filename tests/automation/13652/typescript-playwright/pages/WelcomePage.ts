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

  /** The element stating the signed-in role in words (TC-047, TC-057). */
  get roleIndicator(): Locator {
    return this.page.getByTestId('role-indicator')
  }

  /** The decorative glyph beside the role indicator; must be hidden from AT. */
  get roleGlyph(): Locator {
    return this.page.getByTestId('role-glyph')
  }

  /** The brand mark, which is decorative and carries no accessible name. */
  get brandMark(): Locator {
    return this.page.getByTestId('brand-mark')
  }

  /** The card the landing content sits in, for the width rows. */
  get card(): Locator {
    return this.page.getByTestId('landing-card')
  }

  /** The three content regions TC-071 permits, and nothing else. */
  get contentRegions(): readonly Locator[] {
    return [this.heading, this.brandMark, this.roleIndicator]
  }
}
