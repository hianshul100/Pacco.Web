/**
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.6.A.3, "Accessibility wiring" (2 cases),
 * plus an automated WCAG 2.1 AA scan of the landing screen.
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

import { LOGIN_COPY } from '@/features/login/copy'
import { WELCOME_COPY } from '@/features/welcome/copy'
import { renderRoute, seedSession } from '../support/renderWelcome'

expect.extend(toHaveNoViolations)

describe('landing screen accessibility', () => {
  it('has no automatically detectable violations', async () => {
    seedSession({ role: 'admin', expiresInSeconds: 900 })
    const { container } = renderRoute({ path: '/welcome' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('names the screen with a single h1 that takes focus on arrival', async () => {
    seedSession({ role: 'admin', expiresInSeconds: 900 })
    renderRoute({ path: '/welcome' })

    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(/^Welcome to Admin Area$/)
    // The card is labelled by that heading, so the region announces itself.
    expect(screen.getByTestId('welcome-card')).toHaveAttribute(
      'aria-labelledby',
      headings[0].getAttribute('id'),
    )
    // Arrival is always the result of a redirect, so focus is moved
    // deliberately instead of being left at the top of a silently changed page.
    await waitFor(() => expect(headings[0]).toHaveFocus())
  })

  it('leaves focus inside the document after the logout redirect, never on a removed node', async () => {
    const user = userEvent.setup()
    seedSession({ role: 'user', expiresInSeconds: 900 })
    renderRoute({ path: '/welcome' })

    const button = screen.getByRole('button', { name: WELCOME_COPY.logout })
    button.focus()
    await user.click(button)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument(),
    )
    expect(button).not.toBeInTheDocument()
    expect(document.activeElement).not.toBeNull()
    expect(document.body.contains(document.activeElement)).toBe(true)
    // The sign-in screen is reachable by keyboard from wherever focus landed.
    await user.tab()
    expect(document.body.contains(document.activeElement)).toBe(true)
  })

  it('reaches the only control by keyboard alone', async () => {
    const user = userEvent.setup()
    seedSession({ role: 'user', expiresInSeconds: 900 })
    renderRoute({ path: '/welcome' })

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
    // The top bar precedes the card in document order, so the Logout control is
    // one shift-tab back from the heading focus lands on.
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: WELCOME_COPY.logout })).toHaveFocus()
  })
})
