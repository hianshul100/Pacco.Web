/**
 * The leak sweep.
 *
 * Roughly a fifth of the CSV asks the same question in different clothes: does
 * this value appear anywhere it should not? Rather than write that search
 * fifteen times, every such row calls `sweepForValue` and asserts the result
 * is empty.
 *
 * The surfaces swept are exactly the ones the CSV enumerates: rendered markup,
 * element attributes, live input values, the accessibility tree, sessionStorage,
 * localStorage, cookies, IndexedDB, the console, telemetry, and the bodies of
 * the requests actually put on the wire.
 */
import type { Page } from '@playwright/test'

import type { TrafficRecorder } from './network'
import type { ConsoleRecorder, TelemetryRecorder } from './observers'

export type SweepSurface =
  | 'markup'
  | 'attributes'
  | 'input-values'
  | 'accessibility-tree'
  | 'sessionStorage'
  | 'localStorage'
  | 'cookies'
  | 'indexedDB'
  | 'console'
  | 'telemetry'
  | 'request-bodies'

export interface SweepHit {
  readonly surface: SweepSurface
  /** Where inside the surface, e.g. a storage key or an attribute name. */
  readonly where: string
  /** A short, already-trimmed excerpt. Never the whole document. */
  readonly excerpt: string
}

export interface SweepOptions {
  readonly traffic?: TrafficRecorder
  readonly consoleLog?: ConsoleRecorder
  readonly telemetry?: TelemetryRecorder
  /** Surfaces to skip, e.g. when a value is legitimately expected on the wire. */
  readonly skip?: readonly SweepSurface[]
}

/** Dumps every client-side storage area as plain, comparable strings. */
interface StorageDump {
  readonly session: Record<string, string>
  readonly local: Record<string, string>
  readonly indexedDb: string
  readonly attributes: Array<{ selector: string; name: string; value: string }>
  readonly inputValues: Array<{ selector: string; value: string }>
}

async function dumpClientState(page: Page): Promise<StorageDump> {
  return page.evaluate(async () => {
    const readArea = (area: Storage | null): Record<string, string> => {
      const output: Record<string, string> = {}
      if (area === null) {
        return output
      }
      try {
        for (let index = 0; index < area.length; index += 1) {
          const key = area.key(index)
          if (key !== null) {
            output[key] = area.getItem(key) ?? ''
          }
        }
      } catch {
        // A storage area that refuses to be read contributes nothing.
      }
      return output
    }

    const describe = (element: Element): string => {
      const id = element.id === '' ? '' : `#${element.id}`
      return `${element.tagName.toLowerCase()}${id}`
    }

    const attributes: Array<{ selector: string; name: string; value: string }> = []
    const inputValues: Array<{ selector: string; value: string }> = []

    for (const element of Array.from(document.querySelectorAll('*'))) {
      for (const attribute of Array.from(element.attributes)) {
        attributes.push({
          selector: describe(element),
          name: attribute.name,
          value: attribute.value,
        })
      }
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        inputValues.push({ selector: describe(element), value: element.value })
        if ('defaultValue' in element) {
          inputValues.push({
            selector: `${describe(element)}[defaultValue]`,
            value: (element as HTMLInputElement).defaultValue,
          })
        }
      }
    }

    // IndexedDB: enumerate every database, object store and record.
    let indexedDb = ''
    try {
      const factory = window.indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{ name?: string }>>
      }
      const databases = typeof factory.databases === 'function' ? await factory.databases() : []
      const dumps: unknown[] = []
      for (const info of databases) {
        if (info.name === undefined) {
          continue
        }
        const database = await new Promise<IDBDatabase | null>((settle) => {
          const request = factory.open(info.name as string)
          request.onsuccess = () => settle(request.result)
          request.onerror = () => settle(null)
          request.onblocked = () => settle(null)
        })
        if (database === null) {
          continue
        }
        for (const storeName of Array.from(database.objectStoreNames)) {
          const records = await new Promise<unknown[]>((settle) => {
            try {
              const request = database
                .transaction(storeName, 'readonly')
                .objectStore(storeName)
                .getAll()
              request.onsuccess = () => settle(request.result as unknown[])
              request.onerror = () => settle([])
            } catch {
              settle([])
            }
          })
          dumps.push({ database: info.name, store: storeName, records })
        }
        database.close()
      }
      indexedDb = JSON.stringify(dumps)
    } catch {
      indexedDb = ''
    }

    return {
      session: readArea(window.sessionStorage),
      local: readArea(window.localStorage),
      indexedDb,
      attributes,
      inputValues,
    }
  })
}

function excerptAround(haystack: string, needle: string): string {
  const index = haystack.indexOf(needle)
  if (index === -1) {
    return ''
  }
  const start = Math.max(0, index - 30)
  return `…${haystack.slice(start, index + needle.length + 30)}…`
}

/**
 * Searches every client-visible surface for `needle`. An empty result is the
 * assertion the leak rows make; a non-empty result names exactly where the
 * value surfaced, which is what a failure report needs.
 */
export async function sweepForValue(
  page: Page,
  needle: string,
  options: SweepOptions = {},
): Promise<readonly SweepHit[]> {
  if (needle === '') {
    throw new Error('sweepForValue needs a non-empty needle; an empty string matches everything.')
  }

  const skip = new Set<SweepSurface>(options.skip ?? [])
  const hits: SweepHit[] = []
  const record = (surface: SweepSurface, where: string, haystack: string): void => {
    if (skip.has(surface) || !haystack.includes(needle)) {
      return
    }
    hits.push({ surface, where, excerpt: excerptAround(haystack, needle) })
  }

  record('markup', 'document', await page.content())

  const ariaSnapshot = await page.locator('body').ariaSnapshot()
  record('accessibility-tree', 'body', ariaSnapshot)

  const state = await dumpClientState(page)

  for (const entry of state.attributes) {
    record('attributes', `${entry.selector}[${entry.name}]`, entry.value)
  }
  for (const entry of state.inputValues) {
    record('input-values', entry.selector, entry.value)
  }
  for (const [key, value] of Object.entries(state.session)) {
    record('sessionStorage', key, `${key}=${value}`)
  }
  for (const [key, value] of Object.entries(state.local)) {
    record('localStorage', key, `${key}=${value}`)
  }
  record('indexedDB', 'all databases', state.indexedDb)

  const cookies = await page.context().cookies()
  for (const cookie of cookies) {
    record('cookies', cookie.name, `${cookie.name}=${cookie.value}`)
  }

  if (options.consoleLog !== undefined) {
    record('console', 'messages', options.consoleLog.text())
    record('console', 'page errors', options.consoleLog.pageErrors().join('\n'))
  }

  if (options.telemetry !== undefined) {
    record('telemetry', 'events', await options.telemetry.text())
  }

  if (options.traffic !== undefined) {
    for (const request of options.traffic.all()) {
      record('request-bodies', `${request.method} ${request.path}`, request.postData ?? '')
    }
  }

  return hits
}

/** Formats hits for an assertion message that names the surface, not just a count. */
export function describeHits(hits: readonly SweepHit[]): string {
  return hits.map((hit) => `${hit.surface} @ ${hit.where}: ${hit.excerpt}`).join('\n')
}

/** Reads the client's single session key, parsed, or `null` when absent. */
export async function readStoredSession(
  page: Page,
  storageKey: string,
): Promise<Record<string, unknown> | null> {
  return page.evaluate((key: string) => {
    try {
      const raw = window.sessionStorage.getItem(key)
      if (raw === null) {
        return null
      }
      const parsed: unknown = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }, storageKey)
}

/** True when no storage area holds anything at all. Used by the logout rows. */
export async function allStorageIsEmpty(page: Page): Promise<boolean> {
  const state = await dumpClientState(page)
  const cookies = await page.context().cookies()
  return (
    Object.keys(state.session).length === 0 &&
    Object.keys(state.local).length === 0 &&
    cookies.length === 0 &&
    (state.indexedDb === '' || state.indexedDb === '[]')
  )
}
