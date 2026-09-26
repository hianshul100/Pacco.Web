/**
 * IdentifierField -- fully controlled; owns no state.
 *
 * SPECIFICATION.md §11.2: "every field has a programmatically associated visible
 * `<label>` and placeholder is never the only label; field errors referenced by
 * `aria-describedby` with `aria-invalid=\"true\"`."
 *
 * ⚠️ ASM-10, carried as an open question rather than silently resolved: the
 * label reads "Email or Username" while the edge contract accepts an email only
 * and `identity-service` validates against `EmailRegex`. The contract wins, so
 * this field applies NO email-shape check in the browser -- the only client
 * validation is "non-empty after trimming"
 * (LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 5 step 8).
 */
import { forwardRef } from 'react'

import { EnvelopeGlyph } from '@/components/icons'
import { LOGIN_COPY } from '@/features/login/copy'

export interface IdentifierFieldProps {
  readonly id: string
  readonly value: string
  readonly invalid: boolean
  readonly readOnly: boolean
  onChange(value: string): void
}

export const IdentifierField = forwardRef<HTMLInputElement, IdentifierFieldProps>(
  function IdentifierField({ id, value, invalid, readOnly, onChange }, ref) {
    const helpId = `${id}-help`
    const errorId = `${id}-error`

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold text-ink-800">
          {LOGIN_COPY.identifierLabel}
        </label>

        <div className="relative">
          <EnvelopeGlyph className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
          <input
            ref={ref}
            id={id}
            name="identifier"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={
              invalid
                ? 'w-full rounded-field border border-danger-600 bg-surface py-[1.1rem] pl-11 pr-3.5 text-base text-ink-900 shadow-field placeholder:text-ink-400 read-only:bg-surface-sunken read-only:text-ink-500'
                : 'w-full rounded-field border border-border bg-surface py-[1.1rem] pl-11 pr-3.5 text-base text-ink-900 shadow-field placeholder:text-ink-400 read-only:bg-surface-sunken read-only:text-ink-500'
            }
            placeholder={LOGIN_COPY.identifierPlaceholder}
            value={value}
            readOnly={readOnly}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${errorId} ${helpId}` : helpId}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>

        {invalid ? (
          <p id={errorId} className="text-sm font-medium text-danger-700">
            {LOGIN_COPY.identifierRequired}
          </p>
        ) : null}

        <p id={helpId} className="text-sm text-ink-500">
          {LOGIN_COPY.identifierHelp}
        </p>
      </div>
    )
  },
)
