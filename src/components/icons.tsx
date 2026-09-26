/**
 * Decorative field glyphs, transcribed from the reference image
 * `02_login-page-ux.png` (an envelope inside the identifier field, a padlock
 * inside the password field, an eye for the reveal control).
 *
 * ⚠️ These are UI affordances, not brand assets. The Pacco logo is NEVER
 * redrawn here -- it is the supplied export `src/assets/pacco-logo.png`, used
 * as-is.
 *
 * All three are `aria-hidden` and carry no accessible name: each sits beside a
 * real `<label>` or inside a button that names itself.
 */
type GlyphProps = {
  readonly className?: string
}

export function EnvelopeGlyph({ className }: GlyphProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.6 7 7.3 5.3a2 2 0 0 0 2.2 0L20.4 7" />
    </svg>
  )
}

export function LockGlyph({ className }: GlyphProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  )
}

export function EyeGlyph({ className }: GlyphProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffGlyph({ className }: GlyphProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4.5 20 20" />
      <path d="M9.9 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4" />
      <path d="M6.3 8.1A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 3.6-.7" />
      <path d="M10 10.1a3 3 0 0 0 4.1 4.2" />
    </svg>
  )
}
