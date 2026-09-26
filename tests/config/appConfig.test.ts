import { readAppConfig, readInjectedAppConfig } from '@/config/appConfig'

describe('readAppConfig', () => {
  it('exposes exactly two keys', () => {
    expect(Object.keys(readAppConfig(undefined)).sort()).toEqual([
      'gatewayBaseUrl',
      'signInTimeoutMs',
    ])
  })

  it('uses the injected values when they are usable', () => {
    expect(readAppConfig({ gatewayBaseUrl: 'http://gw.test:9000', signInTimeoutMs: 4321 })).toEqual(
      {
        gatewayBaseUrl: 'http://gw.test:9000',
        signInTimeoutMs: 4321,
      },
    )
  })

  it('strips a trailing slash from the gateway base URL', () => {
    expect(readAppConfig({ gatewayBaseUrl: 'http://localhost:5000//' }).gatewayBaseUrl).toBe(
      'http://localhost:5000',
    )
  })

  it('falls back to the documented local gateway origin when the value is unusable', () => {
    for (const value of ['', '   ', undefined, 5000 as never]) {
      expect(readAppConfig({ gatewayBaseUrl: value as never }).gatewayBaseUrl).toBe(
        'http://localhost:5000',
      )
    }
  })

  it('falls back to the provisional timeout when the value is unusable', () => {
    for (const value of [0, -1, 1.5, '5000' as never, undefined]) {
      expect(readAppConfig({ signInTimeoutMs: value as never }).signInTimeoutMs).toBe(15000)
    }
  })

  it('holds one gateway URL and no per-service URL or container port (ADR-021 §5 rule 3)', () => {
    const config = readAppConfig(undefined)
    expect(config.gatewayBaseUrl).toBe('http://localhost:5000')
    expect(JSON.stringify(config)).not.toMatch(/5004|identity-service|:80\b/)
  })

  it('reads the configuration injected onto the host page', () => {
    window.__PACCO_CONFIG__ = { gatewayBaseUrl: 'http://localhost:5000', signInTimeoutMs: 9000 }
    expect(readInjectedAppConfig()).toEqual({
      gatewayBaseUrl: 'http://localhost:5000',
      signInTimeoutMs: 9000,
    })
    delete window.__PACCO_CONFIG__
  })

  it('boots on the documented defaults when nothing was injected', () => {
    delete window.__PACCO_CONFIG__
    expect(readInjectedAppConfig()).toEqual({
      gatewayBaseUrl: 'http://localhost:5000',
      signInTimeoutMs: 15000,
    })
  })

  it('contains no secret, API key or credential', () => {
    expect(JSON.stringify(readAppConfig(undefined))).not.toMatch(
      /secret|api[-_]?key|password|token/i,
    )
  })
})
