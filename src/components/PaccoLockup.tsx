/**
 * The Pacco brand lockup: the supplied cube mark beside -- or above -- the
 * supplied wordmark.
 *
 * ⚠️ Both images are REAL EXPORTED PIXELS cropped from the supplied asset
 * `01_pacco-logo-1.png`. Nothing here is a redrawn logo and the wordmark is not
 * re-set as text -- see docs/DESIGN_APPROXIMATION.md for the crop provenance.
 *
 * SPECIFICATION.md §11.2: "the brand frame is decorative, not in the tab order,
 * logo carries `alt=\"\"`." Both images are therefore `alt=""` and
 * `aria-hidden`; the accessible brand name comes from the page's own headings.
 *
 * Sizes are measured from the two supplied references at their native 1448px
 * page width: `nav` and `card` are the landing screen's top bar and card
 * lockups from `03_welcome-page-ux.png`, the rest are wave-1's.
 */
import markSrc from '@/assets/pacco-mark.png'
import wordmarkSrc from '@/assets/pacco-wordmark.png'

type LockupSize = 'sm' | 'md' | 'nav' | 'lg' | 'card'

/**
 * `inline` sets the mark beside the wordmark (both references' top bars);
 * `stacked` sets it above and centred, which is what the landing card does.
 */
type LockupOrientation = 'inline' | 'stacked'

const MARK_SIZE: Record<LockupSize, string> = {
  sm: 'h-7 w-auto',
  md: 'h-9 w-auto',
  // Landing top bar: 38x42 at the reference's native width.
  nav: 'h-[2.6rem] w-auto',
  // The card lockup in the reference stands 65px tall at its native 1448px
  // page width.
  lg: 'h-16 w-auto',
  // Landing card: 83px tall, the largest mark either reference uses.
  card: 'h-[5.2rem] w-auto',
}

const WORDMARK_SIZE: Record<LockupSize, string> = {
  sm: 'h-5 w-auto',
  md: 'h-6 w-auto',
  nav: 'h-6 w-auto',
  lg: 'h-10 w-auto',
  // Landing card: 133x37 at native width.
  card: 'h-[2.3rem] w-auto',
}

const LOCKUP_GAP: Record<LockupSize, string> = {
  sm: 'gap-2',
  md: 'gap-2.5',
  nav: 'gap-3',
  lg: 'gap-3.5',
  card: 'gap-[1.2rem]',
}

const ORIENTATION: Record<LockupOrientation, string> = {
  inline: 'inline-flex items-center',
  stacked: 'flex flex-col items-center',
}

export function PaccoLockup({
  size = 'sm',
  orientation = 'inline',
}: {
  readonly size?: LockupSize
  readonly orientation?: LockupOrientation
}) {
  return (
    <span className={`${ORIENTATION[orientation]} ${LOCKUP_GAP[size]}`} data-testid="pacco-lockup">
      <img src={markSrc} alt="" aria-hidden="true" className={MARK_SIZE[size]} />
      <img src={wordmarkSrc} alt="" aria-hidden="true" className={WORDMARK_SIZE[size]} />
    </span>
  )
}
