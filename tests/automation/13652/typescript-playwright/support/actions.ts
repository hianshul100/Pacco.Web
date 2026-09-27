/**
 * The actions specs perform.
 *
 * Page objects stay declarative, so the verbs live here. Each of these is a
 * plain sequence of Playwright calls with no assertions and no fixed delays -
 * a caller that needs to wait for an outcome waits on that outcome.
 */
import type { Page, Response } from '@playwright/test'

import type { LoginPage } from '../pages/LoginPage'
import type { WelcomePage } from '../pages/WelcomePage'
import { readEnvConfig } from './env'
import { LANDING_COPY, ROUTES } from './expectedCopy'

/** How the sign-in form is submitted. Each route is asserted by TC-108. */
export type SubmitMethod = 'button' | 'enter-from-identifier' | 'enter-from-password'

export interface Credentials {
  readonly identifier: string
  readonly password: string
}

/** Navigates to a path on the client's own origin. */
export async function openPath(page: Page, path: string): Promise<Response | null> {
  const env = readEnvConfig()
  return page.goto(`${env.webBaseUrl}${path}`)
}

export async function openLogin(page: Page): Promise<Response | null> {
  return openPath(page, ROUTES.login)
}

export async function openWelcome(page: Page): Promise<Response | null> {
  return openPath(page, ROUTES.welcome)
}

/** Types both credentials. Values are entered verbatim, never trimmed. */
export async function fillCredentials(login: LoginPage, credentials: Credentials): Promise<void> {
  await login.identifier.fill(credentials.identifier)
  await login.password.fill(credentials.password)
}

/** Submits the form by the requested route. */
export async function submitSignIn(login: LoginPage, method: SubmitMethod = 'button'): Promise<void> {
  switch (method) {
    case 'button':
      await login.submit.click()
      return
    case 'enter-from-identifier':
      await login.identifier.press('Enter')
      return
    case 'enter-from-password':
      await login.password.press('Enter')
      return
  }
}

/** Fills the form and submits it. Does not wait for any outcome. */
export async function signIn(
  login: LoginPage,
  credentials: Credentials,
  method: SubmitMethod = 'button',
): Promise<void> {
  await fillCredentials(login, credentials)
  await submitSignIn(login, method)
}

/**
 * Signs in and waits for the sign-in response itself, so a caller can inspect
 * the status and body the platform actually returned. Used by the @live rows
 * that must detect contract drift rather than assume it away.
 */
export async function signInAndCaptureResponse(
  page: Page,
  login: LoginPage,
  credentials: Credentials,
  method: SubmitMethod = 'button',
): Promise<Response> {
  const env = readEnvConfig()
  const pending = page.waitForResponse(
    (response) =>
      response.url().startsWith(env.signInUrl) && response.request().method() === 'POST',
  )
  await signIn(login, credentials, method)
  return pending
}

/** Presses the reveal control once. */
export async function toggleReveal(login: LoginPage): Promise<void> {
  await login.revealToggle.click()
}

/** Ends the browser session. A client-side discard: no backend call is made. */
export async function logout(welcome: WelcomePage): Promise<void> {
  await welcome.logout.click()
}

/** Walks the tab order from the top of the document. */
export async function tabThrough(page: Page, steps: number): Promise<readonly string[]> {
  const reached: string[] = []
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press('Tab')
    reached.push(
      await page.evaluate(() => {
        const element = document.activeElement
        if (element === null) {
          return 'none'
        }
        const label =
          element.getAttribute('aria-label') ??
          element.getAttribute('name') ??
          element.id ??
          (element.textContent ?? '').trim()
        return `${element.tagName.toLowerCase()}:${label}`
      }),
    )
  }
  return reached
}

/** The browser's own Back, Forward and reload, wrapped for readability. */
export async function goBack(page: Page): Promise<void> {
  await page.goBack()
}

export async function goForward(page: Page): Promise<void> {
  await page.goForward()
}

/** A hard reload: the document is fetched again and the app re-initialises. */
export async function hardReload(page: Page): Promise<void> {
  await page.reload()
}

/** Types an address into the address bar, as distinct from clicking a link. */
export async function enterAddress(page: Page, path: string): Promise<void> {
  await openPath(page, path)
}

/**
 * Clicks a control five times in rapid succession. Used by the duplicate-
 * suppression rows; the interval is driven by the CSV, not by a sleep - the
 * clicks are issued back to back and the stub holds the response open.
 */
export async function clickRepeatedly(
  login: LoginPage,
  times: number,
): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    // `force` because the control becomes disabled after the first click and
    // the row's whole point is that the later clicks must change nothing.
    await login.submit.click({ force: true, noWaitAfter: true }).catch(() => {
      // A click the browser refuses because the control is disabled is itself
      // the expected behaviour; it must not end the loop.
    })
  }
}

/** The logout control's accessible name, for specs that need it inline. */
export const LOGOUT_NAME = LANDING_COPY.logout
