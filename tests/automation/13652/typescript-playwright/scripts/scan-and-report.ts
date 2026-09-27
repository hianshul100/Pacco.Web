/**
 * Standalone accessibility scan.
 *
 * `npm run a11y:scan` walks the pages named in `config/a11y.config.ts`, runs
 * axe against each one, and writes a JSON result plus a readable summary into
 * `reports/a11y/`. It shares the suite's configuration, so the level, tags and
 * page list come from the same place the `a11y` project uses - the two can
 * never drift apart.
 *
 * This exists because the scan is useful outside a test run: a designer wants
 * the report, CI wants a machine-readable artefact, and neither wants to read
 * a Playwright HTML report to get it. The exit code is 1 when violations are
 * found and `A11Y_FAIL_ON_VIOLATIONS` is on, so it can gate a pipeline.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { chromium, type Browser, type Page } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

import { readA11yConfig, type A11yPageTarget } from '../config/a11y.config'
import { readEnvConfig, validateEnvConfig } from '../support/env'
import { createLogger } from '../support/logger'
import { newCorrelationId } from '../support/correlation'
import { seedSession } from '../support/sessionSeed'

interface ViolationSummary {
  readonly id: string
  readonly impact: string
  readonly help: string
  readonly helpUrl: string
  readonly nodeCount: number
  readonly targets: readonly string[]
}

interface PageReport {
  readonly id: string
  readonly name: string
  readonly url: string
  readonly violations: readonly ViolationSummary[]
  readonly passCount: number
  readonly incompleteCount: number
}

async function scanPage(page: Page, target: A11yPageTarget): Promise<PageReport> {
  const env = readEnvConfig()
  const a11y = readA11yConfig()
  const url = `${env.webBaseUrl}${target.path}`

  if (target.seedRole !== null) {
    await seedSession(page, { role: target.seedRole })
  }
  await page.goto(url, { waitUntil: 'load' })

  const builder = new AxeBuilder({ page }).withTags([...a11y.wcagTags])
  const disabled = a11y.disabledRules.map((rule) => rule.id)
  const results = await (disabled.length === 0 ? builder : builder.disableRules(disabled)).analyze()

  return {
    id: target.id,
    name: target.name,
    url,
    violations: results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? 'unknown',
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodeCount: violation.nodes.length,
      targets: violation.nodes.flatMap((node) => node.target.map((selector) => String(selector))),
    })),
    passCount: results.passes.length,
    incompleteCount: results.incomplete.length,
  }
}

function renderSummary(reports: readonly PageReport[], level: string): string {
  const lines: string[] = [
    `# Accessibility scan (WCAG ${level.toUpperCase()})`,
    '',
    '| Page | Violations | Passes | Needs review |',
    '| --- | ---: | ---: | ---: |',
  ]

  for (const report of reports) {
    const total = report.violations.reduce((sum, violation) => sum + violation.nodeCount, 0)
    lines.push(`| ${report.name} | ${total} | ${report.passCount} | ${report.incompleteCount} |`)
  }

  for (const report of reports.filter((entry) => entry.violations.length > 0)) {
    lines.push('', `## ${report.name}`, '')
    for (const violation of report.violations) {
      lines.push(
        `- **${violation.id}** (${violation.impact}) × ${violation.nodeCount} — ${violation.help}`,
        `  - ${violation.helpUrl}`,
        `  - ${violation.targets.slice(0, 5).join(', ')}`,
      )
    }
  }

  return `${lines.join('\n')}\n`
}

async function main(): Promise<number> {
  // The scan runs outside Playwright's config, so it loads the environment
  // itself - the real file first, the committed template as the fallback.
  loadEnv()
  loadEnv({ path: '.env.example' })
  validateEnvConfig()

  const env = readEnvConfig()
  const a11y = readA11yConfig()
  const logger = createLogger({ correlationId: newCorrelationId(), testId: 'a11y-scan' })

  const outputDir = join(env.suiteRoot, 'reports', 'a11y')
  mkdirSync(outputDir, { recursive: true })

  let browser: Browser | null = null
  try {
    browser = await chromium.launch()
    const context = await browser.newContext({
      baseURL: env.webBaseUrl,
      ignoreHTTPSErrors: env.ignoreHttpsErrors,
    })
    const page = await context.newPage()

    const reports: PageReport[] = []
    for (const target of a11y.pages) {
      logger.info('scanning', { page: target.name, path: target.path })
      reports.push(await scanPage(page, target))
    }

    writeFileSync(
      join(outputDir, 'results.json'),
      `${JSON.stringify({ level: a11y.level, tags: a11y.wcagTags, reports }, null, 2)}\n`,
      'utf8',
    )
    writeFileSync(join(outputDir, 'summary.md'), renderSummary(reports, a11y.level), 'utf8')

    const violationCount = reports.reduce((sum, report) => sum + report.violations.length, 0)
    logger.info('scan complete', { pages: reports.length, violationCount, outputDir })
    console.log(renderSummary(reports, a11y.level))

    return violationCount > 0 && a11y.failOnViolations ? 1 : 0
  } finally {
    await browser?.close()
  }
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
