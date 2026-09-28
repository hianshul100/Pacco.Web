/**
 * LogoutAction -- the outlined Logout control in the landing screen's top bar.
 *
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.3 item 5 steps 20-24, in order:
 *
 *   1. `SessionStore.clear()` discards the stored session.
 *   2. 🚫 NO network request is made. There is no logout route, no revoke call
 *      and no gateway round trip -- ADR-007 keeps the gateway's JWT validation
 *      stateless and consulting no deny-list, so a client could not revoke
 *      anything by asking.
 *   3. `landing.logout` is emitted, carrying the route and nothing else.
 *   4. The client navigates to the sign-in screen with NO reason key, because
 *      a deliberate sign-out is not a session expiry and must not raise the
 *      expiry notice.
 *
 * ⚠️ STATED LIMITATION, carried here verbatim from §L.3 item 5:
 * "Client-side logout does not invalidate the already-issued token at the
 * platform level. It only ends the browser session, so the token stays
 * acceptable to the gateway and the domain services until it expires."
 * A copy of that token captured before logout therefore remains usable until
 * its own `exp`. Shortening that window is a platform decision (a token
 * lifetime change or an edge revocation list), not a client one.
 */
import { useNavigate } from 'react-router-dom'

import { SignOutGlyph } from '@/components/icons'
import { WELCOME_COPY } from '@/features/welcome/copy'
import { Telemetry } from '@/platform/telemetry'
import { LOGIN_PATH } from '@/routes'
import { SessionStore } from '@/session/sessionStore'

export function LogoutAction({ route }: { readonly route: string }) {
  const navigate = useNavigate()

  function handleLogout() {
    // Step 1. Nothing below this line can observe a session, including a
    // re-render triggered by the navigation.
    SessionStore.clear()
    // Step 3. 🚫 No role, no token, no expiry -- the route only.
    Telemetry.emit({ name: 'landing.logout', route })
    // Step 4. `replace` so the back button cannot return to a screen whose
    // session no longer exists; the guard would bounce it anyway, and this
    // avoids the bounce being visible.
    navigate(LOGIN_PATH, { replace: true })
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      data-testid="logout-button"
      className="inline-flex items-center gap-4 rounded-field border-[1.5px] border-brand-400 bg-surface px-[1.6rem] py-[0.85rem] text-[1.19rem] font-medium leading-snug text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <SignOutGlyph className="h-6 w-6 shrink-0" />
      {WELCOME_COPY.logout}
    </button>
  )
}
