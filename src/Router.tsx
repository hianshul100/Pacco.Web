/**
 * The route table. ADR-004 treats this as a reviewed artifact, so the whole
 * path vocabulary and every guard is visible in one screen.
 *
 * 🚫 Wave-2 ADDS entries; it replaces none. `/login` resolves exactly as
 * wave-1 left it, and `/`'s anonymous resolution is wave-1's -- still the
 * sign-in screen rendered in place, NOT a redirect to `/login`. The only thing
 * wave-2 adds to `/` is the live-session branch above it
 * (LOW_LEVEL_SPEC-13652-wave-2.md §L.3 item 5 steps 25-30).
 */
import { Navigate, Route, Routes } from 'react-router-dom'

import { BrandFrame } from '@/components/BrandFrame'
import { LoginRoute } from '@/features/login/LoginRoute'
import { RequireSession } from '@/features/welcome/RequireSession'
import { WelcomeRoute } from '@/features/welcome/WelcomeRoute'
import type { GatewayClient } from '@/gateway/gatewayClient'
import { LOGIN_PATH, ROOT_PATH, WELCOME_PATH } from '@/routes'
import { SessionStore } from '@/session/sessionStore'

/** The sign-in screen inside the brand frame, exactly as wave-1 renders it. */
function LoginScreen({ client }: { readonly client: GatewayClient }) {
  return (
    <>
      {/* React 19 Document Metadata: the title is declared in the tree. */}
      <title>Sign in · Pacco</title>
      <meta name="description" content="Sign in to your Pacco account." />
      <BrandFrame>
        <LoginRoute client={client} />
      </BrandFrame>
    </>
  )
}

/**
 * The root path.
 *
 * Someone who already has a live session should not be shown a sign-in form
 * they do not need, so the root resolves forward to the landing screen. 🚫 The
 * liveness check reads the clock at call time and is not cached, for the same
 * reason the guard's is not (ADR-022 rule 3).
 */
function RootRoute({ client }: { readonly client: GatewayClient }) {
  if (SessionStore.isLive(SessionStore.read())) {
    return <Navigate to={WELCOME_PATH} replace />
  }
  // Wave-1's anonymous resolution, untouched.
  return <LoginScreen client={client} />
}

export function Router({ client }: { readonly client: GatewayClient }) {
  return (
    <Routes>
      <Route path={ROOT_PATH} element={<RootRoute client={client} />} />
      <Route path={LOGIN_PATH} element={<LoginScreen client={client} />} />
      {/* Protected routes are declared as a GROUP: a new protected path is a
          new child here, and cannot be added without the guard. */}
      <Route element={<RequireSession />}>
        <Route path={WELCOME_PATH} element={<WelcomeRoute />} />
      </Route>
      <Route path="*" element={null} />
    </Routes>
  )
}
