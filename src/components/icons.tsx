/**
 * Decorative field glyphs, transcribed from the reference image
 * `02_login-page-ux.png` (an envelope inside the identifier field, a padlock
 * inside the password field, an eye for the reveal control).
 *
 * ⚠️ These are UI affordances, not brand assets. The Pacco logo is NEVER
 * redrawn here -- it is the supplied export `src/assets/pacco-logo.png`, used
 * as-is.
 *
 * The landing screen adds two more from `03_welcome-page-ux.png` -- a shield
 * for the role chip and an exit bracket for the Logout control -- drawn in the
 * same outline style so the two screens do not diverge.
 *
 * All of them are `aria-hidden` and carry no accessible name: each sits beside
 * a real `<label>`, inside a button that names itself, or next to visible text.
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

/**
 * The shield inside the landing screen's role chip, transcribed from
 * `03_welcome-page-ux.png`: a shield outline with a check mark struck through
 * it, drawn in the same OUTLINE style as the field glyphs above -- 🚫 not a
 * filled badge.
 *
 * The reference draws the landing glyphs a shade heavier than the field glyphs,
 * which is why the stroke is 1.8 rather than 1.6.
 *
 * ⚠️ Presentation only. The chip reports what the gateway already decided; it
 * is not an authorisation control. ADR-006 keeps enforcement at the edge.
 */
export function ShieldCheckGlyph({ className }: GlyphProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.6 4.7 5.5v5.7c0 4.6 3 8.3 7.3 9.7 4.3-1.4 7.3-5.1 7.3-9.7V5.5Z" />
      <path d="m8.8 11.9 2.3 2.3 4.1-4.5" />
    </svg>
  )
}

/**
 * The exit glyph inside the Logout control, transcribed from
 * `03_welcome-page-ux.png`: a bracket open to the right with an arrow leaving
 * through the opening. Outline style, matching `ShieldCheckGlyph`.
 */
export function SignOutGlyph({ className }: GlyphProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14.4 4.2H7.1a2.4 2.4 0 0 0-2.4 2.4v10.8a2.4 2.4 0 0 0 2.4 2.4h7.3" />
      <path d="m15.7 8.2 3.9 3.8-3.9 3.8" />
      <path d="M19.6 12H9.4" />
    </svg>
  )
}
