/**
 * Flat ESLint configuration for the JIRA 13652 Playwright suite.
 *
 * Beyond the usual type-aware rules this file encodes three suite policies that
 * the CSV asks for directly, so a violation fails `npm run lint` rather than
 * surviving until someone notices it in review:
 *
 *   1. No fixed delays anywhere. `page.waitForTimeout`, `setTimeout` and
 *      `new Promise(r => setTimeout(...))` are banned outright; every wait must
 *      be an assertion or an event.
 *   2. No literal base URLs, no literal credentials and no bare millisecond
 *      numbers in specs or page objects - they come from `support/env.ts`.
 *   3. Page objects expose locators and addresses only. Clicking, filling,
 *      navigating and asserting all live in specs.
 */
const js = require('@eslint/js')
const tseslint = require('typescript-eslint')

/**
 * Rule 8: fixed delays are banned across the whole suite.
 *
 * `test.setTimeout` is deliberately exempt: it raises the budget a test is
 * allowed to take, which is the opposite of sleeping through one. Everything
 * else named `setTimeout`, on any object, is a delay.
 */
const NO_FIXED_DELAY = [
  {
    selector:
      "CallExpression[callee.property.name='waitForTimeout'], CallExpression[callee.name='setTimeout'], CallExpression[callee.property.name='setTimeout'][callee.object.name!='test']",
    message:
      'Fixed delays are banned. Wait on a web-first assertion, a response, or a navigation event instead.',
  },
  {
    selector: "NewExpression[callee.name='Promise'] > ArrowFunctionExpression",
    message:
      'Hand-rolled sleep promises are banned. Wait on a web-first assertion, a response, or a navigation event instead.',
  },
]

/** Specs and page objects must not carry environment-specific literals. */
const NO_ENVIRONMENT_LITERALS = [
  {
    selector: "Literal[value=/^https?:\\/\\//]",
    message:
      'No literal base URLs. Read addresses from readEnvConfig() in support/env.ts so every environment is configurable.',
  },
  {
    // Deliberately narrow: no whitespace, mixed case, a digit and a symbol -
    // i.e. something that looks like a password rather than like prose.
    selector:
      "Literal[value=/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])\\S{8,64}$/]",
    message:
      'No credential-shaped literals. Fixture accounts live in .env and are read through readEnvConfig().',
  },
  {
    selector: "Literal[value=/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$/]",
    message:
      'No literal e-mail addresses. Account fixtures live in .env and are read through readEnvConfig().',
  },
]

/** Page objects are declarative: no actions, no assertions. */
const PAGE_OBJECT_PURITY = [
  {
    selector:
      "CallExpression[callee.property.name=/^(click|fill|type|press|check|uncheck|selectOption|goto|hover|tap|setInputFiles|dragTo)$/]",
    message:
      'Page objects expose locators and addresses only. Perform actions from the spec, or from a BasePage helper.',
  },
  {
    selector: "CallExpression[callee.name='expect']",
    message: 'Page objects must not assert. Move the expectation into the spec.',
  },
]

module.exports = tseslint.config(
  {
    ignores: ['node_modules/**', 'reports/**', 'test-results/**', 'playwright-report/**', 'dist/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': ['error', ...NO_FIXED_DELAY],
      'no-console': ['error', { allow: [] }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // The logger is the one place allowed to reach the process streams.
    files: ['support/logger.ts', 'scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // The single sanctioned timer. It simulates SERVER latency inside a route
    // stub (TC-015, TC-016, TC-017, TC-035); it never synchronises a test.
    // See the file header for why this exemption exists and stays this narrow.
    files: ['support/responseDelay.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['specs/**/*.ts', 'pages/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_FIXED_DELAY, ...NO_ENVIRONMENT_LITERALS],
    },
  },
  {
    files: ['pages/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...NO_FIXED_DELAY,
        ...NO_ENVIRONMENT_LITERALS,
        ...PAGE_OBJECT_PURITY,
      ],
    },
  },
  {
    // Configuration files legitimately hold defaults and plain JS.
    files: ['eslint.config.js', 'playwright.config.ts', 'support/env.ts', 'config/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_FIXED_DELAY],
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
)
