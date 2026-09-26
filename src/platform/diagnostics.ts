/**
 * Developer diagnostics -- browser console only, request body redacted.
 *
 * SPECIFICATION.md §5.7: "Diagnostics go to the browser console only, with the
 * request body redacted." SPECIFICATION.md §15: "log nothing from the request
 * body -- not at debug level, not behind a flag, not in development."
 *
 * This module therefore accepts a classification bucket and a correlation id and
 * nothing else. There is no parameter through which an identifier, a password,
 * an access token, a refresh token, a response body or a backend `reason` string
 * could be passed, so the redaction cannot be forgotten at a call site.
 */

export interface DiagnosticNote {
  readonly stage: string
  readonly classification: string
  readonly correlationId: string
}

export function noteFailure(note: DiagnosticNote): void {
  // `console.warn` only. The request body is not a parameter of this function.
  console.warn(
    `[pacco] ${note.stage} failed (classification=${note.classification}, correlationId=${note.correlationId}). Request body redacted.`,
  )
}

export const Diagnostics = { noteFailure }
