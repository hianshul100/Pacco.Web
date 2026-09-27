/**
 * The Login screen.
 *
 * One screen for everyone: there is no user-type selector and no
 * administrator-specific variant (TC-001), so there is one page object.
 */
import type { Locator, Page } from '@playwright/test'

import { LOGIN_COPY, ROUTES } from '../support/expectedCopy'
import { BasePage } from './BasePage'

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get path(): string {
    return ROUTES.login
  }

  // --- Copy ---------------------------------------------------------------

  get heading(): Locator {
    return this.page.getByRole('heading', { name: LOGIN_COPY.heading, exact: true })
  }

  get subheading(): Locator {
    return this.page.getByText(LOGIN_COPY.subheading, { exact: true })
  }

  get identifierHelp(): Locator {
    return this.page.getByText(LOGIN_COPY.identifierHelp, { exact: true })
  }

  get passwordHelp(): Locator {
    return this.page.getByText(LOGIN_COPY.passwordHelp, { exact: true })
  }

  // --- Controls -----------------------------------------------------------

  get identifier(): Locator {
    return this.page.getByLabel(LOGIN_COPY.identifierLabel, { exact: true })
  }

  get password(): Locator {
    return this.page.getByLabel(LOGIN_COPY.passwordLabel, { exact: true })
  }

  /**
   * The reveal control. Its accessible name flips between "Show password" and
   * "Hide password" (TC-009), so it is matched on either.
   */
  get revealToggle(): Locator {
    return this.page.getByRole('button', {
      name: new RegExp(`^(?:${LOGIN_COPY.showPassword}|${LOGIN_COPY.hidePassword})$`),
    })
  }

  get submit(): Locator {
    return this.page.getByRole('button', { name: LOGIN_COPY.submit, exact: true })
  }

  /** Every submit control on the screen. TC-005 requires exactly one. */
  get submitControls(): Locator {
    return this.page.locator('button[type="submit"], input[type="submit"]')
  }

  get needHelp(): Locator {
    return this.page.getByRole('link', { name: LOGIN_COPY.needHelp, exact: true })
  }

  get form(): Locator {
    return this.page.locator('form')
  }

  // --- Messages -----------------------------------------------------------

  /** The single form-level message region. */
  get formMessage(): Locator {
    return this.page.getByTestId('form-message')
  }

  /** The session-expired notice, in a status region (TC-064, TC-089). */
  get sessionNotice(): Locator {
    return this.page.getByTestId('session-notice')
  }

  /** The identifier field's validation message, if the field has one. */
  get identifierMessage(): Locator {
    return this.page.getByText(LOGIN_COPY.identifierRequired, { exact: true })
  }

  get passwordMessage(): Locator {
    return this.page.getByText(LOGIN_COPY.passwordRequired, { exact: true })
  }

  /** Every field-level validation message currently rendered. */
  get fieldMessages(): Locator {
    return this.page.locator('[data-field-message], [id$="-message"]')
  }

  /**
   * The four controls TC-039 requires to be operable again after a failure, in
   * the tab order TC-087 specifies.
   */
  get keyboardOrder(): readonly Locator[] {
    return [this.identifier, this.password, this.revealToggle, this.submit, this.needHelp]
  }
}
