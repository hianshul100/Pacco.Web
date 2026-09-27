/**
 * Base for every page object in this suite.
 *
 * Page objects here are deliberately declarative: they expose locators and
 * addresses and nothing else. No page object clicks, fills, navigates or
 * asserts - `npm run lint` fails the build if one tries. Actions live in
 * `support/actions.ts`; expectations live in the specs, where a reader can see
 * the CSV row and the assertion side by side.
 *
 * Locators follow the priority the project's conventions set out:
 * role, then label, then text, then placeholder, with a CSS selector only
 * where the markup offers nothing better.
 */
import type { Locator, Page } from '@playwright/test'

import { readEnvConfig } from '../support/env'

export abstract class BasePage {
  protected constructor(public readonly page: Page) {}

  /** The client's own origin. Never a literal in a spec. */
  protected get origin(): string {
    return readEnvConfig().webBaseUrl
  }

  /** The path this screen occupies. */
  abstract get path(): string

  /** The absolute address of this screen. */
  get url(): string {
    return `${this.origin}${this.path}`
  }

  /** The live alert region. Always mounted; empty when there is no message. */
  get alertRegion(): Locator {
    return this.page.getByRole('alert')
  }

  /** The live status region, used for the session notice. */
  get statusRegion(): Locator {
    return this.page.getByRole('status')
  }

  /** Every heading on the screen, for the "exactly one top-level heading" rows. */
  get headings(): Locator {
    return this.page.getByRole('heading')
  }

  /** Every element a keyboard or pointer can operate. */
  get interactiveElements(): Locator {
    return this.page.locator(
      'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
    )
  }

  /** The element that currently holds focus. */
  get focused(): Locator {
    return this.page.locator(':focus')
  }
}
