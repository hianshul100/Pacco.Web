/**
 * Login copy, fixed verbatim by SPECIFICATION.md §11.3 so no wave invents
 * wording.
 *
 * 🚫 Spec and process vocabulary -- `DO1`, `FR-3`, `wave-1`, `AC-15` and the
 * like -- must never appear in rendered UI. Nothing in this file is a
 * requirement identifier.
 */
export const LOGIN_COPY = {
  brandName: 'Pacco',
  heading: 'Sign in',
  subheading: 'Use your Pacco account to continue.',
  identifierLabel: 'Email or Username',
  identifierHelp: 'Enter your email address or username.',
  identifierPlaceholder: 'name@company.com',
  passwordLabel: 'Password',
  passwordHelp: 'Enter your password.',
  submit: 'Sign in',
  /**
   * The accessible name of the submit control while a request is in flight.
   * SPECIFICATION.md §11.2: the control's "accessible name changes to the
   * processing label".
   */
  submitProcessing: 'Signing in…',
  needHelp: 'Need help?',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  /** Required-field validation, shown per field. */
  identifierRequired: 'Enter your email address or username to continue.',
  passwordRequired: 'Enter your password to continue.',
} as const

/**
 * The surrounding page chrome, transcribed from the supplied reference image
 * `02_login-page-ux.png`. 🚫 No chrome is invented here that the reference does
 * not show.
 */
export const BRAND_COPY = {
  taglineLineOne: 'Smarter operations',
  taglineLineTwo: 'for a brighter tomorrow.',
  headlineLeading: 'Everything',
  headlineAccent: 'in flow.',
  headlineSupportOne: 'Manage. Ship. Track.',
  headlineSupportTwo: 'Grow with Pacco.',
  railItems: ['Goods', 'People', 'Possibilities'],
  nextLineOne: 'Built for',
  nextLineTwo: "what's next.",
  footerLead: 'A more connected business, one delivery at a time.',
  footerMarks: 'People • Products • Progress',
} as const
