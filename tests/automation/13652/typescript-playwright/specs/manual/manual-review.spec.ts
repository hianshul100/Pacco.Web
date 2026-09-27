/**
 * The two rows that are not automatable.
 *
 * Source rows: TC-13652-111, 112.
 *
 * Every other row in the CSV is marked Automatable. These two are not, and the
 * CSV says why: one is a comparison against a reference design, the other a
 * screen-reader pass. Neither can be decided by a machine - a scan can say a
 * heading has an accessible name, it cannot say the screen reads coherently.
 *
 * They are declared here rather than omitted so the suite holds one method per
 * functional CSV row, 112 for 112. Both are `test.fixme`, so a run reports them
 * as "did not run" rather than as passes, and each carries the procedure a
 * person needs in its annotations. REVIEW.md lists them under Open Findings.
 */
import { openPath } from '../../support/actions'
import { ROUTES } from '../../support/expectedCopy'
import { expect, test } from '../../support/fixtures'

test.describe('Manual review @story:13652 @component:pacco-web-login', () => {
  test.fixme(
    'TC-13652-111 Verify that the rendered screens match the reference design by manual review @manual @layer:ui @ac:AC-1 @intent:regression',
    async ({ page, loginPage }, testInfo) => {
      testInfo.annotations.push({
        type: 'manual',
        description:
          'Not automatable. A reviewer opens the Login and landing screens at the four supported ' +
          'widths and compares spacing, type scale, colour and control placement against the ' +
          'reference design. An automated pixel diff would report every intended change as a ' +
          'defect and would still miss the judgements this row exists to make.',
      })

      // Unreachable while the row is fixme. Kept so that if the design system
      // ever gains reference artefacts, the row has somewhere to grow.
      await openPath(page, ROUTES.login)
      await expect(loginPage.heading).toBeVisible()
    },
  )

  test.fixme(
    'TC-13652-112 Verify that both screens are announced coherently in a manual screen-reader pass @manual @layer:a11y @ac:AC-1 @ac:AC-26 @ac:AC-3 @ac:AC-21 @intent:regression',
    async ({ page, loginPage }, testInfo) => {
      testInfo.annotations.push({
        type: 'manual',
        description:
          'Not automatable. A reviewer works through sign-in, a failed attempt and the landing ' +
          'screen with a real screen reader, confirming that headings, labels, help text, error ' +
          'and status announcements are read in a sensible order and make sense without sight of ' +
          'the screen. The automated scans in specs/a11y cover the mechanical half of this; ' +
          'coherence is a human judgement.',
      })

      await openPath(page, ROUTES.login)
      await expect(loginPage.heading).toBeVisible()
    },
  )
})
