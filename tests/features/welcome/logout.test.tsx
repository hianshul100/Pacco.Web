/**
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.6.A.3, "Logout" (3 cases).
 *
 * ⚠️ Logout is a CLIENT-SIDE SESSION DISCARD. There is no logout route, no
 * revoke call, and no change to the gateway's JWT validation. The already
 * issued token stays acceptable to the gateway until its own `exp`; what these
 * cases prove is that the browser stops holding it and stops presenting a
 * signed-in screen.
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LOGIN_COPY } from '@/features/login/copy'
import { WELCOME_COPY } from '@/features/welcome/copy'
import { Telemetry } from '@/platform/telemetry'
import type { TelemetryEvent } from '@/platform/telemetry'
import { MESSAGE_REGISTRY } from '@/session/messageRegistry'
import { SessionStore } from '@/session/sessionStore'
import { renderRoute, seedSession } from '../../support/renderWelcome'

let events: TelemetryEvent[]

beforeEach(() => {
  events = []
  Telemetry.setTelemetrySink((event) => events.push(event))
})

afterEach(() => Telemetry.setTelemetrySink(null))

const logoutButton = () => screen.getByRole('button', { name: WELCOME_COPY.logout })

describe('Logout', () => {
  it('discards the session and returns to sign-in', async () => {
    const user = userEvent.setup()
    const { accessToken } = seedSession({ role: 'admin', expiresInSeconds: 900 })
    const { container } = renderRoute({ path: '/welcome' })

    await user.click(logoutButton())

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument(),
    )
    expect(SessionStore.read()).toBeNull()
    // 🚫 No storage key anywhere still holds the token.
    expect(window.sessionStorage.length).toBe(0)
    expect(window.localStorage.length).toBe(0)
    expect(container.innerHTML).not.toContain(accessToken)
    expect(document.cookie).not.toContain(accessToken)
  })

  it('🚫 makes NO network call and adds no logout or revoke request', async () => {
    const user = userEvent.setup()
    seedSession({ role: 'user', expiresInSeconds: 900 })
    // `tests/setup.ts` installs a `fetch` that throws on any call; the route's
    // client throws on any `signIn`. Either would fail this test.
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
    renderRoute({ path: '/welcome' })

    await user.click(logoutButton())

    await waitFor(() => expect(SessionStore.read()).toBeNull())
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('emits landing.logout with the route only, and raises NO expiry notice', async () => {
    const user = userEvent.setup()
    seedSession({ role: 'admin', expiresInSeconds: 900 })
    renderRoute({ path: '/welcome' })

    await user.click(logoutButton())
    await waitFor(() =>
      expect(events).toContainEqual({ name: 'landing.logout', route: '/welcome' }),
    )

    // A deliberate sign-out is NOT an expiry. §L.3 item 5: the navigation
    // carries no reason key.
    expect(screen.queryByText(MESSAGE_REGISTRY.session_expired)).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveAttribute('data-reason', '')

    // §L.3 item 9: `landing.logout` carries the route and NOTHING else -- no
    // role, no token, no identifier. (The `landing.viewed` emitted earlier in
    // the journey legitimately carries the presentation, which is why this
    // narrows to the logout event rather than scanning the whole sequence.)
    const logoutEvents = events.filter((event) => event.name === 'landing.logout')
    expect(logoutEvents).toEqual([{ name: 'landing.logout', route: '/welcome' }])
    expect(JSON.stringify(logoutEvents)).not.toMatch(/admin|accessToken/i)
  })
})
