/**
 * PasswordField -- fully controlled except for the local reveal boolean, which
 * is the only state it owns (LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 3).
 *
 * SPECIFICATION.md §11.2: "the reveal control is a `<button type=\"button\">`
 * with `aria-pressed` and an accessible name of Show password / Hide password",
 * and the focus order is identifier -> password -> reveal toggle -> Sign in ->
 * Need help, which is why the button follows the input in DOM order.
 *
 * ⚠️ The password value appears in exactly ONE DOM node: this input's `value`
 * property. §L.6.A.3 asserts it is present "in no other DOM node" -- not in a
 * hidden input, not in a `value`/`data-*`/`aria-*` attribute, and not in the
 * accessibility tree. Nothing below writes it anywhere else.
 *
 * §L.14 Q6: the reveal control deliberately does NOT persist across
 * navigations -- it resets to masked whenever the field is remounted.
 */
import { forwardRef, useState } from 'react'

import { EyeGlyph, EyeOffGlyph, LockGlyph } from '@/components/icons'
import { LOGIN_COPY } from '@/features/login/copy'

export interface PasswordFieldProps {
  readonly id: string
  readonly value: string
  readonly invalid: boolean
  readonly readOnly: boolean
  onChange(value: string): void
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ id, value, invalid, readOnly, onChange }, ref) {
    const [revealed, setRevealed] = useState(false)
    const helpId = `${id}-help`
    const errorId = `${id}-error`

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold text-ink-800">
          {LOGIN_COPY.passwordLabel}
        </label>

        <div className="relative">
          <LockGlyph className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
          <input
            ref={ref}
            id={id}
            name="password"
            type={revealed ? 'text' : 'password'}
            autoComplete="current-password"
            className={
              invalid
                ? 'w-full rounded-field border border-danger-600 bg-surface py-[1.1rem] pl-11 pr-12 text-base text-ink-900 shadow-field placeholder:text-ink-400 read-only:bg-surface-sunken read-only:text-ink-500'
                : 'w-full rounded-field border border-border bg-surface py-[1.1rem] pl-11 pr-12 text-base text-ink-900 shadow-field placeholder:text-ink-400 read-only:bg-surface-sunken read-only:text-ink-500'
            }
            value={value}
            readOnly={readOnly}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${errorId} ${helpId}` : helpId}
            onChange={(event) => onChange(event.target.value)}
          />
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-pressed={revealed}
            aria-controls={id}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-field text-ink-500 hover:bg-surface-sunken hover:text-ink-700"
          >
            {revealed ? <EyeOffGlyph className="h-5 w-5" /> : <EyeGlyph className="h-5 w-5" />}
            {/* The accessible name. It describes the control's action; it never
                contains or reflects the field value. */}
            <span className="sr-only">
              {revealed ? LOGIN_COPY.hidePassword : LOGIN_COPY.showPassword}
            </span>
          </button>
        </div>

        {invalid ? (
          <p id={errorId} className="text-sm font-medium text-danger-700">
            {LOGIN_COPY.passwordRequired}
          </p>
        ) : null}

        <p id={helpId} className="text-sm text-ink-500">
          {LOGIN_COPY.passwordHelp}
        </p>
      </div>
    )
  },
)
