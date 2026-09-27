/**
 * RoleDecision -- the ONE place in the client where a role value is
 * interpreted.
 *
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.3 item 3 boundary rules:
 *
 *   🚫 It is written as an explicit ALLOW-LIST. The Admin presentation is
 *      returned only when the value equals `admin` exactly, after lower-casing.
 *      Every other input -- `user`, an unrecognised value, an empty string, a
 *      whitespace string, an absent field -- returns the non-Admin
 *      presentation.
 *
 *   🚫 It must NEVER be written as `role !== 'user'`. That negation hands the
 *      Admin presentation to every unknown value, which is the exact failure
 *      SPECIFICATION.md forbids ("unknown or unsupported roles must never
 *      default to Admin").
 *
 *   🚫 It receives the role STRING and nothing else. No session object, no
 *      email, no claim bag, no request -- so there is no value it could infer a
 *      role from other than the one the gateway put in the session.
 *
 * 🚫 No component reads `session.role` to decide its own rendering. Every
 * consumer takes the object returned here, which is why the heading and the
 * chip cannot disagree: they are two fields of one decision.
 */
import { WELCOME_COPY } from '@/features/welcome/copy'

/** The closed set of landing presentations. There is no third value. */
export type LandingPresentation = 'admin' | 'standard'

export interface RolePresentation {
  readonly presentation: LandingPresentation
  /** Leading heading text. Reads "Welcome to " for Admin, "Welcome" otherwise. */
  readonly headingLead: string
  /** The brand-coloured emphasis phrase, or `null` when there is none. */
  readonly headingEmphasis: string | null
  /** The chip label: "Admin" or "User". */
  readonly chipLabel: string
  /**
   * Whether the stored role was inside the platform's closed role vocabulary
   * `{ user, admin }`. False for an absent, empty, whitespace or unrecognised
   * value. Telemetry carries this BOOLEAN; 🚫 never the role string itself.
   */
  readonly roleRecognised: boolean
}

/**
 * The platform's closed role vocabulary. Confirmed against the Identity
 * service, which stamps exactly these two values into the `role` claim and
 * defaults a new account to `user`.
 */
const ADMIN_ROLE = 'admin'
const USER_ROLE = 'user'

const ADMIN_PRESENTATION: RolePresentation = {
  presentation: 'admin',
  headingLead: WELCOME_COPY.headingAdminLead,
  headingEmphasis: WELCOME_COPY.headingAdminEmphasis,
  chipLabel: WELCOME_COPY.chipAdmin,
  roleRecognised: true,
}

export function decideRolePresentation(role: string | null | undefined): RolePresentation {
  // An absent field is normalised to the empty string, which is simply one more
  // value the allow-list below does not contain.
  const value = typeof role === 'string' ? role.toLowerCase() : ''

  // ✅ ALLOW-LIST. The only way to reach the Admin presentation is an exact
  // match on the single admin literal.
  if (value === ADMIN_ROLE) {
    return ADMIN_PRESENTATION
  }

  return {
    presentation: 'standard',
    headingLead: WELCOME_COPY.headingStandard,
    // 🚫 Absent, not empty: the consumer renders no emphasis element at all.
    headingEmphasis: null,
    chipLabel: WELCOME_COPY.chipStandard,
    roleRecognised: value === USER_ROLE,
  }
}
