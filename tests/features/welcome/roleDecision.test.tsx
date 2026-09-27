/**
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.6.A.3, "RoleDecision" -- nine cases, each
 * asserting the EXACT rendered heading rather than the returned object, so the
 * allow-list is checked at the surface a user actually sees.
 *
 * The suite renders `WelcomeCard` with the decision the production code
 * produces. A change that made the decision right and the rendering wrong
 * would still fail here.
 */
import { render, screen } from '@testing-library/react'

import { WelcomeCard } from '@/features/welcome/WelcomeCard'
import { WELCOME_COPY } from '@/features/welcome/copy'
import { decideRolePresentation } from '@/features/welcome/roleDecision'

const ADMIN_HEADING = 'Welcome to Admin Area'
const STANDARD_HEADING = 'Welcome'

function renderFor(role: string | null | undefined) {
  return render(<WelcomeCard presentation={decideRolePresentation(role)} />)
}

function heading(): HTMLElement {
  return screen.getByRole('heading', { level: 1 })
}

describe('RoleDecision: the allow-list, asserted through the rendered heading', () => {
  it.each([
    ['admin', ADMIN_HEADING],
    ['Admin', ADMIN_HEADING],
    ['ADMIN', ADMIN_HEADING],
  ])('%p is the Admin presentation whatever its case', (role, expected) => {
    renderFor(role)
    expect(heading()).toHaveTextContent(new RegExp(`^${expected}$`))
  })

  it.each([
    ['user', STANDARD_HEADING],
    ['', STANDARD_HEADING],
    ['   ', STANDARD_HEADING],
    ['administrator', STANDARD_HEADING],
    ['superuser', STANDARD_HEADING],
  ])('%p is the non-Admin presentation', (role, expected) => {
    renderFor(role)
    expect(heading()).toHaveTextContent(new RegExp(`^${expected}$`))
  })

  it('an absent role is the non-Admin presentation, not a default to Admin', () => {
    renderFor(null)
    expect(heading()).toHaveTextContent(new RegExp(`^${STANDARD_HEADING}$`))
    expect(heading().textContent).not.toContain('Admin')
  })

  it('leaves the emphasis span ABSENT rather than empty for the non-Admin heading', () => {
    // §L.12.1: "the emphasis span is absent rather than empty". An empty span
    // would leave a stray inline box in the heading and a trailing space in
    // its accessible name.
    const { container } = renderFor('user')
    expect(container.querySelector('#welcome-heading span')).toBeNull()
    expect(heading().textContent).toBe(STANDARD_HEADING)
  })

  it('never widens the allow-list: `administrator` starts with `admin` and is still standard', () => {
    // A prefix or `startsWith` implementation would pass the three admin cases
    // above and fail here.
    expect(decideRolePresentation('administrator').presentation).toBe('standard')
    expect(decideRolePresentation('admin-readonly').presentation).toBe('standard')
    expect(decideRolePresentation(' admin').presentation).toBe('standard')
  })
})

describe('RoleDecision: a single decision source', () => {
  it('drives the heading and the chip from one decision, so they cannot disagree', () => {
    for (const role of ['admin', 'ADMIN', 'user', '', '   ', 'administrator', 'supervisor']) {
      const { unmount } = renderFor(role)
      const isAdmin = role.toLowerCase() === 'admin'

      expect(heading()).toHaveTextContent(
        new RegExp(`^${isAdmin ? ADMIN_HEADING : STANDARD_HEADING}$`),
      )
      expect(screen.getByTestId('role-chip')).toHaveTextContent(
        new RegExp(`^${isAdmin ? WELCOME_COPY.chipAdmin : WELCOME_COPY.chipStandard}$`),
      )
      unmount()
    }
  })

  it('reports recognition as a boolean over the closed `{user, admin}` vocabulary', () => {
    expect(decideRolePresentation('admin').roleRecognised).toBe(true)
    expect(decideRolePresentation('USER').roleRecognised).toBe(true)
    for (const unrecognised of ['', '   ', 'supervisor', 'administrator']) {
      expect(decideRolePresentation(unrecognised).roleRecognised).toBe(false)
    }
    expect(decideRolePresentation(undefined).roleRecognised).toBe(false)
    expect(decideRolePresentation(null).roleRecognised).toBe(false)
  })
})
