/**
 * Telemetry -- the six `login.*` events of
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 9.
 *
 * 🚫 No event carries an identifier value, a password, a token, a role, or the
 * backend `reason` string. The payload types below make that structural rather
 * than a matter of discipline: there is no field any of those values could
 * legally occupy.
 *
 * Note a deliberate divergence, raised for review rather than silently resolved:
 * SPECIFICATION.md §11.2's telemetry table lists `login.succeeded` properties as
 * `correlationId, role`, while LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 9 states
 * the event carries the correlation id only and that no event carries a role.
 * The stricter low-level rule is implemented here because it also satisfies the
 * §L.6.A.4 NEG anchors. See `needs_architect_review` in the delivery notes.
 */

export type LoginTelemetryEvent =
  | { readonly name: 'login.viewed'; readonly route: string }
  | {
      readonly name: 'login.validation_blocked'
      readonly identifierEmpty: boolean
      readonly passwordEmpty: boolean
    }
  | { readonly name: 'login.submitted'; readonly correlationId: string }
  | { readonly name: 'login.duplicate_suppressed'; readonly correlationId: string }
  | { readonly name: 'login.succeeded'; readonly correlationId: string }
  | {
      readonly name: 'login.failed'
      readonly correlationId: string
      readonly classification: string
    }

export type TelemetrySink = (event: LoginTelemetryEvent) => void

let sink: TelemetrySink | null = null

/** Installs the sink. With no sink installed, events are discarded. */
export function setTelemetrySink(next: TelemetrySink | null): void {
  sink = next
}

export function emit(event: LoginTelemetryEvent): void {
  if (sink === null) {
    return
  }
  try {
    sink(event)
  } catch {
    // A failing analytics sink must never break sign-in.
  }
}

export const Telemetry = { emit, setTelemetrySink }
