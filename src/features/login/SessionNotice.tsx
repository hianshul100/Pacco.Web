/**
 * SessionNotice -- the `role="status"` region for a redirect reason.
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.2.2 places this component and its
 * `session_expired` registry entry in wave-1, as the seam the wave-2 expiry path
 * reads from. §L.3 item 5 steps 26-29: the router inspects a redirect REASON KEY
 * -- never a message -- and `SessionNotice` renders the registry entry into its
 * own region.
 *
 * ⚠️ `SessionNotice` and `FormMessage` are different regions with different ARIA
 * roles (`status` vs `alert`) and NEVER displace one another: both are rendered,
 * in fixed positions, by `LoginCard`.
 *
 * ADR-022 §5 rule 4: the session-expired text is "textually distinct from the
 * invalid-credentials message" and carries "no technical detail, status code or
 * token value".
 */
import type { MessageKey } from '@/session/messageRegistry'
import { messageFor } from '@/session/messageRegistry'

/**
 * The closed set of redirect reasons the router may hand to this region.
 * A reason is a KEY, never a message string.
 */
export type SessionNoticeReason = 'session_expired'

const REASON_TO_MESSAGE_KEY: Readonly<Record<SessionNoticeReason, MessageKey>> = {
  session_expired: 'session_expired',
}

export function SessionNotice({ reason }: { readonly reason: SessionNoticeReason | null }) {
  return (
    <div
      role="status"
      data-testid="session-notice"
      className={
        reason === null
          ? 'hidden'
          : 'rounded-field border border-notice-200 bg-notice-50 px-4 py-3 text-sm font-medium text-notice-700'
      }
    >
      {reason === null ? null : messageFor(REASON_TO_MESSAGE_KEY[reason])}
    </div>
  )
}
