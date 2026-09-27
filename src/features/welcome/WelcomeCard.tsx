/**
 * WelcomeCard -- the landing card, transcribed region by region from
 * `03_welcome-page-ux.png` (LOW_LEVEL_SPEC-13652-wave-2.md §L.12.1):
 *
 *   stacked cube mark above the wordmark
 *   heading            "Welcome to Admin Area" / "Welcome"
 *   supporting line    "You are signed in successfully."
 *   role chip          shield glyph + "Admin" / "User"
 *   divider
 *   closing line       "Use the navigation to continue."
 *
 * 🚫 This component does not read `session.role`, and it contains no branch on
 * a role value. It renders the single `RolePresentation` it is handed, which is
 * why the heading and the chip cannot disagree -- they are two fields of one
 * decision taken in `roleDecision.ts`.
 *
 * 🚫 The emphasis span is ABSENT for the non-admin presentation rather than
 * rendered empty, so the accessible heading name is exactly "Welcome".
 */
import type { RefObject } from 'react'

import { PaccoLockup } from '@/components/PaccoLockup'
import { ShieldCheckGlyph } from '@/components/icons'
import { WELCOME_COPY } from '@/features/welcome/copy'
import type { RolePresentation } from '@/features/welcome/roleDecision'

export function WelcomeCard({
  presentation,
  headingRef,
}: {
  readonly presentation: RolePresentation
  readonly headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <section
      aria-labelledby="welcome-heading"
      data-testid="welcome-card"
      className="w-full max-w-landing-card rounded-card bg-surface px-6 py-10 text-center shadow-card sm:px-[3.25rem] sm:pb-[4.5rem] sm:pt-[3.9rem]"
    >
      <PaccoLockup size="card" orientation="stacked" />

      <h1
        id="welcome-heading"
        ref={headingRef}
        tabIndex={-1}
        data-testid="welcome-heading"
        className="mt-[2.3rem] text-[2.5rem] font-bold leading-[1.15] tracking-landing-heading text-ink-900 outline-none"
      >
        {presentation.headingLead}
        {presentation.headingEmphasis === null ? null : (
          <span className="text-brand-600">{presentation.headingEmphasis}</span>
        )}
      </h1>

      <p className="mt-[0.875rem] text-[1.3rem] leading-snug text-ink-500">
        {WELCOME_COPY.supporting}
      </p>

      {/* The chip reports the presentation the gateway's claim resolved to.
          ⚠️ It is a label, not a control and not an authorisation decision:
          ADR-006 keeps enforcement at the edge, where the gateway matches the
          role claim before a request ever reaches a domain service. */}
      <p
        data-testid="role-chip"
        className="mt-[1.6rem] inline-flex items-center gap-[1.05rem] rounded-pill bg-surface-chip px-[1.65rem] py-[0.8rem] text-xl font-medium leading-snug text-brand-600"
      >
        <ShieldCheckGlyph className="h-7 w-7 shrink-0" />
        {presentation.chipLabel}
      </p>

      <span
        aria-hidden="true"
        data-testid="welcome-divider"
        className="mx-auto mt-[2.1rem] block h-[2px] w-[13.2rem] bg-border/60"
      />

      {/* 🚫 Static copy. §L.12.1: "not a promise of navigation." */}
      <p className="mt-[1.85rem] text-[1.1rem] leading-snug text-ink-500">{WELCOME_COPY.closing}</p>
    </section>
  )
}
