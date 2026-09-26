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
 *
 * ⚠️ Geometry note. The three-column track below is deliberately
 * `minmax(0,1fr) auto minmax(0,1fr)`: the two rail tracks are EQUAL whatever
 * their content, so the card column sits on the page's own centre line. An
 * earlier flex row with unequal rail widths (`max-w-xs` against `max-w-[12rem]`)
 * pushed the card ~63px right of centre, which the reference does not do. The
 * rails are start-aligned with an explicit top inset for the same reason -- the
 * reference aligns them to the card's upper third, not to its vertical centre.
 * Offsets are measured from `02_login-page-ux.png` at its native 1448x1086.
 */
import type { ReactNode } from 'react'

import backgroundSrc from '@/assets/office-background.png'
import { PaccoLockup } from '@/components/PaccoLockup'
import { BRAND_COPY } from '@/features/login/copy'

export function BrandFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="pacco-page-gradient relative flex min-h-screen w-full flex-col overflow-x-hidden">
      {/* Reference: the office photograph blended into the right third of the
          page -- a legible interior with a defined window mullion, not a wash.
          Two masks are intersected because the reference fades the photo out on
          BOTH axes: leftward into the page field, and downward so the floor is
          gone well before the footer (sampled flat #F6F8FC below y~860 at the
          reference's native 1086px page height). Decorative only. */}
      <img
        src={backgroundSrc}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 hidden h-full w-[31%] select-none object-cover opacity-[0.55] [-webkit-mask-composite:source-in] [mask-composite:intersect] [mask-image:linear-gradient(to_left,black_62%,transparent_100%),linear-gradient(to_bottom,black_0%,black_62%,transparent_82%)] md:block"
      />
      {/* Reference: two concentric pale arcs sweeping out of the bottom-left
          corner, the outer one fainter than the inner. Both circles share the
          centre the reference's arcs are struck from; their radii and offsets
          reproduce where each arc crosses the left and bottom page edges. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[14.9rem] -left-[13.1rem] hidden h-[41.75rem] w-[41.75rem] rounded-full bg-arc-outer md:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[7.9rem] -left-[5.55rem] hidden h-[27.8rem] w-[27.8rem] rounded-full bg-arc-inner md:block"
      />

      <div className="relative mx-auto flex w-full max-w-[100rem] flex-1 flex-col px-5 py-6 md:px-[4.75rem] md:py-[2.2rem]">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <PaccoLockup size="md" />
          <p className="text-sm leading-snug text-ink-500 md:text-right">
            {BRAND_COPY.taglineLineOne}
            <br />
            {BRAND_COPY.taglineLineTwo}
          </p>
        </header>

        <div className="flex flex-1 flex-col gap-10 py-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,35.2rem)_minmax(0,1fr)] md:items-start md:gap-8 md:py-0 md:pt-[4.5rem]">
          {/* Left rail -- decorative headline, start-aligned with the top inset
              the reference uses. */}
          <aside
            aria-hidden="true"
            className="hidden w-full min-w-0 md:block md:pt-[8.6rem]"
            data-testid="brand-left-rail"
          >
            {/* Reference: the break falls after "Everything", so the accent
                phrase stays whole on its own line. */}
            <p className="text-[2.5rem] font-bold leading-[1.15] tracking-tight text-ink-900">
              {BRAND_COPY.headlineLeading}
              <br />
              <span className="text-brand-600">{BRAND_COPY.headlineAccent}</span>
            </p>
            <p className="mt-[1.6rem] text-xl leading-[1.55] text-ink-500">
              {BRAND_COPY.headlineSupportOne}
              <br />
              {BRAND_COPY.headlineSupportTwo}
            </p>
            <span className="mt-8 block h-[3px] w-12 rounded-pill bg-brand-300" />
          </aside>

          <main className="flex w-full min-w-0 items-start justify-center">{children}</main>

          {/* Right rail -- hidden below 768px per SPECIFICATION.md §11.2. The
              left inset places it clear of the backdrop's plant, where the
              reference puts it. */}
          <aside
            aria-hidden="true"
            className="hidden w-full min-w-0 md:block md:pl-[8rem] md:pt-[8.2rem]"
            data-testid="brand-right-rail"
          >
            {/* Reference: left-aligned, regular weight, muted ink -- not a
                right-aligned emphasis block. */}
            <ul className="space-y-1 text-left text-xl leading-snug text-ink-600">
              {BRAND_COPY.railItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <span className="mt-6 block h-[3px] w-10 rounded-pill bg-brand-300" />
          </aside>
        </div>

        <footer className="mt-auto flex flex-col gap-6 pt-6 md:flex-row md:items-start md:justify-between md:pb-[2.7rem] md:pt-[3.5rem]">
          <div aria-hidden="true" className="order-2 md:order-1 md:w-64">
            <span className="mb-4 block h-[3px] w-8 rounded-pill bg-brand-300" />
            <p className="text-base font-medium leading-snug text-ink-700">
              {BRAND_COPY.nextLineOne}
              <br />
              {BRAND_COPY.nextLineTwo}
            </p>
          </div>
          <div className="order-1 text-center md:order-2 md:-mt-6 md:flex-1">
            <p className="text-sm text-ink-500">{BRAND_COPY.footerLead}</p>
            <p className="mt-[1.4rem] text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
              {BRAND_COPY.footerMarks}
            </p>
          </div>
          <div aria-hidden="true" className="order-3 hidden md:block md:w-64" />
        </footer>
      </div>
    </div>
  )
}
