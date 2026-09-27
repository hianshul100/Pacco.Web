/**
 * Accessibility configuration.
 *
 * Nothing here is hard-coded into a spec: the WCAG level, the tag list, the
 * failure policy and the list of pages to scan are all externalised so a run
 * can be widened to AAA or narrowed to a single screen without touching test
 * code.
 */
import { readEnvConfig } from '../support/env'

export interface A11yPageTarget {
  /** Stable identifier used in report filenames and attachment names. */
  readonly id: string
  /** Human-readable name for the report. */
  readonly name: string
  /** Path relative to the client's own origin. */
  readonly path: string
  /**
   * Session role to seed before scanning, or `null` to scan anonymously.
   * `'admin'` and `'user'` cover the two landing variants of TC-086.
   */
  readonly seedRole: 'admin' | 'user' | null
}

export interface A11yConfig {
  readonly wcagTags: readonly string[]
  readonly level: 'a' | 'aa' | 'aaa'
  readonly failOnViolations: boolean
  readonly pages: readonly A11yPageTarget[]
  /**
   * Rules deliberately disabled, each with the reason. Empty by design: the
   * CSV demands zero violations at the configured level, so nothing is muted.
   */
  readonly disabledRules: ReadonlyArray<{ readonly id: string; readonly reason: string }>
  /** Minimum contrast ratios asserted directly in TC-090. */
  readonly contrast: { readonly normalText: number; readonly largeText: number }
  /** Minimum touch target edge in CSS pixels, asserted in TC-092. */
  readonly minimumTouchTargetPx: number
  /** Zoom level TC-095 reflows at, expressed as a scale factor. */
  readonly reflowZoomFactor: number
}

export function readA11yConfig(): A11yConfig {
  const env = readEnvConfig()

  return {
    wcagTags: env.a11y.tags,
    level: env.a11y.level,
    failOnViolations: env.a11y.failOnViolations,
    pages: [
      { id: 'login', name: 'Login', path: '/login', seedRole: null },
      { id: 'welcome-user', name: 'Landing (ordinary user)', path: '/welcome', seedRole: 'user' },
      { id: 'welcome-admin', name: 'Landing (administrator)', path: '/welcome', seedRole: 'admin' },
    ],
    disabledRules: [],
    contrast: { normalText: 4.5, largeText: 3 },
    minimumTouchTargetPx: 44,
    reflowZoomFactor: 2,
  }
}
