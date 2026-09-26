/**
 * The Pacco brand lockup: the supplied cube mark beside the supplied wordmark.
 *
 * ⚠️ Both images are REAL EXPORTED PIXELS cropped from the supplied asset
 * `01_pacco-logo-1.png`. Nothing here is a redrawn logo and the wordmark is not
 * re-set as text -- see docs/DESIGN_APPROXIMATION.md for the crop provenance.
 *
 * SPECIFICATION.md §11.2: "the brand frame is decorative, not in the tab order,
 * logo carries `alt=\"\"`." Both images are therefore `alt=""` and
 * `aria-hidden`; the accessible brand name comes from the page's own headings.
 */
import markSrc from '@/assets/pacco-mark.png'
import wordmarkSrc from '@/assets/pacco-wordmark.png'

type LockupSize = 'sm' | 'md' | 'lg'

const MARK_SIZE: Record<LockupSize, string> = {
  sm: 'h-7 w-auto',
  md: 'h-9 w-auto',
  // The card lockup in the reference stands 65px tall at its native 1448px
  // page width.
  lg: 'h-16 w-auto',
}

const WORDMARK_SIZE: Record<LockupSize, string> = {
  sm: 'h-5 w-auto',
  md: 'h-6 w-auto',
  lg: 'h-10 w-auto',
}

const LOCKUP_GAP: Record<LockupSize, string> = {
  sm: 'gap-2',
  md: 'gap-2.5',
  lg: 'gap-3.5',
}

export function PaccoLockup({ size = 'sm' }: { readonly size?: LockupSize }) {
  return (
    <span className={`inline-flex items-center ${LOCKUP_GAP[size]}`} data-testid="pacco-lockup">
      <img src={markSrc} alt="" aria-hidden="true" className={MARK_SIZE[size]} />
      <img src={wordmarkSrc} alt="" aria-hidden="true" className={WORDMARK_SIZE[size]} />
    </span>
  )
}
