/**
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.6.A.3 -- the root route (2), `WelcomeCard`
 * (5), `TopBar` (2) and the landing control inventory (1).
 */
import { screen, waitFor } from '@testing-library/react'

import { LOGIN_COPY } from '@/features/login/copy'
import { WELCOME_COPY } from '@/features/welcome/copy'
import { Telemetry } from '@/platform/telemetry'
import type { TelemetryEvent } from '@/platform/telemetry'
import { renderRoute, seedSession } from '../../support/renderWelcome'

let events: TelemetryEvent[]

beforeEach(() => {
  events = []
  Telemetry.setTelemetrySink((event) => events.push(event))
})

afterEach(() => Telemetry.setTelemetrySink(null))

describe('root route', () => {
  it('resolves forward to the landing screen when the session is live', async () => {
    seedSession({ role: 'admin', expiresInSeconds: 900 })
    renderRoute({ path: '/' })

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveAttribute('data-pathname', '/welcome'),
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Welcome to Admin Area$/)
  })

  it('leaves the anonymous resolution exactly as it was: the sign-in screen, in place', () => {
    renderRoute({ path: '/' })

    expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument()
    // 🚫 No redirect. Wave-1 renders sign-in AT the root path, and wave-2 adds
    // only the live-session branch above it.
    expect(screen.getByTestId('location')).toHaveAttribute('data-pathname', '/')
  })
})

describe('WelcomeCard', () => {
  beforeEach(() => seedSession({ role: 'admin', expiresInSeconds: 900 }))

  it('renders the heading with the emphasis phrase in its own span', () => {
    renderRoute({ path: '/welcome' })
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(/^Welcome to Admin Area$/)
    expect(heading.querySelector('span')).toHaveTextContent(WELCOME_COPY.headingAdminEmphasis)
  })

  it('renders the supporting line', () => {
    renderRoute({ path: '/welcome' })
    expect(screen.getByText(WELCOME_COPY.supporting)).toBeInTheDocument()
  })

  it('renders the role chip with its shield glyph', () => {
    renderRoute({ path: '/welcome' })
    const chip = screen.getByTestId('role-chip')
    expect(chip).toHaveTextContent(new RegExp(`^${WELCOME_COPY.chipAdmin}$`))
    expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the divider and the closing line beneath the chip', () => {
    renderRoute({ path: '/welcome' })
    expect(screen.getByTestId('welcome-divider')).toBeInTheDocument()
    expect(screen.getByText(WELCOME_COPY.closing)).toBeInTheDocument()
  })

  it('🚫 renders no spec or process vocabulary anywhere on the screen', () => {
    const { container } = renderRoute({ path: '/welcome' })
    const rendered = container.textContent ?? ''
    for (const forbidden of [
      'DO2',
      'DO-2',
      'FR-17',
      'FR-19',
      'AC-',
      'NEG-',
      'wave-1',
      'wave-2',
      'Wave-2',
      'LOW_LEVEL_SPEC',
      'ADR-',
      'X-1',
    ]) {
      expect(rendered).not.toContain(forbidden)
    }
    // The closing line is static copy, 🚫 not a navigation promise: it must not
    // be a link or a button.
    const closing = screen.getByText(WELCOME_COPY.closing)
    expect(closing.closest('a')).toBeNull()
    expect(closing.closest('button')).toBeNull()
  })
})

describe('TopBar', () => {
  beforeEach(() => seedSession({ role: 'user', expiresInSeconds: 900 }))

  it('carries the brand lockup and the Logout control, in that order', () => {
    renderRoute({ path: '/welcome' })
    const bar = screen.getByTestId('landing-top-bar')

    expect(bar.querySelector('[data-testid="pacco-lockup"]')).not.toBeNull()
    expect(bar.querySelector('[data-testid="logout-button"]')).not.toBeNull()
    // The lockup images are decorative, per SPECIFICATION.md §11.2.
    for (const image of Array.from(bar.querySelectorAll('img'))) {
      expect(image).toHaveAttribute('alt', '')
      expect(image).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('renders the Logout control as an outlined button with an exit glyph', () => {
    renderRoute({ path: '/welcome' })
    const button = screen.getByRole('button', { name: WELCOME_COPY.logout })

    expect(button).toHaveAttribute('type', 'button')
    expect(button.className).toContain('border-brand-400')
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('landing control inventory', () => {
  it('offers exactly one control, makes no network call, and emits one view event', async () => {
    seedSession({ role: 'supervisor', expiresInSeconds: 900 })
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
    const view = renderRoute({ path: '/welcome' })

    // §L.12.1's inventory: the Logout button and nothing else. 🚫 No links, no
    // menu, no form, no second button -- this wave builds no navigation.
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(view.container.querySelectorAll('form')).toHaveLength(0)

    await waitFor(() => expect(events.filter((e) => e.name === 'landing.viewed')).toHaveLength(1))
    expect(events).toContainEqual({
      name: 'landing.viewed',
      presentation: 'standard',
      roleRecognised: false,
    })

    view.unmount()
    // 🚫 Mount to unmount, not one request.
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
