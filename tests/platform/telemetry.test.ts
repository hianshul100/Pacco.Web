import type { LoginTelemetryEvent } from '@/platform/telemetry'
import { Telemetry } from '@/platform/telemetry'

describe('Telemetry', () => {
  afterEach(() => Telemetry.setTelemetrySink(null))

  it('discards events when no sink is installed', () => {
    expect(() => Telemetry.emit({ name: 'login.viewed', route: '/login' })).not.toThrow()
  })

  it('delivers events to the installed sink', () => {
    const events: LoginTelemetryEvent[] = []
    Telemetry.setTelemetrySink((event) => events.push(event))
    Telemetry.emit({ name: 'login.viewed', route: '/login' })
    expect(events).toEqual([{ name: 'login.viewed', route: '/login' }])
  })

  it('never lets a failing sink break sign-in', () => {
    Telemetry.setTelemetrySink(() => {
      throw new Error('analytics is down')
    })
    expect(() => Telemetry.emit({ name: 'login.succeeded', correlationId: 'c1' })).not.toThrow()
  })

  it('stops delivering once the sink is removed', () => {
    const sink = jest.fn()
    Telemetry.setTelemetrySink(sink)
    Telemetry.setTelemetrySink(null)
    Telemetry.emit({ name: 'login.succeeded', correlationId: 'c1' })
    expect(sink).not.toHaveBeenCalled()
  })
})
