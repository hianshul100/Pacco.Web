/**
 * The negative, security and conformance anchors NEG-1 to NEG-15 of
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.6.A.4, run as a NAMED SUITE.
 *
 * ⚠️ Three of the fifteen cannot run inside jsdom and are NOT asserted here as
 * if they had:
 *
 *   NEG-11 / X-6 -- a machine caller with no `Origin` header must still
 *                   succeed. That is a property of the running gateway, not of
 *                   this client. `npm run verify:edge` drives it against the
 *                   Docker Compose stack and reports NOT RUN when the stack is
 *                   down.
 *   NEG-13       -- an observation run over the live platform.
 *   E2E-13 / N6  -- post-logout token replay, which is a MEASUREMENT of the
 *                   stated limitation rather than a gate. Same script.
 *
 * NEG-10's static half is held by `tests/gateway/corsConfiguration.test.ts`
 * against the real `ntrada*.yml` files, and extended below.
 */
import { join } from 'node:path'

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LOGIN_COPY } from '@/features/login/copy'
import { WELCOME_COPY } from '@/features/welcome/copy'
import { decideRolePresentation } from '@/features/welcome/roleDecision'
import { Telemetry } from '@/platform/telemetry'
import type { TelemetryEvent } from '@/platform/telemetry'
import { MESSAGE_REGISTRY } from '@/session/messageRegistry'
import { SESSION_STORAGE_KEY, SessionStore } from '@/session/sessionStore'
import { renderRoute, seedSession } from '../support/renderWelcome'
import { SRC_ROOT, codeOf, sourceFiles } from '../support/sourceScan'

const WAVE_2_DIR = join(SRC_ROOT, 'features', 'welcome')
const wave2Files = () => sourceFiles(WAVE_2_DIR)

/**
 * `role` compared against a ROLE value. The `typeof` tag names are excluded:
 * `typeof candidate.role !== 'string'` asserts a shape, it does not decide what
 * a role means.
 */
const ROLE_VALUE_COMPARISON =
  /\brole\s*[!=]==\s*['"`](?!string\b|number\b|boolean\b|object\b|undefined\b|function\b|symbol\b|bigint\b)/

/**
 * A gateway route reached for logout. Matches a path literal or a revoke/
 * sign-out call -- NOT the user-facing `logout: 'Logout'` label in `copy.ts`,
 * which is a word on a button and reaches nothing.
 */
const LOGOUT_ROUTE = /['"`]\/[\w/-]*(logout|revoke|sign-?out)\b/i

/** A revocation call, under any name. */
const REVOKE_CALL = /\brevoke\w*\s*\(/i

let events: TelemetryEvent[]

beforeEach(() => {
  events = []
  Telemetry.setTelemetrySink((event) => events.push(event))
})

afterEach(() => Telemetry.setTelemetrySink(null))

describe('landing negative anchors', () => {
  it('NEG-1: an unrecognised role never reaches the Admin presentation', async () => {
    for (const role of ['supervisor', 'administrator', 'root', 'ADMIN_READONLY', '   ']) {
      seedSession({ role, expiresInSeconds: 900 })
      const view = renderRoute({ path: '/welcome' })
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Welcome$/)
      expect(screen.getByTestId('role-chip')).toHaveTextContent(
        new RegExp(`^${WELCOME_COPY.chipStandard}$`),
      )
      view.unmount()
      window.sessionStorage.clear()
    }
  })

  it('NEG-1 (absent role): an empty role is rejected by the store, so no screen is reached', async () => {
    // A record whose `role` is empty is not a session at all -- wave-1's
    // `read()` refuses to reconstruct it -- so the guard sees an absent
    // session and denies. The Admin presentation is unreachable by this route
    // too, which is the point of the anchor.
    seedSession({ role: '', expiresInSeconds: 900 })
    expect(SessionStore.read()).toBeNull()

    renderRoute({ path: '/welcome' })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument(),
    )
    // The decision itself agrees, for the same value taken directly.
    expect(decideRolePresentation('').presentation).toBe('standard')
    expect(decideRolePresentation('').roleRecognised).toBe(false)
  })

  it('NEG-2: the role decision is written as an allow-list, never as a negation of `user`', () => {
    const code = codeOf(join(WAVE_2_DIR, 'roleDecision.ts'))
    // 🚫 `role !== 'user'` hands Admin to every unknown value.
    expect(code).not.toMatch(/!==\s*['"`]user['"`]/)
    expect(code).not.toMatch(/!=\s*['"`]user['"`]/)
    expect(code).not.toMatch(/\.startsWith\s*\(\s*['"`]admin/)
    expect(code).not.toMatch(/\.includes\s*\(\s*['"`]admin/)
    // ✅ The admin branch is an equality against the single admin literal.
    expect(code).toMatch(/value\s*===\s*ADMIN_ROLE/)
  })

  it('NEG-3: no component outside the role decision branches on a role value', () => {
    for (const path of sourceFiles()) {
      if (path === join(WAVE_2_DIR, 'roleDecision.ts')) {
        continue
      }
      const code = codeOf(path)
      expect(code).not.toMatch(/===\s*['"`]admin['"`]/i)
      expect(code).not.toMatch(/!==\s*['"`]admin['"`]/i)
      // `session.role` may be READ and handed to the decision, but never
      // compared in place. A `typeof candidate.role !== 'string'` shape check
      // is not a branch on a role VALUE, so the tag names are excluded.
      expect(code).not.toMatch(ROLE_VALUE_COMPARISON)
    }
  })

  it('NEG-4: an `admin@` address whose stored role is `user` renders the standard screen', async () => {
    // 🚫 The role is never inferred from the identifier. The decision receives
    // the role string and nothing else, so the address cannot reach it.
    seedSession({ role: 'user', expiresInSeconds: 900 })
    renderRoute({ path: '/welcome' })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Welcome$/)
    expect(screen.getByTestId('role-chip')).toHaveTextContent(
      new RegExp(`^${WELCOME_COPY.chipStandard}$`),
    )
  })

  it('NEG-5: the guard denies every protected path, not only the one it was written for', async () => {
    renderRoute({ path: '/welcome' })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument(),
    )
    // Protected routes are declared as a GROUP, so the guard is not attached
    // per path and cannot be forgotten on the next one.
    const router = codeOf(join(SRC_ROOT, 'Router.tsx'))
    expect(router).toMatch(/<Route element=\{<RequireSession \/>\}>/)
  })

  it('NEG-6: after logout and after expiry, no storage key holds a token, role or expiry', async () => {
    const user = userEvent.setup()
    const { accessToken } = seedSession({ role: 'admin', expiresInSeconds: 900 })
    renderRoute({ path: '/welcome' })
    await user.click(screen.getByRole('button', { name: WELCOME_COPY.logout }))
    await waitFor(() => expect(SessionStore.read()).toBeNull())
    expectNoResidue(accessToken)

    const expired = seedSession({ role: 'admin', expiresInSeconds: -1 })
    renderRoute({ path: '/welcome' })
    await waitFor(() =>
      expect(screen.getAllByText(MESSAGE_REGISTRY.session_expired).length).toBeGreaterThan(0),
    )
    expectNoResidue(expired.accessToken)
  })

  it('NEG-7: no raw role value reaches the DOM or telemetry', async () => {
    seedSession({ role: 'supervisor', expiresInSeconds: 900 })
    const { container } = renderRoute({ path: '/welcome' })

    await waitFor(() => expect(events.some((e) => e.name === 'landing.viewed')).toBe(true))
    expect(container.innerHTML).not.toContain('supervisor')
    expect(JSON.stringify(events)).not.toContain('supervisor')
    expect(JSON.stringify(events)).not.toMatch(/"role"\s*:/)
  })

  it('NEG-8: no landing module calls SessionStore.write at all', () => {
    for (const path of wave2Files()) {
      expect(codeOf(path)).not.toMatch(/SessionStore\.write\s*\(/)
      // 🚫 Nor is the store wrapped, extended, re-exported or duplicated.
      expect(codeOf(path)).not.toMatch(/export\s+(const|function)\s+\w*Session(Store|Repository)\b/)
    }
  })

  it('NEG-9: a conflicting role elsewhere is ignored; only the session record decides', async () => {
    window.sessionStorage.setItem('pacco.role', 'admin')
    window.localStorage.setItem('role', 'admin')
    seedSession({ role: 'user', expiresInSeconds: 900 })

    renderRoute({ path: '/welcome?role=admin' })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Welcome$/)
    expect(events).toContainEqual({
      name: 'landing.viewed',
      presentation: 'standard',
      roleRecognised: true,
    })
    window.localStorage.clear()
  })

  it('NEG-12: no refresh route, refresh token or renewal timer exists anywhere', () => {
    for (const path of sourceFiles()) {
      const code = codeOf(path)
      expect(code).not.toMatch(/\brefreshToken\b/)
      expect(code).not.toMatch(/['"`]\/(auth\/)?refresh['"`]/)
      expect(code).not.toMatch(/\brenewSession\b|\bextendSession\b|\bslidingExpiry\b/)
    }
    // 🚫 No timer drives the session's lifetime: ADR-022 rule 5 bounds it by
    // the token's own `exp`, which is read at decision time instead.
    for (const path of wave2Files()) {
      const code = codeOf(path)
      expect(code).not.toMatch(/setInterval\s*\(|setTimeout\s*\(/)
    }
  })

  it('NEG-14: no landing module imports GatewayClient or holds a gateway URL', () => {
    for (const path of wave2Files()) {
      const code = codeOf(path)
      expect(code).not.toMatch(/gatewayClient|GatewayClient/)
      expect(code).not.toMatch(/gatewayBaseUrl/)
      expect(code).not.toMatch(/\bfetch\s*\(/)
      expect(code).not.toMatch(/localhost:\d+/)
    }
  })

  it('NEG-15: a session-expired state never returns to authenticated without a new sign-in', async () => {
    seedSession({ role: 'admin', expiresInSeconds: -1 })
    renderRoute({ path: '/welcome' })
    await waitFor(() =>
      expect(screen.getAllByText(MESSAGE_REGISTRY.session_expired).length).toBeGreaterThan(0),
    )
    expect(SessionStore.read()).toBeNull()

    // Re-entering the protected path does not resurrect anything: the record
    // was cleared, so the guard sees an absent session.
    renderRoute({ path: '/welcome' })
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: LOGIN_COPY.heading }).length).toBeGreaterThan(
        0,
      ),
    )
    expect(SessionStore.read()).toBeNull()
  })

  it('NEG-10 (client half): the landing screen adds no logout or revoke gateway route', () => {
    // The gateway-config half runs in `tests/gateway/corsConfiguration.test.ts`
    // against the real `ntrada*.yml` files. This is the client's obligation:
    // logout reaches no route because it issues no request.
    for (const path of wave2Files()) {
      const code = codeOf(path)
      expect(code).not.toMatch(LOGOUT_ROUTE)
      expect(code).not.toMatch(REVOKE_CALL)
    }
    // `logout` survives in `copy.ts` as the WORD ON THE BUTTON. That is the
    // whole of it: a label, reaching nothing.
    expect(codeOf(join(WAVE_2_DIR, 'copy.ts'))).toMatch(/logout:\s*'Logout'/)
  })

  it('records the stated limitation of a client-side logout in the source itself', () => {
    // ⚠️ The limitation is load-bearing: a reader who does not know the token
    // survives logout will assume this control revokes it. Line wrapping in the
    // comment is not part of the claim, so whitespace is normalised first.
    const logout = readSource(join(WAVE_2_DIR, 'LogoutAction.tsx'))
      .replace(/^\s*\*/gm, ' ')
      .replace(/\s+/g, ' ')
    expect(logout).toContain('does not invalidate the already-issued token at the platform level')
  })
})

function expectNoResidue(accessToken: string): void {
  expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  for (const storage of [window.sessionStorage, window.localStorage]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) as string
      const value = storage.getItem(key) ?? ''
      expect(value).not.toContain(accessToken)
      expect(value).not.toMatch(/expiresAt|"role"/)
    }
  }
  expect(document.cookie).not.toContain(accessToken)
}

function readSource(path: string): string {
  // Comments included on purpose: this assertion is about the documentation.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('node:fs') as typeof import('node:fs')).readFileSync(path, 'utf8')
}

describe('landing anchors that cannot run in jsdom', () => {
  it.each([
    ['NEG-11 / X-6', 'a machine caller with no Origin header still succeeds'],
    ['NEG-13', 'an observation run over the live platform'],
    ['E2E-13 / N6', 'post-logout token replay against the running gateway'],
  ])('%s is delegated to the edge conformance script, not silently passed', (_anchor, _what) => {
    // 🚫 These are NOT asserted as passing here. The script below drives them
    // against the Docker Compose stack and exits 2 (NOT RUN) when it is down,
    // which is what the PR reports.
    const script = readSource(join(SRC_ROOT, '..', 'scripts', 'edge-conformance-check.mjs'))
    expect(script).toContain('EXIT_NOT_RUN')
    expect(script).toContain('NOT RUN')
  })

  it('the role decision agrees with the platform vocabulary the gateway stamps', () => {
    // The Identity service issues exactly `admin` and `user` and defaults a new
    // account to `user`; the gateway maps the role claim URI onto `role`.
    expect(decideRolePresentation('admin').roleRecognised).toBe(true)
    expect(decideRolePresentation('user').roleRecognised).toBe(true)
    expect(decideRolePresentation('anything-else').roleRecognised).toBe(false)
  })
})
