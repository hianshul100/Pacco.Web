/**
 * FormMessage -- the single form-level failure message.
 *
 * SPECIFICATION.md §11.2: "form-level message in a container with
 * `role=\"alert\"`."
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 8 invariant 3: exactly one message is
 * shown; it is REPLACED, never stacked. This component renders a single string
 * and has no list.
 *
 * ⚠️ The `message` prop is always a string selected from the client's closed
 * registry (`messageRegistry.ts`). No backend `reason`, status line, header,
 * URL fragment or stack frame can reach it -- ADR-023 §5 rules 1 and 2.
 *
 * The container is always mounted so assistive technology observes a live region
 * change rather than a region appearing, and so `LoginRoute` always has a focus
 * target (§L.3 item 5 step 24: "moves focus to it").
 */
import { forwardRef } from 'react'

export interface FormMessageProps {
  readonly id: string
  readonly message: string | null
}

export const FormMessage = forwardRef<HTMLDivElement, FormMessageProps>(function FormMessage(
  { id, message },
  ref,
) {
  return (
    <div
      ref={ref}
      id={id}
      role="alert"
      tabIndex={-1}
      data-testid="form-message"
      className={
        message === null
          ? 'hidden'
          : 'rounded-field border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700'
      }
    >
      {message}
    </div>
  )
})
