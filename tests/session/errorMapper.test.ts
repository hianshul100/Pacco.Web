/**
 * ErrorMapper -- 100% branch coverage is a contract, not an aspiration
 * (LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.5).
 */
import { ErrorMapper } from '@/session/errorMapper'
import { MESSAGE_REGISTRY } from '@/session/messageRegistry'

describe('ErrorMapper', () => {
  it('maps a transport failure to the unavailable message', () => {
    expect(ErrorMapper.mapOutcome({ bucket: 'transport' })).toEqual({
      messageKey: 'unavailable',
      classification: 'unavailable',
    })
  })

  it.each(['invalid_credentials', 'invalid_email'])(
    'maps the recognised 400 code %s to the credentials message',
    (code) => {
      expect(ErrorMapper.mapOutcome({ bucket: 'http_400', code })).toEqual({
        messageKey: 'credentials',
        classification: 'invalid_credentials',
      })
    },
  )

  it('resolves invalid_credentials and invalid_email to the SAME string, so account existence is not disclosed (ADR-023 §5 rule 6)', () => {
    const wrongPassword = ErrorMapper.mapOutcome({
      bucket: 'http_400',
      code: 'invalid_credentials',
    })
    const notAnEmail = ErrorMapper.mapOutcome({ bucket: 'http_400', code: 'invalid_email' })
    expect(MESSAGE_REGISTRY[wrongPassword.messageKey]).toBe(MESSAGE_REGISTRY[notAnEmail.messageKey])
  })

  it('maps an unrecognised 400 code to the generic message and never to the code itself', () => {
    const mapped = ErrorMapper.mapOutcome({ bucket: 'http_400', code: 'account_locked_out' })
    expect(mapped).toEqual({ messageKey: 'generic', classification: 'unexpected' })
    expect(MESSAGE_REGISTRY[mapped.messageKey]).not.toContain('account_locked_out')
  })

  it('maps a 400 with no usable code to the generic message', () => {
    expect(ErrorMapper.mapOutcome({ bucket: 'http_400' })).toEqual({
      messageKey: 'generic',
      classification: 'unexpected',
    })
  })

  it('maps any other status to the generic message', () => {
    expect(ErrorMapper.mapOutcome({ bucket: 'other_status' })).toEqual({
      messageKey: 'generic',
      classification: 'unexpected',
    })
  })

  it('maps a malformed 200 to the generic message with the malformed classification', () => {
    expect(ErrorMapper.mapOutcome({ bucket: 'malformed' })).toEqual({
      messageKey: 'generic',
      classification: 'malformed',
    })
  })

  it('is pure: the same descriptor always yields the same result', () => {
    const descriptor = { bucket: 'http_400', code: 'invalid_credentials' } as const
    expect(ErrorMapper.mapOutcome(descriptor)).toEqual(ErrorMapper.mapOutcome(descriptor))
  })
})
