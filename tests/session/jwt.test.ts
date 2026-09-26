import { readAccessTokenExpiry } from '@/session/jwt'
import { accessTokenWithClaims } from '../support/factories'

describe('readAccessTokenExpiry', () => {
  it('reads an integer exp claim as seconds since epoch', () => {
    expect(readAccessTokenExpiry(accessTokenWithClaims({ exp: 1893456000 }))).toBe(1893456000)
  })

  it('returns null when the exp claim is absent', () => {
    expect(readAccessTokenExpiry(accessTokenWithClaims({ sub: 'someone' }))).toBeNull()
  })

  it('returns null when the exp claim is not an integer', () => {
    expect(readAccessTokenExpiry(accessTokenWithClaims({ exp: 1893456000.5 }))).toBeNull()
    expect(readAccessTokenExpiry(accessTokenWithClaims({ exp: '1893456000' }))).toBeNull()
    expect(readAccessTokenExpiry(accessTokenWithClaims({ exp: null }))).toBeNull()
  })

  it('returns null when the payload is not an object', () => {
    expect(readAccessTokenExpiry(accessTokenWithClaims([] as never))).toBeNull()
    expect(
      readAccessTokenExpiry(
        `${Buffer.from('{}').toString('base64')}.${Buffer.from('7').toString('base64')}.sig`,
      ),
    ).toBeNull()
  })

  it('returns null when the token has fewer than two segments', () => {
    expect(readAccessTokenExpiry('not-a-token')).toBeNull()
    expect(readAccessTokenExpiry('')).toBeNull()
  })

  it('returns null when the payload segment is empty or undecodable', () => {
    expect(readAccessTokenExpiry('header..signature')).toBeNull()
    expect(readAccessTokenExpiry('header.@@@not-base64@@@.signature')).toBeNull()
  })

  it('returns null when the payload segment is not JSON', () => {
    const payload = Buffer.from('this is not json', 'utf8').toString('base64url')
    expect(readAccessTokenExpiry(`header.${payload}.signature`)).toBeNull()
  })

  it('never throws on a hostile value', () => {
    expect(() => readAccessTokenExpiry(undefined as never)).not.toThrow()
    expect(readAccessTokenExpiry(undefined as never)).toBeNull()
    expect(readAccessTokenExpiry(42 as never)).toBeNull()
  })
})
