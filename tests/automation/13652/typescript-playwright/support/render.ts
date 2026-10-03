/**
 * Recording what the DOM held, frame by frame.
 *
 * Some rows assert an absence that a settled screenshot cannot prove. TC-130
 * requires that a denied navigation never *constructs* the landing markup -
 * not that the markup is gone by the time the redirect finishes. A guard that
 * rendered the landing screen for one frame and then replaced it would satisfy
 * "the heading is not visible at the end" while leaking exactly what the row
 * exists to forbid.
 *
 * So this watches the document from before the first application script and
 * records, for every mutation batch, whether each named marker was in the
 * tree. The spec then asserts the marker was absent in *every* recorded frame.
 *
 * Only booleans are stored, never markup: a transcript of the DOM would be
 * large, and would be one more place a value under test could be copied to.
 */
import type { Page } from '@playwright/test'

/** The global the recorder publishes into. */
export const RENDER_OBSERVER_GLOBAL = '__pacco13652Frames__'

export interface RenderFrame {
  readonly at: number
  readonly present: Record<string, boolean>
}

export interface RenderRecorder {
  frames(): Promise<readonly RenderFrame[]>
  /** The markers that were present in at least one recorded frame. */
  everPresent(): Promise<readonly string[]>
  clear(): Promise<void>
}

/**
 * Installs the recorder. Must be called before the navigation being observed.
 *
 * `markers` maps a readable name onto a CSS selector; the name is what a
 * failure message quotes.
 */
export async function installRenderObserver(
  page: Page,
  markers: Readonly<Record<string, string>>,
): Promise<RenderRecorder> {
  await page.addInitScript(
    ([globalName, selectors]: [string, Record<string, string>]) => {
      const frames: Array<{ at: number; present: Record<string, boolean> }> = []
      Object.defineProperty(window, globalName, {
        value: { frames },
        writable: false,
        configurable: false,
      })

      const sample = (): void => {
        const present: Record<string, boolean> = {}
        for (const name of Object.keys(selectors)) {
          const selector = selectors[name]
          present[name] = selector === undefined ? false : document.querySelector(selector) !== null
        }
        frames.push({ at: Date.now(), present })
      }

      const start = (): void => {
        sample()
        new MutationObserver(sample).observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        })
      }

      if (document.documentElement === null) {
        document.addEventListener('readystatechange', start, { once: true })
      } else {
        start()
      }
    },
    [RENDER_OBSERVER_GLOBAL, { ...markers }] as [string, Record<string, string>],
  )

  const read = async (): Promise<RenderFrame[]> =>
    page.evaluate((globalName: string) => {
      const collector = (window as unknown as Record<string, unknown>)[globalName] as
        | { frames: Array<{ at: number; present: Record<string, boolean> }> }
        | undefined
      return collector === undefined
        ? []
        : collector.frames.map((frame) => ({ at: frame.at, present: { ...frame.present } }))
    }, RENDER_OBSERVER_GLOBAL)

  return {
    frames: read,
    everPresent: async () => {
      const frames = await read()
      const seen = new Set<string>()
      for (const frame of frames) {
        for (const [name, present] of Object.entries(frame.present)) {
          if (present) {
            seen.add(name)
          }
        }
      }
      return [...seen].sort()
    },
    clear: async () => {
      await page.evaluate((globalName: string) => {
        const collector = (window as unknown as Record<string, unknown>)[globalName] as
          | { frames: unknown[] }
          | undefined
        if (collector !== undefined) {
          collector.frames.length = 0
        }
      }, RENDER_OBSERVER_GLOBAL)
    },
  }
}

/**
 * The landing screen's markers, by the test ids `src/features/welcome/*`
 * actually renders. TC-130 forbids every one of them on a denied navigation.
 */
export const LANDING_MARKERS: Readonly<Record<string, string>> = {
  'welcome heading': '[data-testid="welcome-heading"]',
  'role indicator': '[data-testid="role-chip"]',
  'logout control': '[data-testid="logout-button"]',
  'landing top bar': '[data-testid="landing-top-bar"]',
  'welcome card': '[data-testid="welcome-card"]',
}
