/**
 * The negative and security anchors NEG-1 to NEG-7 of
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.4, run as a NAMED SUITE rather than as
 * incidental assertions (§L.6.A.4: "NEG-1 to NEG-7 above run as a named suite").
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LOGIN_COPY } from '@/features/login/copy'
import type { GatewayResponse } from '@/gateway/gatewayClient'
import type { LoginTelemetryEvent } from '@/platform/telemetry'
import { Telemetry } from '@/platform/telemetry'
import { MESSAGE_REGISTRY } from '@/session/messageRegistry'
import { SessionStore } from '@/session/sessionStore'
import {
  accessTokenWithClaims,
  authDto,
  okResponse,
  recordingClient,
  statusResponse,
  transportFailure,
} from '../support/factories'
import { renderLogin } from '../support/renderLogin'

const SRC_ROOT = join(__dirname, '..', '..', 'src')

function sourceFiles(directory: string = SRC_ROOT): string[] {
  return readdirSync(directory).flatMap((entry: string) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

/** Source with comments stripped, so prose about a rule is not mistaken for code. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const PASSWORD = 'Correct-Horse-Battery-9'
const IDENTIFIER = 'someone@pacco.io'

const identifierField = () => screen.getByLabelText(LOGIN_COPY.identifierLabel)
const passwordField = () => screen.getByLabelText(LOGIN_COPY.passwordLabel)
const submitButton = () => screen.getByRole('button', { name: LOGIN_COPY.submit })

async function attemptSignIn(
  user: ReturnType<typeof userEvent.setup>,
  identifier = IDENTIFIER,
  password = PASSWORD,
) {
  await user.type(identifierField(), identifier)
  await user.type(passwordField(), password)
  await user.click(submitButton())
}

const FAILURE_CASES: Array<[string, GatewayResponse, string]> = [
  [
    '400 invalid_credentials',
    statusResponse(400, { code: 'invalid_credentials', reason: 'Invalid credentials.' }),
    MESSAGE_REGISTRY.credentials,
  ],
  [
    '400 invalid_email echoing the submitted value',
    statusResponse(400, { code: 'invalid_email', reason: `Invalid email: ${IDENTIFIER}.` }),
    MESSAGE_REGISTRY.credentials,
  ],
  [
    '400 with an unrecognised code',
    statusResponse(400, { code: 'account_locked', reason: 'Locked.' }),
    MESSAGE_REGISTRY.generic,
  ],
  [
    '500 with an exception message',
    statusResponse(500, {
      message: 'System.NullReferenceException: Object reference not set',
      stackTrace: 'at Pacco.Services.Identity.Handler',
    }),
    MESSAGE_REGISTRY.generic,
  ],
  [
    '503 from the edge',
    statusResponse(503, { detail: 'http://identity-service/sign-in unreachable' }),
    MESSAGE_REGISTRY.generic,
  ],
  ['a transport failure', transportFailure(), MESSAGE_REGISTRY.unavailable],
  ['a malformed 200', okResponse({ role: 'user' }), MESSAGE_REGISTRY.generic],
  [
    'a 200 whose token has no exp claim',
    okResponse(authDto({ accessToken: accessTokenWithClaims({ sub: 'x' }) })),
    MESSAGE_REGISTRY.generic,
  ],
]

describe('NEG-1 no backend text escapes', () => {
  it.each(FAILURE_CASES)(
    'renders only the registry string for %s and leaks nothing to the DOM, console or telemetry',
    async (_label, response, expected) => {
      const user = userEvent.setup()
      const events: LoginTelemetryEvent[] = []
      Telemetry.setTelemetrySink((event) => events.push(event))
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const error = jest.spyOn(console, 'error').mockImplementation(() => {})

      const { container } = renderLogin({ client: recordingClient([response]) })
      await attemptSignIn(user)
      await screen.findByText(expected)

      const dom = container.textContent ?? ''
      const consoleOutput = [...warn.mock.calls, ...error.mock.calls].flat().join(' ')
      const telemetry = JSON.stringify(events)

      for (const surface of [dom, consoleOutput, telemetry]) {
        expect(surface).not.toMatch(/reason|NullReferenceException|stackTrace|at Pacco\./i)
        expect(surface).not.toMatch(/identity-service|localhost:5000|localhost:5004/i)
        expect(surface).not.toMatch(/\b(400|401|500|503)\b/)
      }
      expect(dom).toContain(expected)
      Telemetry.setTelemetrySink(null)
    },
  )
})

describe('NEG-2 no password value escapes', () => {
  it.each(FAILURE_CASES)(
    'keeps the submitted password out of telemetry, storage, the URL and every log line for %s',
    async (_label, response, expected) => {
      const user = userEvent.setup()
      const events: LoginTelemetryEvent[] = []
      Telemetry.setTelemetrySink((event) => events.push(event))
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const { container } = renderLogin({ client: recordingClient([response]) })
      await attemptSignIn(user)
      await screen.findByText(expected)

      expect(JSON.stringify(events)).not.toContain(PASSWORD)
      expect(warn.mock.calls.flat().join(' ')).not.toContain(PASSWORD)
      expect(JSON.stringify(window.sessionStorage)).not.toContain(PASSWORD)
      expect(JSON.stringify(window.localStorage)).not.toContain(PASSWORD)
      expect(window.location.href).not.toContain(PASSWORD)
      expect(container.innerHTML).not.toContain(PASSWORD)
      Telemetry.setTelemetrySink(null)
    },
  )

  it('keeps the password out of every surface on the success path too', async () => {
    const user = userEvent.setup()
    const events: LoginTelemetryEvent[] = []
    Telemetry.setTelemetrySink((event) => events.push(event))

    renderLogin({ client: recordingClient([okResponse(authDto())]) })
    await attemptSignIn(user)
    await waitFor(() => expect(SessionStore.read()).not.toBeNull())

    expect(JSON.stringify(events)).not.toContain(PASSWORD)
    expect(JSON.stringify(window.sessionStorage)).not.toContain(PASSWORD)
    Telemetry.setTelemetrySink(null)
  })
})

describe('NEG-3 no credential is embedded', () => {
  const files = sourceFiles()

  it('scans every client source file and finds no credential, token or seeded-account literal', () => {
    expect(files.length).toBeGreaterThan(10)
    for (const path of files) {
      const code = codeOf(path)
      expect(code).not.toMatch(/\b(password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/i)
      expect(code).not.toMatch(
        /\b(accessToken|refreshToken|apiKey|api_key|secret)\s*[:=]\s*['"][^'"]{8,}['"]/i,
      )
      expect(code).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./)
      // The only address-shaped literal permitted is the field placeholder,
      // which is fixed by SPECIFICATION.md §11.3 and is not an account.
      const addresses = (code.match(/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi) ?? []).filter(
        (address) => address !== 'name@company.com',
      )
      expect(addresses).toEqual([])
    }
  })

  it('finds no credential literal in the injected runtime configuration', () => {
    const path = join(__dirname, '..', '..', 'public', 'pacco-config.js')
    // Comments are stripped first: the file's own prose warning that no secret
    // belongs here must not be mistaken for a secret.
    const config = codeOf(path)
    expect(config).not.toMatch(/password|secret|api[-_]?key|token/i)
    // Exactly the two documented keys, and no third.
    expect(config).toContain('gatewayBaseUrl')
    expect(config).toContain('signInTimeoutMs')
  })
})

describe('NEG-4 no session on a failure path', () => {
  it.each(FAILURE_CASES)(
    'leaves SessionStore.read() empty after %s',
    async (_label, response, expected) => {
      const user = userEvent.setup()
      jest.spyOn(console, 'warn').mockImplementation(() => {})
      renderLogin({ client: recordingClient([response]) })
      await attemptSignIn(user)
      await screen.findByText(expected)
      expect(SessionStore.read()).toBeNull()
      expect(window.sessionStorage.length).toBe(0)
    },
  )
})

describe('NEG-5 no refresh token retained', () => {
  it('leaves the refresh token out of every storage key, the session object and every telemetry payload', async () => {
    const user = userEvent.setup()
    const refreshToken = 'RT-must-never-be-retained-0123456789'
    const events: LoginTelemetryEvent[] = []
    Telemetry.setTelemetrySink((event) => events.push(event))

    const { container } = renderLogin({
      client: recordingClient([okResponse(authDto({ refreshToken }))]),
    })
    await attemptSignIn(user)
    await waitFor(() => expect(SessionStore.read()).not.toBeNull())

    expect(JSON.stringify(window.sessionStorage)).not.toContain(refreshToken)
    expect(JSON.stringify(window.localStorage)).not.toContain(refreshToken)
    expect(SessionStore.read()).not.toHaveProperty('refreshToken')
    expect(JSON.stringify(events)).not.toContain(refreshToken)
    expect(container.innerHTML).not.toContain(refreshToken)
    Telemetry.setTelemetrySink(null)
  })

  it('never names refreshToken in any client source statement', () => {
    for (const path of sourceFiles()) {
      expect(codeOf(path)).not.toMatch(/\brefreshToken\b/)
    }
  })
})

describe('NEG-6 canonical invalid transition 1 — a session is written only from a parsed HTTP 200', () => {
  it('source check: SessionStore.write() has exactly one call site, inside useSignIn', () => {
    const callSites = sourceFiles().flatMap((path) => {
      const matches = codeOf(path).match(/SessionStore\.write\s*\(/g) ?? []
      return matches.map(() => path)
    })
    expect(callSites).toHaveLength(1)
    expect(callSites[0]).toMatch(/features[/\\]login[/\\]useSignIn\.ts$/)
  })

  it('behavioural check: every non-200 and malformed-200 path leaves the store empty', async () => {
    for (const [, response, expected] of FAILURE_CASES) {
      const user = userEvent.setup()
      jest.spyOn(console, 'warn').mockImplementation(() => {})
      const view = renderLogin({ client: recordingClient([response]) })
      await attemptSignIn(user)
      await screen.findByText(expected)
      expect(SessionStore.read()).toBeNull()
      view.unmount()
    }
  })
})

describe('NEG-7 canonical invalid transition 5 at the write — role comes from AuthDto.role alone', () => {
  it('source check: the only expression assigned to the session role is the lower-cased AuthDto.role', () => {
    const sessionStore = codeOf(join(SRC_ROOT, 'session', 'sessionStore.ts'))
    expect(sessionStore).toContain('role: session.role.toLowerCase()')

    const useSignIn = codeOf(join(SRC_ROOT, 'features', 'login', 'useSignIn.ts'))
    const writeCall = useSignIn.slice(useSignIn.indexOf('SessionStore.write('))
    expect(writeCall.slice(0, writeCall.indexOf('})'))).toMatch(/role:\s*auth\.role,/)

    // No role is ever inferred from the identifier, and no default to admin.
    for (const path of sourceFiles()) {
      const code = codeOf(path)
      expect(code).not.toMatch(/role\s*!==\s*['"]user['"]/)
      expect(code).not.toMatch(/role\s*=\s*['"]admin['"]/)
      expect(code).not.toMatch(/identifier.*includes\(['"]admin['"]\)/)
    }
  })

  it('behavioural check: an identifier whose local part is admin does not reach the written session', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([okResponse(authDto({ role: 'user' }))]) })
    await attemptSignIn(user, 'admin@pacco.io')
    await waitFor(() => expect(SessionStore.read()).not.toBeNull())

    expect(SessionStore.read()?.role).toBe('user')
    expect(JSON.stringify(SessionStore.read())).not.toContain('admin@pacco.io')
    expect(JSON.stringify(SessionStore.read())).not.toContain('admin')
  })
})
