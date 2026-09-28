/**
 * Console and telemetry observers.
 *
 * The console recorder is straightforward: Playwright surfaces every message
 * and every uncaught page error.
 *
 * Telemetry needs a word of explanation. `src/platform/telemetry.ts` holds a
 * module-level sink that starts as `null`, `emit` returns early while that is
 * so, and nothing in the shipped application ever calls `setTelemetrySink` -
 * `src/main.tsx` mounts the shell and installs no sink. So with the client in
 * its shipped configuration there is nothing at all for a browser test to
 * observe, and the analytics rows (TC-096, TC-097, TC-116, TC-118) would pass
 * vacuously against an empty array.
 *
 * Rather than accept that, the collector does two things before any
 * application script runs:
 *
 *   1. It publishes a store on `window` under `TELEMETRY_GLOBAL`.
 *   2. It intercepts the telemetry module as the dev server serves it and
 *      appends a few lines that call the module's own `setTelemetrySink` with
 *      a function forwarding each event into that store.
 *
 * Step 2 is a test-only patch of the module text, not a change to the product,
 * and it is deliberately observable: `bridged()` reports whether the patch
 * actually landed, so a run against a bundle the pattern does not match fails
 * loudly instead of reporting "no events, all clear". REVIEW.md carries the
 * product gap - no sink ships - as an open finding.
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

/** The module whose sink the bridge installs, as the dev server addresses it. */
export const TELEMETRY_MODULE_PATTERN = /\/src\/platform\/telemetry\.ts(?:\?.*)?$/

/**
 * Events emitted from a React mount effect.
 *
 * `src/main.tsx` mounts the tree inside `<StrictMode>`, and React 19 in
 * development deliberately invokes every mount effect twice to surface effects
 * that are not idempotent. That is correct product behaviour under the dev
 * server, but it means a view event arrives twice where the CSV counts one.
 *
 * Only *consecutive, byte-identical* occurrences of these four names are
 * collapsed, and only these four:
 *
 *   🚫 `login.duplicate_suppressed` is NOT here. Four identical consecutive
 *      events are exactly what TC-116 asserts, and collapsing them would
 *      delete the assertion.
 *   🚫 `landing.logout` is NOT here. It is emitted from a click handler, so a
 *      repeat is a real repeat.
 */
export const MOUNT_REPLAY_EVENTS: readonly string[] = [
  'login.viewed',
  'landing.viewed',
  'landing.blocked_unauthenticated',
  'landing.session_expired',
]

export interface TelemetryEvent {
  readonly name: string
  readonly payload: Record<string, unknown>
}

export interface TelemetryRecorder {
  /** Events with StrictMode mount replays collapsed. */
  events(): Promise<readonly TelemetryEvent[]>
  /** Every event exactly as the application emitted it. */
  rawEvents(): Promise<readonly TelemetryEvent[]>
  named(name: string): Promise<readonly TelemetryEvent[]>
  /** Every key any recorded payload carried, for the allow-list check. */
  payloadKeys(): Promise<readonly string[]>
  /** Serialised events, for substring sweeps. Uses the raw list. */
  text(): Promise<string>
  /**
   * Whether the sink bridge reached the application's telemetry module.
   * False means the module was served in a shape the patch did not match, and
   * an empty event list proves nothing.
   */
  bridged(): Promise<boolean>
  clear(): Promise<void>
}

/**
 * Collapses consecutive byte-identical mount-effect replays.
 *
 * Exported so the behaviour is unit-visible and so a spec can state plainly
 * which list it is asserting against.
 */
export function collapseMountReplays(
  events: readonly TelemetryEvent[],
  replayable: readonly string[] = MOUNT_REPLAY_EVENTS,
): readonly TelemetryEvent[] {
  const kept: TelemetryEvent[] = []
  for (const event of events) {
    const previous = kept[kept.length - 1]
    const isReplay =
      previous !== undefined &&
      replayable.includes(event.name) &&
      previous.name === event.name &&
      JSON.stringify(previous.payload) === JSON.stringify(event.payload)
    if (!isReplay) {
      kept.push(event)
    }
  }
  return kept
}

/**
 * The lines appended to the telemetry module.
 *
 * They run in the module's own scope, so `setTelemetrySink` is the module's
 * real binding rather than a re-import, and the sink is installed before any
 * component can emit. The event is split into its `name` and the rest of its
 * fields so the store's shape matches what the CSV calls "the event and its
 * payload".
 */
function bridgeSource(globalName: string): string {
  return `
;(function () {
  try {
    var collector = window[${JSON.stringify(globalName)}]
    if (!collector) {
      return
    }
    setTelemetrySink(function (event) {
      var payload = {}
      for (var key in event) {
        if (key !== 'name' && Object.prototype.hasOwnProperty.call(event, key)) {
          payload[key] = event[key]
        }
      }
      collector.sink(event.name, payload)
    })
    collector.markBridged()
  } catch (error) {
    // A failing test bridge must not break the application under test; the
    // spec detects it through bridged() instead.
  }
})()
`
}

/**
 * Installs the collector. Must be called before the first navigation so the
 * init script and the module route both land ahead of application code.
 */
export async function installTelemetryCollector(page: Page): Promise<TelemetryRecorder> {
  await page.addInitScript((globalName: string) => {
    const store: Array<{ name: string; payload: Record<string, unknown> }> = []
    const state = { bridged: false }
    const sink = (name: string, payload: Record<string, unknown> = {}): void => {
      store.push({ name, payload })
    }
    Object.defineProperty(window, globalName, {
      value: {
        events: store,
        state,
        sink,
        markBridged: (): void => {
          state.bridged = true
        },
      },
      writable: false,
      configurable: false,
    })
    // Kept for a build that chooses to publish a hook of its own.
    const hook = (window as unknown as Record<string, unknown>).__paccoInstallTelemetrySink__
    if (typeof hook === 'function') {
      ;(hook as (s: typeof sink) => void)(sink)
      state.bridged = true
    }
  }, TELEMETRY_GLOBAL)

  await page.route(TELEMETRY_MODULE_PATTERN, async (route) => {
    const response = await route.fetch()
    const original = await response.text()
    await route.fulfill({ response, body: `${original}${bridgeSource(TELEMETRY_GLOBAL)}` })
  })

  const read = async (): Promise<TelemetryEvent[]> =>
    page.evaluate((globalName: string) => {
      const collector = (window as unknown as Record<string, unknown>)[globalName] as
        | { events: Array<{ name: string; payload: Record<string, unknown> }> }
        | undefined
      return collector === undefined ? [] : collector.events.map((entry) => ({ ...entry }))
    }, TELEMETRY_GLOBAL)

  const collapsed = async (): Promise<readonly TelemetryEvent[]> =>
    collapseMountReplays(await read())

  return {
    events: collapsed,
    rawEvents: read,
    named: async (name) => (await collapsed()).filter((event) => event.name === name),
    payloadKeys: async () => {
      const events = await read()
      return [...new Set(events.flatMap((event) => Object.keys(event.payload)))].sort()
    },
    text: async () => JSON.stringify(await read()),
    bridged: async () =>
      page.evaluate((globalName: string) => {
        const collector = (window as unknown as Record<string, unknown>)[globalName] as
          | { state: { bridged: boolean } }
          | undefined
        return collector !== undefined && collector.state.bridged
      }, TELEMETRY_GLOBAL),
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
