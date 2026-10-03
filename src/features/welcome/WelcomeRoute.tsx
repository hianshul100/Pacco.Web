/**
 * WelcomeRoute -- the role-aware landing screen.
 *
 * 🚫 The route performs NO fetch, on mount or ever. It holds no
 * `gatewayBaseUrl`, imports no `GatewayClient`, and takes no client prop
 * (LOW_LEVEL_SPEC-13652-wave-2.md §L.3 item 3 boundary rule 4). Everything it
 * renders is derived from the session the sign-in already stored.
 *
 * 🚫 The role reaches exactly one function -- `decideRolePresentation` -- and
 * the raw value is never rendered, never put in an attribute and never emitted.
 * Telemetry carries the resulting presentation and a recognised flag instead.
 *
 * ⚠️ Reaching this component means the guard already found a live session.
 * `read()` returning null here would be a contradiction; the null-safe access
 * below resolves to the non-admin presentation rather than assuming a role,
 * which keeps the allow-list's promise intact even in a state that cannot
 * occur.
 */
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { BrandFrame } from '@/components/BrandFrame'
import { TopBar } from '@/features/welcome/TopBar'
import { WelcomeCard } from '@/features/welcome/WelcomeCard'
import { WELCOME_COPY } from '@/features/welcome/copy'
import { decideRolePresentation } from '@/features/welcome/roleDecision'
import { Telemetry } from '@/platform/telemetry'
import { SessionStore } from '@/session/sessionStore'

export function WelcomeRoute() {
  const location = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const presentation = decideRolePresentation(SessionStore.read()?.role)

  useEffect(() => {
    // §L.3 item 9: the event carries the presentation and the recognised flag.
    // 🚫 Never the role string.
    Telemetry.emit({
      name: 'landing.viewed',
      presentation: presentation.presentation,
      roleRecognised: presentation.roleRecognised,
    })
  }, [presentation.presentation, presentation.roleRecognised])

  useEffect(() => {
    // Arriving here is always the result of a redirect -- from sign-in, or from
    // the root path. Moving focus to the page's `h1` means a screen-reader user
    // hears where they landed instead of being left at the top of a document
    // that silently changed underneath them.
    headingRef.current?.focus()
  }, [])

  return (
    <>
      {/* React 19 Document Metadata: the title is declared in the tree. */}
      <title>{WELCOME_COPY.documentTitle}</title>
      <meta name="description" content={WELCOME_COPY.documentDescription} />
      <BrandFrame variant="landing" topBar={<TopBar route={location.pathname} />}>
        <WelcomeCard presentation={presentation} headingRef={headingRef} />
      </BrandFrame>
    </>
  )
}
