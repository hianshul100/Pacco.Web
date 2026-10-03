/**
 * The client's closed message registry.
 *
 * ADR-023 §5 rule 3: "The message set is closed and owned by the client. Adding
 * a message is a change to the client's copy, reviewed as copy. A backend adding
 * a new code does not add a message anywhere."
 *
 * These four strings are the ONLY user-facing failure strings the client can
 * render. Every one of them is fixed by SPECIFICATION.md §5.7 except the
 * session-expired notice -- see the warning on that entry.
 *
 * 🚫 No backend `reason`, HTTP status, header or response text ever appears
 * here or is ever rendered -- ADR-023 §5 rules 1 and 2.
 */

export type MessageKey = 'credentials' | 'unavailable' | 'generic' | 'session_expired'

export const MESSAGE_REGISTRY: Readonly<Record<MessageKey, string>> = {
  /**
   * SPECIFICATION.md §5.7 EF-1 and EF-2 resolve to the SAME string.
   * ADR-023 §5 rule 6: "`invalid_credentials` and `invalid_email` resolve to the
   * same message. The client must not help a user discover whether an account
   * exists, and must never surface an echoed email address from a reason
   * string." (The EF-2 body echoes the submitted value; it is never read.)
   */
  credentials: 'The email or password you entered is incorrect.',

  /** SPECIFICATION.md §5.7 EF-3, EF-4 and EF-6. */
  unavailable: 'Sign-in is temporarily unavailable. Please try again.',

  /**
   * SPECIFICATION.md §5.7 EF-5 and EF-7, and the default arm of the mapping --
   * ADR-023 §5 rule 4: "Unknown resolves to generic, by construction."
   */
  generic: 'Something went wrong. Please try again.',

  /**
   * ⚠️ PROVISIONAL WORDING -- flagged for review, not invented silently.
   * LOW_LEVEL_SPEC-13652-wave-1.md §L.14 Q2 records that no source fixes this
   * sentence. ADR-022 §5 rule 4 fixes only its properties: it must be "textually
   * distinct from the invalid-credentials message" and carry "no technical
   * detail, status code or token value". Wave-1 supplies the registry entry so
   * the wave-2 expiry path has somewhere to read from.
   */
  session_expired: 'Your session has ended. Please sign in again to continue.',
}

export function messageFor(key: MessageKey): string {
  return MESSAGE_REGISTRY[key]
}
