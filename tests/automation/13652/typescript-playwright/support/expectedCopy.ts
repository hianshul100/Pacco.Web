/**
 * Every user-facing string this suite asserts, transcribed verbatim from the
 * "Test Data" and "Expected Result per Step" columns of
 * `tests/cases/13652-testcases.csv`.
 *
 * The CSV requires exact-match text queries, not substring matches (TC-002),
 * so these are compared with `toHaveText` / `getByText(..., { exact: true })`
 * rather than `toContainText`.
 *
 * 🚫 Nothing here is invented. A string that is not in the CSV is not asserted.
 */

export const LOGIN_COPY = {
  heading: 'Sign in',
  subheading: 'Use your Pacco account to continue.',
  identifierLabel: 'Email or Username',
  identifierHelp: 'Enter your email address or username.',
  passwordLabel: 'Password',
  passwordHelp: 'Enter your password.',
  submit: 'Sign in',
  submitProcessing: 'Signing in…',
  needHelp: 'Need help?',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  identifierRequired: 'Enter your email address or username to continue.',
  passwordRequired: 'Enter your password to continue.',
} as const

export const LANDING_COPY = {
  adminHeading: 'Welcome to Admin Area',
  standardHeading: 'Welcome',
  supporting: 'You are signed in successfully.',
  logout: 'Logout',
} as const

/**
 * The closed message registry. TC-030/031/036/037 require the generic message
 * for every outcome the client cannot interpret, and TC-064 requires the
 * session notice to be distinct from all three sign-in failure messages.
 */
export const MESSAGES = {
  credentials: 'The email or password you entered is incorrect.',
  unavailable: 'Sign-in is temporarily unavailable. Please try again.',
  generic: 'Something went wrong. Please try again.',
  sessionExpired: 'Your session has ended. Please sign in again to continue.',
} as const

/** The three sign-in failure messages, for TC-064's "distinct from" assertion. */
export const SIGN_IN_FAILURE_MESSAGES = [
  MESSAGES.credentials,
  MESSAGES.unavailable,
  MESSAGES.generic,
] as const

/** Client routes. Paths only - the origin always comes from `EnvConfig`. */
export const ROUTES = {
  root: '/',
  login: '/login',
  welcome: '/welcome',
  /** Probed in TC-001: an administrator-specific sign-in screen must not exist. */
  adminLogin: '/admin/login',
  loginWithRoleParam: '/login?role=admin',
  welcomeWithRoleParam: '/welcome?role=admin',
} as const

/** The single storage key the client uses. Swept for in every leak test. */
export const SESSION_STORAGE_KEY = 'pacco.session'

/**
 * Anything matching this on the Login screen would let a user declare a user
 * type, which TC-001 forbids.
 */
export const USER_TYPE_PATTERN = /admin|administrator|user type|role/i
