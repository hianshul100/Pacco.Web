/**
 * Landing-screen render helpers.
 *
 * Every helper renders the REAL route table, so what a test exercises is the
 * guard and the routes as they are wired in `src/Router.tsx` -- not a
 * hand-assembled tree that could pass while the real one is unguarded.
 */
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { Router } from '@/Router'
import { RequireSession } from '@/features/welcome/RequireSession'
import type { GatewayClient } from '@/gateway/gatewayClient'
import { SESSION_STORAGE_KEY } from '@/session/sessionStore'
import { accessTokenExpiringInSeconds } from './factories'

/**
 * A `GatewayClient` that fails the test if it is ever called.
 *
 * 🚫 The landing screen makes no network call, on mount or on logout
 * (LOW_LEVEL_SPEC-13652-wave-2.md §L.3 item 3 boundary rule 4). Handing the
 * router a client that throws turns that from a review note into a test
 * failure.
 */
export function forbiddenClient(): GatewayClient {
  return {
    signIn() {
      throw new Error('The landing screen must make no gateway call.')
    },
  }
}

/**
 * Writes a session record DIRECTLY into storage rather than through
 * `SessionStore.write`, so a test can seed a role value -- including an
 * unrecognised one -- without the write path normalising it, and can seed an
 * already-expired record that `write` would still happily store.
 */
export function seedSession({
  role = 'user',
  expiresInSeconds = 900,
  accessToken,
}: {
  role?: string
  expiresInSeconds?: number
  accessToken?: string
} = {}): { accessToken: string; expiresAt: number } {
  const token = accessToken ?? accessTokenExpiringInSeconds(expiresInSeconds)
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds
  window.sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ accessToken: token, role, expiresAt, expiresRaw: expiresAt }),
  )
  return { accessToken: token, expiresAt }
}

/** Reports the current location so a redirect can be asserted on. */
export function LocationProbe() {
  const location = useLocation()
  return (
    <span
      data-testid="location"
      data-pathname={location.pathname}
      data-reason={String((location.state as { reason?: unknown } | null)?.reason ?? '')}
    />
  )
}

export interface RenderRouteOptions {
  readonly path?: string
  readonly client?: GatewayClient
}

/** Renders the real route table at `path`, with a location probe alongside. */
export function renderRoute({
  path = '/welcome',
  client = forbiddenClient(),
}: RenderRouteOptions = {}): RenderResult {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Router client={client} />
      <LocationProbe />
    </MemoryRouter>,
  )
}

/**
 * Renders the guard around a sentinel child, so a test can assert the child's
 * tree was NEVER CONSTRUCTED on a denial rather than merely absent from the
 * DOM.
 */
export function renderGuardWith({
  path = '/welcome',
  onChildConstructed,
}: {
  path?: string
  onChildConstructed: () => void
}): RenderResult {
  function Sentinel() {
    onChildConstructed()
    return <p>protected content</p>
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireSession />}>
          <Route path="/welcome" element={<Sentinel />} />
        </Route>
        <Route path="/login" element={<p>sign-in screen</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}
