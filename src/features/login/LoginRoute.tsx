/**
 * LoginRoute -- owns the two field values and orchestrates the execution steps
 * of LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 5.
 *
 * 🚫 The route performs NO fetch on mount. SPECIFICATION.md §11.2: "No loading
 * state on entry -- the route performs no fetch on mount."
 *
 * 🚫 The password value lives in this component's state only for as long as the
 * user is typing it, is passed to `useSignIn.submit` as an argument, and is
 * cleared on every settled submission. It never reaches `SessionStore`,
 * `Telemetry`, `Diagnostics`, `ErrorMapper` or any logging call
 * (§L.3 item 3 boundary rules).
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { LoginCard } from '@/features/login/LoginCard'
import type { SessionNoticeReason } from '@/features/login/SessionNotice'
import { useSignIn } from '@/features/login/useSignIn'
import type { GatewayClient } from '@/gateway/gatewayClient'
import { Telemetry } from '@/platform/telemetry'
import { WELCOME_PATH } from '@/routes'

/**
 * The route the client navigates to on success.
 *
 * Derived from the route table so the destination and the registered path
 * cannot drift apart. The landing screen it resolves to is registered behind
 * `RequireSession` (LOW_LEVEL_SPEC-13652-wave-2.md §L.3 item 5).
 */
export const POST_SIGN_IN_PATH = WELCOME_PATH

/** The closed set of redirect reason keys. A reason is a KEY, never a message. */
function readNoticeReason(state: unknown): SessionNoticeReason | null {
  if (typeof state !== 'object' || state === null) {
    return null
  }
  const reason = (state as { reason?: unknown }).reason
  return reason === 'session_expired' ? 'session_expired' : null
}

export function LoginRoute({ client }: { readonly client: GatewayClient }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [identifierInvalid, setIdentifierInvalid] = useState(false)
  const [passwordInvalid, setPasswordInvalid] = useState(false)

  const identifierRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  /** Set when a failure message must take focus after the next paint. */
  const focusMessageRef = useRef(false)

  const navigate = useNavigate()
  const location = useLocation()
  const signIn = useSignIn(client)

  const noticeReason = readNoticeReason(location.state)

  useEffect(() => {
    // §L.3 item 5 step 3: emit on view. The event carries the route and nothing
    // else.
    Telemetry.emit({ name: 'login.viewed', route: location.pathname })
  }, [location.pathname])

  useEffect(() => {
    if (focusMessageRef.current && signIn.message !== null) {
      focusMessageRef.current = false
      // §L.3 item 5 step 24: focus moves to the single rendered message.
      messageRef.current?.focus()
    }
  }, [signIn.message])

  function clearMessagesOnType() {
    // §L.3 item 5 step 5: typing clears any message.
    signIn.clearMessage()
  }

  function handleIdentifierChange(value: string) {
    setIdentifier(value)
    setIdentifierInvalid(false)
    clearMessagesOnType()
  }

  function handlePasswordChange(value: string) {
    setPassword(value)
    setPasswordInvalid(false)
    clearMessagesOnType()
  }

  async function handleSubmit() {
    // §L.3 item 5 steps 7-9: the ONLY client validation is "non-empty after
    // trimming", applied to both values.
    // 🚫 No email-shape check runs in the browser -- the edge contract owns that
    // and returns `invalid_email` (SPECIFICATION.md ASM-10).
    const identifierEmpty = identifier.trim().length === 0
    const passwordEmpty = password.trim().length === 0

    if (identifierEmpty || passwordEmpty) {
      setIdentifierInvalid(identifierEmpty)
      setPasswordInvalid(passwordEmpty)
      Telemetry.emit({
        name: 'login.validation_blocked',
        identifierEmpty,
        passwordEmpty,
      })
      // Focus the first empty field, then STOP. No request is made.
      if (identifierEmpty) {
        identifierRef.current?.focus()
      } else {
        passwordRef.current?.focus()
      }
      return
    }

    // The identifier is handed over verbatim, untrimmed of case
    // (§L.3 item 5 step 13).
    const result = await signIn.submit(identifier, password)

    if (result.outcome === 'suppressed') {
      // The lock was already held; the in-flight request owns the outcome.
      return
    }

    if (result.outcome === 'success') {
      // §L.3 item 5 step 18: clear BOTH field values, then navigate.
      setIdentifier('')
      setPassword('')
      navigate(POST_SIGN_IN_PATH, { replace: true })
      return
    }

    // §L.3 item 5 step 24: on failure clear the password value and KEEP the
    // identifier value, then move focus to the message.
    setPassword('')
    focusMessageRef.current = true
  }

  return (
    <LoginCard
      identifier={identifier}
      password={password}
      identifierInvalid={identifierInvalid}
      passwordInvalid={passwordInvalid}
      submitting={signIn.status === 'submitting'}
      message={signIn.message}
      noticeReason={noticeReason}
      identifierRef={identifierRef}
      passwordRef={passwordRef}
      messageRef={messageRef}
      onIdentifierChange={handleIdentifierChange}
      onPasswordChange={handlePasswordChange}
      onSubmit={() => {
        void handleSubmit()
      }}
    />
  )
}
