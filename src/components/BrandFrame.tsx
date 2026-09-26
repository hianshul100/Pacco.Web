/**
 * BrandFrame -- the decorative page chrome that surrounds every card.
 *
 * Every element here is transcribed from the supplied reference image
 * `02_login-page-ux.png`. 🚫 No chrome is invented that the reference does not
 * show, and no spec or process vocabulary appears in any rendered string.
 *
 * SPECIFICATION.md §11.2: "the brand frame is decorative, not in the tab order,
 * logo carries `alt=\"\"`." Nothing in this component is focusable.
 *
 * Responsive behaviour, also fixed by SPECIFICATION.md §11.2: "single-column
 * below 768px with the right rail hidden and footer stacked; at >=768px the card
 * is centred at a fixed max width", reflowing "without horizontal scrolling at
 * 320px" and usable "at 200% zoom".
 */
import type { ReactNode } from 'react'

import backgroundSrc from '@/assets/office-background.png'
import { PaccoLockup } from '@/components/PaccoLockup'
import { BRAND_COPY } from '@/features/login/copy'

export function BrandFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="pacco-page-gradient relative flex min-h-screen w-full flex-col overflow-x-hidden">
      {/* Reference: the office photograph blended into the right third of the
          page. Decorative only. */}
      <img
        src={backgroundSrc}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 hidden h-full w-[34%] select-none object-cover opacity-[0.28] [mask-image:linear-gradient(to_left,black_30%,transparent_100%)] md:block"
      />
      {/* Reference: two concentric pale arcs sweeping out of the bottom-left
          corner, the outer one fainter than the inner. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-64 -left-64 hidden h-[52rem] w-[52rem] rounded-full bg-brand-100/55 md:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 -left-56 hidden h-[40rem] w-[40rem] rounded-full bg-brand-100/75 md:block"
      />

      <div className="relative mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-5 py-6 md:px-14 md:py-7">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <PaccoLockup size="md" />
          <p className="text-sm leading-snug text-ink-500 md:text-right">
            {BRAND_COPY.taglineLineOne}
            <br />
            {BRAND_COPY.taglineLineTwo}
          </p>
        </header>

        <div className="flex flex-1 flex-col gap-10 py-8 md:flex-row md:items-center md:gap-8 md:py-9">
          {/* Left rail -- decorative headline. */}
          <aside
            aria-hidden="true"
            className="hidden w-full max-w-xs shrink-0 md:block"
            data-testid="brand-left-rail"
          >
            {/* Reference: the break falls after "Everything", so the accent
                phrase stays whole on its own line. */}
            <p className="text-5xl font-bold leading-[1.12] tracking-tight text-ink-900">
              {BRAND_COPY.headlineLeading}
              <br />
              <span className="text-brand-600">{BRAND_COPY.headlineAccent}</span>
            </p>
            <p className="mt-5 text-base leading-relaxed text-ink-500">
              {BRAND_COPY.headlineSupportOne}
              <br />
              {BRAND_COPY.headlineSupportTwo}
            </p>
            <span className="mt-6 block h-[3px] w-12 rounded-pill bg-brand-300" />
          </aside>

          <main className="flex w-full flex-1 items-center justify-center">{children}</main>

          {/* Right rail -- hidden below 768px per SPECIFICATION.md §11.2. */}
          <aside
            aria-hidden="true"
            className="hidden w-full max-w-[12rem] shrink-0 md:block"
            data-testid="brand-right-rail"
          >
            {/* Reference: left-aligned, regular weight, muted ink -- not a
                right-aligned emphasis block. */}
            <ul className="space-y-1.5 text-left text-xl leading-snug text-ink-600">
              {BRAND_COPY.railItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <span className="mt-5 block h-[3px] w-12 rounded-pill bg-brand-300" />
          </aside>
        </div>

        <footer className="mt-auto flex flex-col gap-6 pt-6 md:flex-row md:items-end md:justify-between">
          <div aria-hidden="true" className="order-2 md:order-1">
            <span className="mb-4 block h-[3px] w-8 rounded-pill bg-brand-300" />
            <p className="text-base font-medium leading-snug text-ink-700">
              {BRAND_COPY.nextLineOne}
              <br />
              {BRAND_COPY.nextLineTwo}
            </p>
          </div>
          <div className="order-1 text-center md:order-2 md:flex-1">
            <p className="text-sm text-ink-500">{BRAND_COPY.footerLead}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
              {BRAND_COPY.footerMarks}
            </p>
          </div>
          <div aria-hidden="true" className="order-3 hidden w-24 md:block" />
        </footer>
      </div>
    </div>
  )
}
