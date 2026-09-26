/**
 * LoginCard -- presentational and fully controlled. It owns no state
 * (LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 3); every value and every handler
 * arrives from `LoginRoute`.
 *
 * Layout transcribed from the supplied reference image `02_login-page-ux.png`:
 * the brand lockup, the heading and sub-heading, the two fields, the full-width
 * primary action, and the centred help link.
 *
 * Focus order, fixed by SPECIFICATION.md §11.2: identifier -> password ->
 * reveal toggle -> Sign in -> Need help. DOM order below matches it exactly and
 * no `tabindex` above 0 is used.
 */
import type { FormEvent, Ref } from 'react'

import { PaccoLockup } from '@/components/PaccoLockup'
import { LOGIN_COPY } from '@/features/login/copy'
import { FormMessage } from '@/features/login/FormMessage'
import { IdentifierField } from '@/features/login/IdentifierField'
import { PasswordField } from '@/features/login/PasswordField'
import { SessionNotice } from '@/features/login/SessionNotice'
import type { SessionNoticeReason } from '@/features/login/SessionNotice'

export interface LoginCardProps {
  readonly identifier: string
  readonly password: string
  readonly identifierInvalid: boolean
  readonly passwordInvalid: boolean
  readonly submitting: boolean
  readonly message: string | null
  readonly noticeReason: SessionNoticeReason | null
  readonly identifierRef: Ref<HTMLInputElement>
  readonly passwordRef: Ref<HTMLInputElement>
  readonly messageRef: Ref<HTMLDivElement>
  onIdentifierChange(value: string): void
  onPasswordChange(value: string): void
  onSubmit(): void
}

const IDENTIFIER_ID = 'login-identifier'
const PASSWORD_ID = 'login-password'
const FORM_MESSAGE_ID = 'login-form-message'

export function LoginCard(props: LoginCardProps) {
  const {
    identifier,
    password,
    identifierInvalid,
    passwordInvalid,
    submitting,
    message,
    noticeReason,
    identifierRef,
    passwordRef,
    messageRef,
    onIdentifierChange,
    onPasswordChange,
    onSubmit,
  } = props

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // `Enter` in either field reaches here as a native form submission,
    // per SPECIFICATION.md §11.2 ("`Enter` in either field submits").
    event.preventDefault()
    onSubmit()
  }

  return (
    <section
      aria-labelledby="login-heading"
      className="w-full max-w-card rounded-card bg-surface px-6 py-8 shadow-card sm:px-12 sm:py-11"
    >
      {/* Reference: the lockup is centred; the heading block beneath it is
          left-aligned to the field column. */}
      <div className="flex justify-center">
        <PaccoLockup size="lg" />
      </div>
      <div className="mt-11">
        <h1 id="login-heading" className="text-3xl font-bold tracking-tight text-ink-900">
          {LOGIN_COPY.heading}
        </h1>
        <p className="mt-1.5 text-base text-ink-500">{LOGIN_COPY.subheading}</p>
      </div>

      {/*
        Two independent regions in FIXED positions. They never displace one
        another: the status region is always above the alert region and both are
        always mounted (§L.3 item 5 step 29).
      */}
      <div className="mt-6 flex flex-col gap-3">
        <SessionNotice reason={noticeReason} />
        <FormMessage ref={messageRef} id={FORM_MESSAGE_ID} message={message} />
      </div>

      <form className="mt-5 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <IdentifierField
          ref={identifierRef}
          id={IDENTIFIER_ID}
          value={identifier}
          invalid={identifierInvalid}
          readOnly={submitting}
          onChange={onIdentifierChange}
        />

        <PasswordField
          ref={passwordRef}
          id={PASSWORD_ID}
          value={password}
          invalid={passwordInvalid}
          readOnly={submitting}
          onChange={onPasswordChange}
        />

        {/*
          SPECIFICATION.md §11.2: while submitting the control "carries
          `aria-busy=\"true\"` and `aria-disabled=\"true\"` ... and its accessible
          name changes to the processing label". `aria-disabled` is used rather
          than the native `disabled` attribute so the control keeps its place in
          the focus order while the request is in flight; the submit path is
          additionally guarded by the lock in `useSignIn`.
        */}
        <button
          type="submit"
          aria-busy={submitting}
          aria-disabled={submitting}
          className={
            submitting
              ? 'w-full cursor-not-allowed rounded-field bg-brand-300 px-4 py-3.5 text-base font-semibold text-white'
              : 'w-full rounded-field bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-700'
          }
        >
          {submitting ? LOGIN_COPY.submitProcessing : LOGIN_COPY.submit}
        </button>

        <a
          href="#login-heading"
          className="self-center text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {LOGIN_COPY.needHelp}
        </a>
      </form>
    </section>
  )
}
