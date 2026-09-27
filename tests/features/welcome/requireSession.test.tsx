/**
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.6.A.3 -- the guard's three suites:
 * decision (5), side effects (3) and liveness re-evaluation (2).
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LOGIN_COPY } from '@/features/login/copy'
import { WELCOME_COPY } from '@/features/welcome/copy'
import { Telemetry } from '@/platform/telemetry'
import type { TelemetryEvent } from '@/platform/telemetry'
import { MESSAGE_REGISTRY } from '@/session/messageRegistry'
import { SESSION_STORAGE_KEY, SessionStore } from '@/session/sessionStore'
import { renderGuardWith, renderRoute, seedSession } from '../../support/renderWelcome'

const landingHeading = () => screen.queryByRole('heading', { level: 1, name: /Welcome/ })
const signInHeading = () => screen.queryByRole('heading', { name: LOGIN_COPY.heading })

let events: TelemetryEvent[]

beforeEach(() => {
  events = []
  Telemetry.setTelemetrySink((event) => events.push(event))
})

afterEach(() => Telemetry.setTelemetrySink(null))

describe('RequireSession: the decision', () => {
  it('allows a live session through to the landing screen', async () => {
    seedSession({ role: 'user', expiresInSeconds: 900 })
    renderRoute({ path: '/welcome' })

    expect(landingHeading()).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveAttribute('data-pathname', '/welcome'),
    )
  })

  it('denies an ABSENT session and redirects to sign-in with no reason', async () => {
    renderRoute({ path: '/welcome' })

    await waitFor(() => expect(signInHeading()).toBeInTheDocument())
    expect(landingHeading()).not.toBeInTheDocument()
    // 🚫 No expiry notice: nothing expired, the URL was simply typed.
    expect(screen.getByTestId('session-notice')).toBeEmptyDOMElement()
    expect(screen.queryByText(MESSAGE_REGISTRY.session_expired)).not.toBeInTheDocument()
  })

  it('denies an EXPIRED session and redirects with the session_expired reason key', async () => {
    seedSession({ role: 'admin', expiresInSeconds: -1 })
    renderRoute({ path: '/welcome' })

    await waitFor(() => expect(signInHeading()).toBeInTheDocument())
    expect(await screen.findByText(MESSAGE_REGISTRY.session_expired)).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveAttribute('data-reason', 'session_expired')
  })

  it('denies an UNUSABLE stored record the same way it denies an absent one', async () => {
    // `read()` returns null for anything it cannot parse, so the guard sees the
    // absent case and must not fall through to "live".
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, '{ not json')
    renderRoute({ path: '/welcome' })

    await waitFor(() => expect(signInHeading()).toBeInTheDocument())
    expect(screen.getByTestId('session-notice')).toBeEmptyDOMElement()
  })

  it('denies when storage itself throws, rather than rendering the protected screen', async () => {
    jest.spyOn(window.sessionStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new DOMException('storage unavailable')
    })
    renderRoute({ path: '/welcome' })

    await waitFor(() => expect(signInHeading()).toBeInTheDocument())
    expect(landingHeading()).not.toBeInTheDocument()
  })
})

describe('RequireSession: side effects', () => {
  it('🚫 never constructs the protected component tree on a denial', async () => {
    const constructed = jest.fn()
    renderGuardWith({ onChildConstructed: constructed })

    await waitFor(() => expect(screen.getByText('sign-in screen')).toBeInTheDocument())
    // Not "absent from the DOM" -- never rendered at all, so nothing flashed.
    expect(constructed).not.toHaveBeenCalled()
  })

  it('clears the expired session BEFORE redirecting, leaving no storage key behind', async () => {
    const order: string[] = []
    const clear = jest.spyOn(SessionStore, 'clear')
    clear.mockImplementation(() => {
      order.push('clear')
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    })

    seedSession({ role: 'admin', expiresInSeconds: -30 })
    renderRoute({ path: '/welcome' })

    await waitFor(() => expect(signInHeading()).toBeInTheDocument())
    order.push('redirected')

    expect(order).toEqual(['clear', 'redirected'])
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(SessionStore.read()).toBeNull()
  })

  it('emits the matching denial event, carrying the route and nothing else', async () => {
    renderRoute({ path: '/welcome' })
    await waitFor(() =>
      expect(events).toContainEqual({ name: 'landing.blocked_unauthenticated', route: '/welcome' }),
    )

    events.length = 0
    seedSession({ role: 'admin', expiresInSeconds: -1 })
    renderRoute({ path: '/welcome' })
    await waitFor(() =>
      expect(events).toContainEqual({ name: 'landing.session_expired', route: '/welcome' }),
    )
    // 🚫 No token, no role, no expiry value reaches telemetry.
    expect(JSON.stringify(events)).not.toMatch(/admin|accessToken|expiresAt/i)
  })
})

describe('RequireSession: liveness is re-evaluated on every decision', () => {
  it('🚫 does not reuse an earlier decision when the session expires between navigations', async () => {
    const user = userEvent.setup()
    seedSession({ role: 'user', expiresInSeconds: 900 })
    renderRoute({ path: '/welcome' })
    expect(landingHeading()).toBeInTheDocument()

    // Sign out to leave the guard, then put an ALREADY-EXPIRED session back and
    // navigate in again. A guard that cached "live" at mount would let this
    // through.
    await user.click(screen.getByRole('button', { name: WELCOME_COPY.logout }))
    await waitFor(() => expect(signInHeading()).toBeInTheDocument())

    seedSession({ role: 'user', expiresInSeconds: -1 })
    renderRoute({ path: '/welcome' })

    await waitFor(() =>
      expect(screen.getAllByText(MESSAGE_REGISTRY.session_expired).length).toBeGreaterThan(0),
    )
  })

  it('consults isLive on each decision and reads the clock at call time', async () => {
    const isLive = jest.spyOn(SessionStore, 'isLive')
    seedSession({ role: 'user', expiresInSeconds: 900 })

    const first = renderRoute({ path: '/welcome' })
    const afterFirst = isLive.mock.calls.length
    expect(afterFirst).toBeGreaterThan(0)
    first.unmount()

    renderRoute({ path: '/welcome' })
    expect(isLive.mock.calls.length).toBeGreaterThan(afterFirst)

    // 🚫 Never called with a frozen timestamp: the default parameter reads
    // `Date.now()` inside `isLive`, so no caller can pin the clock.
    for (const call of isLive.mock.calls) {
      expect(call.length).toBe(1)
    }
  })
})
