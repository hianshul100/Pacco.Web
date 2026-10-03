/**
 * RequireSession -- the client-side route guard of
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.3 item 5 steps 1-11.
 *
 * It is declared as a PATHLESS LAYOUT ROUTE so protected paths are grouped
 * rather than guarded one at a time (§L.3 item 3 boundary rule 6): adding a
 * protected route means adding a child, and a route cannot be added to the
 * group while forgetting the guard.
 *
 * The decision, in order:
 *
 *   read()            -- null means no session at all: deny with NO reason, so
 *                        the sign-in screen shows no expiry notice to someone
 *                        who simply typed the URL.
 *   isLive(session)   -- 🚫 evaluated on EVERY decision, never cached, never
 *                        memoised, never computed once at mount (ADR-022 rule
 *                        3). It reads the clock at call time, so a session that
 *                        expires between two navigations is caught on the
 *                        second.
 *   clear() FIRST     -- an expired session is discarded BEFORE the redirect,
 *                        so nothing downstream can observe it.
 *   Outlet            -- only a live session reaches the child.
 *
 * 🚫 On a denial the protected route's component tree is never constructed, so
 * nothing is rendered and flashed: `<Outlet />` is simply not returned, and
 * React never mounts the child element.
 *
 * 🚫 There is no renewal path here. ADR-022 rule 5: the session is bounded by
 * the access token's own expiry and is not extended -- no refresh route, no
 * refresh token, no sliding-expiry timer.
 *
 * ⚠️ This is a NAVIGATION guard, not an access control. ADR-006 puts
 * enforcement at the edge: the gateway validates the JWT and matches the role
 * claim on every request regardless of what the browser chose to render.
 */
import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import type { SessionNoticeReason } from '@/features/login/SessionNotice'
import { Telemetry } from '@/platform/telemetry'
import { LOGIN_PATH } from '@/routes'
import { SessionStore } from '@/session/sessionStore'

/**
 * Renders nothing, emits the denial event, and redirects.
 *
 * The event is emitted from an effect rather than from the guard's render so a
 * re-render can never double-count a denial, and the redirect is a `<Navigate>`
 * so react-router owns the history entry.
 */
function GuardDenial({
  reason,
  route,
}: {
  readonly reason: SessionNoticeReason | null
  readonly route: string
}) {
  useEffect(() => {
    Telemetry.emit(
      reason === null
        ? { name: 'landing.blocked_unauthenticated', route }
        : { name: 'landing.session_expired', route },
    )
  }, [reason, route])

  return (
    <Navigate
      to={LOGIN_PATH}
      replace
      // 🚫 The state carries a reason KEY from the client's own closed
      // registry, never a message and never a backend string (ADR-023).
      state={reason === null ? undefined : { reason }}
    />
  )
}

export function RequireSession() {
  const location = useLocation()

  const session = SessionStore.read()

  if (session === null) {
    return <GuardDenial reason={null} route={location.pathname} />
  }

  if (!SessionStore.isLive(session)) {
    // Step 7: clear BEFORE redirecting. `clear()` is idempotent, so a repeated
    // render cannot make this wrong.
    SessionStore.clear()
    return <GuardDenial reason="session_expired" route={location.pathname} />
  }

  return <Outlet />
}
