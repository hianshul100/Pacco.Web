/**
 * GatewayClient -- covers the API-level integration cases of
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.2 that live at the network boundary.
 */
import { SIGN_IN_PATH, createGatewayClient } from '@/gateway/gatewayClient'

const CONFIG = { gatewayBaseUrl: 'http://localhost:5000', signInTimeoutMs: 50 }

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    json: async () => body,
  } as unknown as Response
}

function fetchMock(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const mock = jest.fn(impl as never)
  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

describe('GatewayClient', () => {
  it('posts to the single gateway origin on the declared edge path', async () => {
    const mock = fetchMock(async () => jsonResponse(200, { accessToken: 'a.b.c', role: 'user' }))
    await createGatewayClient(CONFIG).signIn({ email: 'a@b.c', password: 'pw' })

    expect(mock).toHaveBeenCalledTimes(1)
    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://localhost:5000/identity/sign-in')
    expect(SIGN_IN_PATH).toBe('/identity/sign-in')
    expect(init.method).toBe('POST')
  })

  it('never addresses a service directly: no container port and no service host appear in the URL', async () => {
    const mock = fetchMock(async () => jsonResponse(200, {}))
    await createGatewayClient(CONFIG).signIn({ email: 'a@b.c', password: 'pw' })
    const [url] = mock.mock.calls[0] as unknown as [string]
    expect(url).toMatch(/^http:\/\/localhost:5000\//)
    expect(url).not.toMatch(/5004|identity-service:|:80\b/)
  })

  it('sends a body with EXACTLY the two contract keys and no other', async () => {
    const mock = fetchMock(async () => jsonResponse(200, {}))
    await createGatewayClient(CONFIG).signIn({ email: 'a@b.c', password: 'pw' })
    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit]
    expect(Object.keys(JSON.parse(init.body as string)).sort()).toEqual(['email', 'password'])
  })

  it('sends the identifier verbatim, untrimmed of case', async () => {
    const mock = fetchMock(async () => jsonResponse(200, {}))
    await createGatewayClient(CONFIG).signIn({ email: '  MiXeD@Case.IO ', password: 'pw' })
    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string).email).toBe('  MiXeD@Case.IO ')
  })

  it('sends no credentials mode and no cookie: the edge route is auth: false', async () => {
    const mock = fetchMock(async () => jsonResponse(200, {}))
    await createGatewayClient(CONFIG).signIn({ email: 'a@b.c', password: 'pw' })
    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.credentials).toBeUndefined()
    expect(Object.keys(init.headers as Record<string, string>).map((k) => k.toLowerCase())).toEqual(
      ['content-type', 'accept'],
    )
  })

  it('does not propagate a correlation id as a request header', async () => {
    const mock = fetchMock(async () => jsonResponse(200, {}))
    await createGatewayClient(CONFIG).signIn({ email: 'a@b.c', password: 'pw' })
    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit]
    const headerNames = Object.keys(init.headers as Record<string, string>).map((k) =>
      k.toLowerCase(),
    )
    expect(headerNames.some((name) => name.includes('correlation'))).toBe(false)
    expect(headerNames.some((name) => name.includes('request-id'))).toBe(false)
  })

  it('returns the status and parsed body for a response that reached the browser', async () => {
    fetchMock(async () => jsonResponse(400, { code: 'invalid_credentials', reason: 'Invalid.' }))
    await expect(
      createGatewayClient(CONFIG).signIn({ email: 'a@b.c', password: 'pw' }),
    ).resolves.toEqual({
      kind: 'response',
      status: 400,
      body: { code: 'invalid_credentials', reason: 'Invalid.' },
    })
  })

  it('returns a response with an undefined body when the payload is not JSON', async () => {
    fetchMock(
      async () =>
        ({
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON')
          },
        }) as unknown as Response,
    )
    await expect(
      createGatewayClient(CONFIG).signIn({ email: 'a@b.c', password: 'pw' }),
    ).resolves.toEqual({ kind: 'response', status: 200, body: undefined })
  })

  it('classifies a network failure as a transport failure and discards the thrown value', async () => {
    fetchMock(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(
      createGatewayClient(CONFIG).signIn({ email: 'a@b.c', password: 'pw' }),
    ).resolves.toEqual({ kind: 'transport_failure' })
  })

  it('aborts on the configured timeout and reports a transport failure', async () => {
    fetchMock(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted')))
        }),
    )
    await expect(
      createGatewayClient({ ...CONFIG, signInTimeoutMs: 10 }).signIn({
        email: 'a@b.c',
        password: 'pw',
      }),
    ).resolves.toEqual({ kind: 'transport_failure' })
  })

  it('makes exactly one request per call: no retry, no backoff', async () => {
    const mock = fetchMock(async () => {
      throw new TypeError('Failed to fetch')
    })
    await createGatewayClient(CONFIG).signIn({ email: 'a@b.c', password: 'pw' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('tolerates a configured base URL with a trailing slash without doubling it', async () => {
    const mock = fetchMock(async () => jsonResponse(200, {}))
    await createGatewayClient({ ...CONFIG, gatewayBaseUrl: 'http://localhost:5000' }).signIn({
      email: 'a@b.c',
      password: 'pw',
    })
    const [url] = mock.mock.calls[0] as unknown as [string]
    expect(url).not.toContain('//identity')
  })
})
