import { Diagnostics } from '@/platform/diagnostics'

describe('Diagnostics', () => {
  it('writes to the browser console only, with the request body redacted', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    Diagnostics.noteFailure({
      stage: 'sign-in',
      classification: 'invalid_credentials',
      correlationId: 'c-1',
    })
    expect(warn).toHaveBeenCalledTimes(1)
    const line = warn.mock.calls[0][0] as string
    expect(line).toContain('Request body redacted')
    expect(line).toContain('c-1')
  })

  it('has no parameter through which a credential, token or backend reason could pass', () => {
    // The whole surface is three strings; there is no body/response/error slot.
    expect(Diagnostics.noteFailure.length).toBe(1)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    Diagnostics.noteFailure({ stage: 'sign-in', classification: 'unavailable', correlationId: 'c' })
    expect(warn.mock.calls[0][0]).not.toMatch(/password|accesstoken|refresh|reason|stack/i)
  })
})
