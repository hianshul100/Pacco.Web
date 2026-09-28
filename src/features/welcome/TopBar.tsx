/**
 * TopBar -- the landing screen's white band, transcribed from
 * `03_welcome-page-ux.png`: the Pacco lockup at the left, the outlined Logout
 * control at the right, a hairline rule beneath.
 *
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.12.1 fixes the inventory: those two
 * elements and nothing else. 🚫 No navigation links, no menu, no avatar, no
 * search -- the reference shows none, and this wave builds no navigation
 * surface.
 *
 * The band is full-bleed and opaque so it sits over the photograph, and its
 * gutters are the reference's own (79px left, 47px right at native width)
 * rather than the framed container's symmetric ones.
 */
import { PaccoLockup } from '@/components/PaccoLockup'
import { LogoutAction } from '@/features/welcome/LogoutAction'

export function TopBar({ route }: { readonly route: string }) {
  return (
    <header
      data-testid="landing-top-bar"
      className="relative z-10 w-full border-b border-border/60 bg-surface"
    >
      <div className="mx-auto flex w-full max-w-[100rem] items-center justify-between gap-4 px-5 py-4 md:h-[6.2rem] md:py-0 md:pl-[4.9rem] md:pr-[2.9rem]">
        <PaccoLockup size="nav" />
        <LogoutAction route={route} />
      </div>
    </header>
  )
}
