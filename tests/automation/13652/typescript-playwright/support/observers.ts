/**
 * Console and telemetry observers.
 *
 * The console recorder is straightforward: Playwright surfaces every message
 * and every uncaught page error.
 *
 * Telemetry needs a word of explanation. `src/platform/telemetry.ts` holds a
 * module-level sink that starts as `null`, and `emit` returns early while no
 * sink is installed - so with the client in its shipped configuration there is
 * nothing for a browser test to observe. Rather than let the analytics rows
 * (TC-096, TC-097) pass vacuously against an empty array, this installs a
 * collector on `window` before any application script runs and records
 * whatever the application chooses to hand it. The specs pair that runtime
 * capture with a static assertion over the telemetry module's own payload
 * shapes, and REVIEW.md records the limitation.
 */
import type { ConsoleMessage, Page } from '@playwright/test'

export interface ConsoleEntry {
  readonly type: string
  readonly text: string
  readonly at: number
}

export interface ConsoleRecorder {
  all(): readonly ConsoleEntry[]
  errors(): readonly ConsoleEntry[]
  /** Uncaught exceptions and unhandled rejections surfaced by the page. */
  pageErrors(): readonly string[]
  text(): string
  clear(): void
}

export function recordConsole(page: Page): ConsoleRecorder {
  let entries: ConsoleEntry[] = []
  let failures: string[] = []

  const onConsole = (message: ConsoleMessage): void => {
    entries.push({ type: message.type(), text: message.text(), at: Date.now() })
  }

  page.on('console', onConsole)
  page.on('pageerror', (error) => {
    failures.push(`${error.name}: ${error.message}`)
  })

  return {
    all: () => entries,
    errors: () => entries.filter((entry) => entry.type === 'error'),
    pageErrors: () => failures,
    text: () => entries.map((entry) => entry.text).join('\n'),
    clear: () => {
      entries = []
      failures = []
    },
  }
}

/** The global the collector publishes into. Kept namespaced to this suite. */
export const TELEMETRY_GLOBAL = '__pacco13652Telemetry__'

export interface TelemetryEvent {
  readonly name: string
  readonly payload: Record<string, unknown>
}

export interface TelemetryRecorder {
  events(): Promise<readonly TelemetryEvent[]>
  named(name: string): Promise<readonly TelemetryEvent[]>
  /** Every key any recorded payload carried, for the allow-list check. */
  payloadKeys(): Promise<readonly string[]>
  /** Serialised events, for substring sweeps. */
  text(): Promise<string>
  clear(): Promise<void>
}

/**
 * Installs the collector. Must be called before the first navigation so the
 * init script lands ahead of application code.
 */
export async function installTelemetryCollector(page: Page): Promise<TelemetryRecorder> {
  await page.addInitScript((globalName: string) => {
    const store: Array<{ name: string; payload: Record<string, unknown> }> = []
    const sink = (name: string, payload: Record<string, unknown> = {}): void => {
      store.push({ name, payload })
    }
    Object.defineProperty(window, globalName, {
      value: { events: store, sink },
      writable: false,
      configurable: false,
    })
    // The application installs a sink through this hook if it has one.
    const hook = (window as unknown as Record<string, unknown>).__paccoInstallTelemetrySink__
    if (typeof hook === 'function') {
      ;(hook as (s: typeof sink) => void)(sink)
    }
  }, TELEMETRY_GLOBAL)

  const read = async (): Promise<TelemetryEvent[]> =>
    page.evaluate((globalName: string) => {
      const collector = (window as unknown as Record<string, unknown>)[globalName] as
        | { events: Array<{ name: string; payload: Record<string, unknown> }> }
        | undefined
      return collector === undefined ? [] : collector.events.map((entry) => ({ ...entry }))
    }, TELEMETRY_GLOBAL)

  return {
    events: read,
    named: async (name) => (await read()).filter((event) => event.name === name),
    payloadKeys: async () => {
      const events = await read()
      return [...new Set(events.flatMap((event) => Object.keys(event.payload)))].sort()
    },
    text: async () => JSON.stringify(await read()),
    clear: async () => {
      await page.evaluate((globalName: string) => {
        const collector = (window as unknown as Record<string, unknown>)[globalName] as
          | { events: unknown[] }
          | undefined
        if (collector !== undefined) {
          collector.events.length = 0
        }
      }, TELEMETRY_GLOBAL)
    },
  }
}
