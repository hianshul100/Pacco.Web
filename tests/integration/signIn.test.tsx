/**
 * API-level integration cases of LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.2,
 * exercised end-to-end through the real components with the network boundary
 * stubbed.
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LOGIN_COPY } from '@/features/login/copy'
import type { TelemetryEvent } from '@/platform/telemetry'
import { Telemetry } from '@/platform/telemetry'
import { MESSAGE_REGISTRY } from '@/session/messageRegistry'
import { SESSION_STORAGE_KEY, SessionStore } from '@/session/sessionStore'
import {
  accessTokenExpiringInSeconds,
  accessTokenWithClaims,
  authDto,
  okResponse,
  pendingClient,
  recordingClient,
  statusResponse,
  transportFailure,
} from '../support/factories'
import { renderLogin } from '../support/renderLogin'

const identifierField = () => screen.getByLabelText(LOGIN_COPY.identifierLabel)
const passwordField = () => screen.getByLabelText(LOGIN_COPY.passwordLabel)
const submitButton = () => screen.getByRole('button', { name: LOGIN_COPY.submit })

async function signIn(
  user: ReturnType<typeof userEvent.setup>,
  identifier = 'someone@pacco.io',
  password = 'Correct-Horse-Battery-9',
) {
  await user.type(identifierField(), identifier)
  await user.type(passwordField(), password)
  await user.click(submitButton())
}

let events: TelemetryEvent[]

beforeEach(() => {
  events = []
  Telemetry.setTelemetrySink((event) => events.push(event))
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => Telemetry.setTelemetrySink(null))

describe('sign-in round trip', () => {
  it('case 1: a 200 AuthDto writes the session and clears both fields', async () => {
    const user = userEvent.setup()
    const token = accessTokenWithClaims({ exp: 1893456000 })
    renderLogin({ client: recordingClient([okResponse(authDto({ accessToken: token }))]) })

    await signIn(user)

    await waitFor(() => expect(SessionStore.read()).not.toBeNull())
    expect(SessionStore.read()).toEqual({
      accessToken: token,
      role: 'user',
      expiresAt: 1893456000,
      expiresRaw: 1893456000,
    })
  })

  it('case 2: the role is lower-cased on write and never normalised into the closed vocabulary', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([okResponse(authDto({ role: 'ADMIN' }))]) })
    await signIn(user)
    await waitFor(() => expect(SessionStore.read()?.role).toBe('admin'))
  })

  it('case 3: an unrecognised role is stored as received, not defaulted to admin', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([okResponse(authDto({ role: 'Supervisor' }))]) })
    await signIn(user)
    await waitFor(() => expect(SessionStore.read()?.role).toBe('supervisor'))
    expect(SessionStore.read()?.role).not.toBe('admin')
  })

  it('case 4: expiry comes from the token exp claim, never from AuthDto.expires', async () => {
    const user = userEvent.setup()
    // A FUTURE `exp`, so the session survives the landing guard and can still
    // be read once the journey completes. The point of the case is that
    // `expiresAt` follows the claim and not `AuthDto.expires`; an already-past
    // claim would additionally be discarded by `RequireSession`, which is
    // asserted separately in the landing-guard suite.
    const token = accessTokenWithClaims({ exp: 1893456000 })
    renderLogin({
      client: recordingClient([okResponse(authDto({ accessToken: token, expires: 999 }))]),
    })
    await signIn(user)
    await waitFor(() => expect(SessionStore.read()?.expiresAt).toBe(1893456000))
    expect(SessionStore.read()?.expiresRaw).toBe(999)
  })

  it('case 5: HTTP 400 invalid_credentials shows the credentials message and writes no session', async () => {
    const user = userEvent.setup()
    renderLogin({
      client: recordingClient([
        statusResponse(400, { code: 'invalid_credentials', reason: 'Invalid credentials.' }),
      ]),
    })
    await signIn(user)
    await screen.findByText(MESSAGE_REGISTRY.credentials)
    expect(SessionStore.read()).toBeNull()
  })

  it('case 6: HTTP 400 invalid_email is indistinguishable from wrong credentials', async () => {
    const user = userEvent.setup()
    const { container } = renderLogin({
      client: recordingClient([
        statusResponse(400, {
          code: 'invalid_email',
          reason: 'Invalid email: someone@pacco.io.',
        }),
      ]),
    })
    await signIn(user)
    await screen.findByText(MESSAGE_REGISTRY.credentials)
    // The 400 body echoes the submitted value; it must never be rendered.
    expect(container.textContent ?? '').not.toContain('Invalid email')
  })

  it('case 7: an unrecognised 400 code resolves to the generic message and is never rendered', async () => {
    const user = userEvent.setup()
    const { container } = renderLogin({
      client: recordingClient([statusResponse(400, { code: 'account_locked', reason: 'Locked.' })]),
    })
    await signIn(user)
    await screen.findByText(MESSAGE_REGISTRY.generic)
    expect(container.textContent ?? '').not.toContain('account_locked')
  })

  it('case 8: a 400 with no usable code resolves to the generic message', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([statusResponse(400, { reason: 'nothing usable' })]) })
    await signIn(user)
    await screen.findByText(MESSAGE_REGISTRY.generic)
  })

  it('case 9: no branch exists on HTTP 401 — it is handled as any other status', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([statusResponse(401, { code: 'invalid_credentials' })]) })
    await signIn(user)
    // Were a 401 branch present it would render the credentials message.
    await screen.findByText(MESSAGE_REGISTRY.generic)
  })

  it('case 10: a transport failure shows the unavailable message and leaves the screen usable', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([transportFailure()]) })
    await signIn(user)
    await screen.findByText(MESSAGE_REGISTRY.unavailable)
    expect(submitButton()).toBeEnabled()
    expect(identifierField()).not.toHaveAttribute('readonly')
  })

  it('case 11: a 200 missing accessToken is malformed and writes no session', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([okResponse({ role: 'user', expires: 1 })]) })
    await signIn(user)
    await screen.findByText(MESSAGE_REGISTRY.generic)
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('case 12: a 200 missing role is malformed and writes no session', async () => {
    const user = userEvent.setup()
    renderLogin({
      client: recordingClient([okResponse({ accessToken: accessTokenExpiringInSeconds(60) })]),
    })
    await signIn(user)
    await screen.findByText(MESSAGE_REGISTRY.generic)
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('case 13: the request body carries exactly email and password and no other key', async () => {
    const user = userEvent.setup()
    const client = recordingClient([okResponse(authDto())])
    renderLogin({ client })
    await signIn(user)
    await waitFor(() => expect(client.requests).toHaveLength(1))
    expect(Object.keys(client.requests[0]).sort()).toEqual(['email', 'password'])
  })

  it('case 14: the refresh token is read by no statement, in no storage key and on no session field', async () => {
    const user = userEvent.setup()
    const refreshToken = 'refresh-token-value-the-client-must-never-read'
    const { container } = renderLogin({
      client: recordingClient([okResponse(authDto({ refreshToken }))]),
    })
    await signIn(user)
    await waitFor(() => expect(SessionStore.read()).not.toBeNull())

    expect(SessionStore.read()).not.toHaveProperty('refreshToken')
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index) as string
      expect(key).not.toMatch(/refresh/i)
      expect(window.sessionStorage.getItem(key) ?? '').not.toContain(refreshToken)
    }
    expect(window.localStorage.length).toBe(0)
    expect(container.innerHTML).not.toContain(refreshToken)
    expect(document.cookie).not.toContain(refreshToken)
  })

  it('case 15: a 200 whose access token has no readable exp claim is malformed and writes no session', async () => {
    const user = userEvent.setup()
    renderLogin({
      client: recordingClient([
        okResponse(authDto({ accessToken: accessTokenWithClaims({ sub: 'no-exp-claim' }) })),
      ]),
    })
    await signIn(user)
    await screen.findByText(MESSAGE_REGISTRY.generic)
    expect(SessionStore.read()).toBeNull()
  })
})

describe('telemetry sequence', () => {
  it('emits viewed, submitted and succeeded on the happy path, carrying no identifier, token or role', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([okResponse(authDto())]) })
    await signIn(user)
    await waitFor(() => expect(SessionStore.read()).not.toBeNull())

    // The journey now completes: the success navigation resolves to the
    // landing screen, which emits its own view event. The `login.*` prefix is
    // still the whole of the sign-in sequence, in order.
    expect(events.map((event) => event.name)).toEqual([
      'login.viewed',
      'login.submitted',
      'login.succeeded',
      'landing.viewed',
    ])
    const serialised = JSON.stringify(events)
    expect(serialised).not.toContain('someone@pacco.io')
    expect(serialised).not.toContain('Correct-Horse-Battery-9')
    expect(serialised).not.toMatch(/"role"|admin|accessToken|refresh/i)
  })

  it('emits validation_blocked with the empty-field booleans and no field value', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([]) })
    await user.type(identifierField(), 'someone@pacco.io')
    await user.click(submitButton())

    expect(events).toContainEqual({
      name: 'login.validation_blocked',
      identifierEmpty: false,
      passwordEmpty: true,
    })
    expect(JSON.stringify(events)).not.toContain('someone@pacco.io')
  })

  it('emits duplicate_suppressed carrying the in-flight correlation id', async () => {
    const user = userEvent.setup()
    const client = pendingClient()
    renderLogin({ client })

    await signIn(user)
    await user.click(screen.getByRole('button', { name: LOGIN_COPY.submitProcessing }))

    const submitted = events.find((event) => event.name === 'login.submitted')
    const suppressed = events.find((event) => event.name === 'login.duplicate_suppressed')
    expect(suppressed).toBeDefined()
    expect((suppressed as { correlationId: string }).correlationId).toBe(
      (submitted as { correlationId: string }).correlationId,
    )

    client.resolveWith(okResponse(authDto()))
    await waitFor(() => expect(SessionStore.read()).not.toBeNull())
  })

  it.each([
    ['invalid_credentials', statusResponse(400, { code: 'invalid_credentials' })],
    ['unavailable', transportFailure()],
    ['malformed', okResponse({ role: 'user' })],
    ['unexpected', statusResponse(503, {})],
  ])(
    'emits login.failed with the %s classification and no backend string',
    async (classification, response) => {
      const user = userEvent.setup()
      renderLogin({ client: recordingClient([response]) })
      await signIn(user)

      await waitFor(() => expect(events.some((event) => event.name === 'login.failed')).toBe(true))
      const failed = events.find((event) => event.name === 'login.failed') as {
        classification: string
        correlationId: string
      }
      expect(failed.classification).toBe(classification)
      expect(failed.correlationId).toEqual(expect.any(String))
      expect(JSON.stringify(events)).not.toMatch(/reason|Invalid credentials/i)
    },
  )
})
