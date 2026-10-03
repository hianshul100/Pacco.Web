/**
 * Every rendered string on the landing screen, transcribed from the supplied
 * reference image `03_welcome-page-ux.png`.
 *
 * 🚫 Spec and process vocabulary -- `DO2`, `FR-17`, `wave-2`, `AC-21`, `NEG-9`
 * and the like -- must never appear in rendered UI. Those identifiers exist for
 * traceability in comments and commit messages only.
 *
 * 🚫 `closing` is static copy. LOW_LEVEL_SPEC-13652-wave-2.md §L.12.1: it is
 * "not a promise of navigation" -- no navigation surface is built in this wave,
 * and the line must not be turned into a link or a button.
 */
export const WELCOME_COPY = {
  /** Admin heading, split so the emphasis phrase can carry the brand colour. */
  headingAdminLead: 'Welcome to ',
  headingAdminEmphasis: 'Admin Area',
  /** Non-admin heading. The emphasis span is ABSENT, not empty. */
  headingStandard: 'Welcome',
  supporting: 'You are signed in successfully.',
  chipAdmin: 'Admin',
  chipStandard: 'User',
  closing: 'Use the navigation to continue.',
  logout: 'Logout',
  documentTitle: 'Welcome · Pacco',
  documentDescription: 'Your Pacco account landing page.',
} as const
