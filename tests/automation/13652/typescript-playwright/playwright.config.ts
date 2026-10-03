/**
 * Playwright configuration for the JIRA 13652 suite
 * (Pacco Login and Role-Aware Landing).
 *
 * Projects are selected by the tag every test title carries, so a row's layer
 * decides where it runs:
 *
 *   static-analysis  @layer:static  - reads repository and bundle sources only
 *   api              @layer:api     - gateway contract, error mapping, CORS
 *   ui               @layer:ui      - browser behaviour against a stubbed edge
 *   a11y             @layer:a11y    - axe-core and responsive/zoom rows
 *   live-platform    @live          - needs the Docker Compose stack running
 *
 * `npm test` runs everything. `npm run test:offline` runs the four projects
 * that need no backend.
 */
import { defineConfig, devices } from '@playwright/test'
import { config as loadDotEnv } from 'dotenv'
import { resolve } from 'node:path'

import { readEnvConfig, validateEnvConfig } from './support/env'

// `.env` in the suite root, then the committed example as a last resort so a
// fresh checkout reports a useful failure rather than a stack of `undefined`s.
loadDotEnv({ path: resolve(__dirname, '.env') })
loadDotEnv({ path: resolve(__dirname, '.env.example') })

// Fails the whole run, loudly, before a browser starts.
validateEnvConfig()
const env = readEnvConfig()

const REPORT_DIR = resolve(__dirname, 'reports')

/** Chromium only: every row in the CSV describes one browser engine. */
const BROWSER = devices['Desktop Chrome']

/** The viewport the CSV names for the desktop rows (TC-001, TC-075, TC-076). */
const DESKTOP_VIEWPORT = { width: 1440, height: 900 }

export default defineConfig({
  testDir: resolve(__dirname, 'specs'),
  outputDir: resolve(REPORT_DIR, 'artifacts'),
  snapshotDir: resolve(__dirname, 'snapshots'),

  timeout: env.timeouts.testMs,
  expect: { timeout: env.timeouts.expectMs },

  fullyParallel: true,
  // A stray `test.only` must never silently shrink a CI run.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // `exactOptionalPropertyTypes` forbids passing the key across as `undefined`,
  // so off CI the key is simply absent and Playwright applies its own default.
  ...(process.env.CI === undefined ? {} : { workers: 2 }),

  reporter: [
    ['list'],
    ['html', { outputFolder: resolve(REPORT_DIR, 'html'), open: 'never' }],
    ['junit', { outputFile: resolve(REPORT_DIR, 'junit', 'results.xml') }],
    ['json', { outputFile: resolve(REPORT_DIR, 'json', 'results.json') }],
  ],

  use: {
    baseURL: env.webBaseUrl,
    ...BROWSER,
    viewport: DESKTOP_VIEWPORT,
    actionTimeout: env.timeouts.actionMs,
    navigationTimeout: env.timeouts.navigationMs,
    // TLS verification stays on. Only an explicit opt-in relaxes it.
    ignoreHTTPSErrors: env.ignoreHttpsErrors,
    // Failure evidence, kept off the happy path so reports stay small.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
  },

  projects: [
    {
      name: 'static-analysis',
      testMatch: /.*\.spec\.ts/,
      grep: /@layer:static/,
      grepInvert: /@live/,
    },
    {
      name: 'api',
      testMatch: /.*\.spec\.ts/,
      grep: /@layer:api/,
      grepInvert: /@live/,
    },
    {
      name: 'ui',
      testMatch: /.*\.spec\.ts/,
      grep: /@layer:ui/,
      grepInvert: /@live/,
    },
    {
      name: 'a11y',
      testMatch: /.*\.spec\.ts/,
      grep: /@layer:a11y/,
      grepInvert: /@live/,
    },
    {
      name: 'live-platform',
      testMatch: /.*\.spec\.ts/,
      grep: /@live/,
    },
  ],

  /**
   * Off by default: the standalone client is expected to be already running as
   * its own local process (ADR-021). Set PACCO_START_WEB_SERVER=true to let
   * Playwright start the Vite dev server itself. The client is never built into
   * or served by a backend image either way.
   */
  ...(env.startWebServer
    ? {
        webServer: {
          command: 'npm run dev',
          cwd: env.clientRepoDir,
          url: env.webBaseUrl,
          reuseExistingServer: true,
          timeout: env.timeouts.navigationMs * 4,
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
        },
      }
    : {}),
})
