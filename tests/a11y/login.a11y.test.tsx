/**
 * Automated WCAG 2.1 AA scan, required by
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.5 with ZERO violations, and by
 * §L.7.2 rule 1 ("WCAG 2.1 AA is the bar for every screen").
 */
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

import { LOGIN_COPY } from '@/features/login/copy'
import { MESSAGE_REGISTRY } from '@/session/messageRegistry'
import { recordingClient, statusResponse } from '../support/factories'
import { renderLogin } from '../support/renderLogin'

expect.extend(toHaveNoViolations)

const AA_RULES = {
  runOnly: { type: 'tag' as const, values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  // `color-contrast` (WCAG 1.4.3) cannot be evaluated here and is disabled
  // rather than left to report a false pass: jsdom applies no stylesheet and
  // implements no canvas, so axe-core has no rendered colour to measure.
  // Contrast is checked instead against the rendered screenshot.
  rules: { 'color-contrast': { enabled: false } },
}

describe('WCAG 2.1 AA', () => {
  it('reports zero violations on the sign-in screen at rest', async () => {
    const { container } = renderLogin({ client: recordingClient([]) })
    expect(await axe(container, AA_RULES)).toHaveNoViolations()
  }, 30000)

  it('reports zero violations with both fields marked invalid', async () => {
    const user = userEvent.setup()
    const { container } = renderLogin({ client: recordingClient([]) })
    await user.click(screen.getByRole('button', { name: LOGIN_COPY.submit }))
    expect(await axe(container, AA_RULES)).toHaveNoViolations()
  }, 30000)

  it('reports zero violations with a form-level message shown', async () => {
    const user = userEvent.setup()
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = renderLogin({
      client: recordingClient([statusResponse(400, { code: 'invalid_credentials' })]),
    })
    await user.type(screen.getByLabelText(LOGIN_COPY.identifierLabel), 'someone@pacco.io')
    await user.type(screen.getByLabelText(LOGIN_COPY.passwordLabel), 'secret-value')
    await user.click(screen.getByRole('button', { name: LOGIN_COPY.submit }))
    await screen.findByText(MESSAGE_REGISTRY.credentials)
    expect(await axe(container, AA_RULES)).toHaveNoViolations()
  }, 30000)

  it('reports zero violations with the session notice shown', async () => {
    const { container } = renderLogin({
      client: recordingClient([]),
      initialEntry: { pathname: '/login', state: { reason: 'session_expired' } },
    })
    expect(await axe(container, AA_RULES)).toHaveNoViolations()
  }, 30000)
})
