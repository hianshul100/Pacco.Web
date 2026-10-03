/**
 * The suite's extended `test`.
 *
 * Every spec imports `test` and `expect` from here rather than from
 * `@playwright/test`, which is what makes observability automatic: a
 * correlation id, a traffic recorder, a console recorder and a telemetry
 * collector are attached to every test whether it asks for them or not, and a
 * failing test attaches what they captured to the report without the spec
 * having to remember to.
 */
import AxeBuilder from '@axe-core/playwright'
import { test as base, expect } from '@playwright/test'

import { LoginPage } from '../pages/LoginPage'
import { WelcomePage } from '../pages/WelcomePage'
import { readA11yConfig } from '../config/a11y.config'
import { newCorrelationId, testCaseIdFrom } from './correlation'
import type { EnvConfig } from './env'
import { readEnvConfig } from './env'
import { createLogger, redact, type Logger } from './logger'
import {
  recordNavigation,
  recordTraffic,
  type NavigationRecorder,
  type TrafficRecorder,
} from './network'
import {
  installTelemetryCollector,
  recordConsole,
  type ConsoleRecorder,
  type TelemetryRecorder,
} from './observers'
import { stubSignIn, type SignInStub } from './stubs'

export interface SuiteFixtures {
  /** Resolved configuration. No spec reads `process.env` directly. */
  env: EnvConfig
  /** Structured logger carrying this test's correlation id. */
  logger: Logger
  /** Every request the browser issued during this test. */
  traffic: TrafficRecorder
  /** Every address the page occupied, in order. */
  navigation: NavigationRecorder
  /** Console messages and uncaught page errors. */
  consoleLog: ConsoleRecorder
  /** Telemetry the application handed to the installed collector. */
  telemetry: TelemetryRecorder
  /** The stubbed sign-in edge. Installed for every test; unused by @live rows. */
  signInStub: SignInStub
  loginPage: LoginPage
  welcomePage: WelcomePage
  /** A pre-configured axe builder honouring config/a11y.config.ts. */
  makeAxeBuilder: () => AxeBuilder
  /** Auto-use hook that attaches failure evidence. Specs never reference it. */
  evidence: undefined
}

export const test = base.extend<SuiteFixtures>({
  env: async ({}, use) => {
    await use(readEnvConfig())
  },

  logger: async ({}, use, testInfo) => {
    const testCaseId = testCaseIdFrom(testInfo.title)
    const logger = createLogger({
      correlationId: newCorrelationId(testCaseId),
      testId: testCaseId,
      base: { project: testInfo.project.name, file: testInfo.titlePath[0] ?? '' },
    })
    logger.info('test started', { title: testInfo.title })
    await use(logger)
    logger.info('test finished', { status: testInfo.status ?? 'unknown' })
  },

  traffic: async ({ context }, use) => {
    await use(recordTraffic(context))
  },

  navigation: async ({ page }, use) => {
    await use(recordNavigation(page))
  },

  consoleLog: async ({ page }, use) => {
    await use(recordConsole(page))
  },

  telemetry: async ({ page }, use) => {
    await use(await installTelemetryCollector(page))
  },

  signInStub: async ({ page }, use) => {
    const stub = await stubSignIn(page)
    await use(stub)
    await stub.dispose()
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },

  welcomePage: async ({ page }, use) => {
    await use(new WelcomePage(page))
  },

  makeAxeBuilder: async ({ page }, use) => {
    const a11y = readA11yConfig()
    await use(() => {
      const builder = new AxeBuilder({ page }).withTags([...a11y.wcagTags])
      const disabled = a11y.disabledRules.map((rule) => rule.id)
      return disabled.length === 0 ? builder : builder.disableRules(disabled)
    })
  },

  /**
   * Runs for every test whether or not the spec names it. On failure it
   * attaches the recorded evidence - redacted - so a CI report explains itself
   * without anyone re-running the test locally.
   */
  evidence: [
    async ({ traffic, navigation, consoleLog, telemetry, logger }, use, testInfo) => {
      await use(undefined)

      if (testInfo.status === testInfo.expectedStatus) {
        return
      }

      const attach = async (name: string, value: unknown): Promise<void> => {
        try {
          await testInfo.attach(name, {
            body: JSON.stringify(redact(value), null, 2),
            contentType: 'application/json',
          })
        } catch {
          // Evidence is best-effort: a closed page must not mask the real failure.
        }
      }

      logger.error('test failed; attaching evidence', {
        correlationId: logger.correlationId,
        requestCount: traffic.all().length,
      })

      await attach('correlation.json', { correlationId: logger.correlationId })
      await attach('network.json', {
        requests: traffic.all().map((request) => ({
          method: request.method,
          url: request.url,
          resourceType: request.resourceType,
          // Bodies pass through the redactor before they reach the report.
          postData: request.postData,
        })),
        distinctOrigins: traffic.distinctOrigins(),
      })
      await attach('navigation.json', { urls: navigation.urls() })
      await attach('console.json', {
        messages: consoleLog.all(),
        pageErrors: consoleLog.pageErrors(),
      })
      await attach('telemetry.json', { events: await telemetry.events() })
    },
    { auto: true },
  ],
})

export { expect }
