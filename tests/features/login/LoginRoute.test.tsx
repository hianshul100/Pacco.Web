/**
 * UI/component test groups of LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.3:
 * Rendering, Validation, Submit lock, Messaging, Password field, Session notice
 * and Accessibility wiring.
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LOGIN_COPY } from '@/features/login/copy'
import { MESSAGE_REGISTRY } from '@/session/messageRegistry'
import { SessionStore } from '@/session/sessionStore'
import {
  authDto,
  okResponse,
  pendingClient,
  recordingClient,
  statusResponse,
  transportFailure,
} from '../../support/factories'
import { renderLogin } from '../../support/renderLogin'

const identifierField = () => screen.getByLabelText(LOGIN_COPY.identifierLabel)
const passwordField = () => screen.getByLabelText(LOGIN_COPY.passwordLabel)
const submitButton = () => screen.getByRole('button', { name: LOGIN_COPY.submit })

describe('Rendering', () => {
  it('renders the heading, sub-heading and help link fixed by the copy contract', () => {
    renderLogin({ client: recordingClient([]) })
    expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument()
    expect(screen.getByText(LOGIN_COPY.subheading)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: LOGIN_COPY.needHelp })).toBeInTheDocument()
  })

  it('renders both fields with a visible, programmatically associated label', () => {
    renderLogin({ client: recordingClient([]) })
    expect(identifierField()).toBeInTheDocument()
    expect(passwordField()).toBeInTheDocument()
    expect(screen.getByText(LOGIN_COPY.identifierLabel).tagName).toBe('LABEL')
    expect(screen.getByText(LOGIN_COPY.passwordLabel).tagName).toBe('LABEL')
  })

  it('does not rely on the placeholder as the only label', () => {
    renderLogin({ client: recordingClient([]) })
    expect(identifierField()).toHaveAttribute('placeholder', LOGIN_COPY.identifierPlaceholder)
    expect(identifierField()).toHaveAccessibleName(LOGIN_COPY.identifierLabel)
  })

  it('renders both helper strings', () => {
    renderLogin({ client: recordingClient([]) })
    expect(screen.getByText(LOGIN_COPY.identifierHelp)).toBeInTheDocument()
    expect(screen.getByText(LOGIN_COPY.passwordHelp)).toBeInTheDocument()
  })

  it('performs no fetch on mount and shows no loading state on entry', () => {
    const client = recordingClient([])
    renderLogin({ client })
    expect(client.requests).toHaveLength(0)
    expect(submitButton()).toHaveAttribute('aria-busy', 'false')
  })

  it('renders the same form at the root path as at /login', () => {
    renderLogin({ client: recordingClient([]), initialEntry: '/' })
    expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument()
  })

  it('renders no spec or process vocabulary anywhere on the screen', () => {
    const { container } = renderLogin({ client: recordingClient([]) })
    expect(container.textContent ?? '').not.toMatch(
      /\b(DO-?\d|FR-?\d|AC-?\d|BR-?\d|EF-?\d|NEG-?\d|wave[- ]?\d)\b/i,
    )
  })
})

describe('Validation', () => {
  it('blocks submission and makes no request when both fields are empty', async () => {
    const user = userEvent.setup()
    const client = recordingClient([])
    renderLogin({ client })

    await user.click(submitButton())

    expect(client.requests).toHaveLength(0)
    expect(identifierField()).toHaveAttribute('aria-invalid', 'true')
    expect(passwordField()).toHaveAttribute('aria-invalid', 'true')
  })

  it('treats whitespace-only values as empty', async () => {
    const user = userEvent.setup()
    const client = recordingClient([])
    renderLogin({ client })

    await user.type(identifierField(), '   ')
    await user.type(passwordField(), '   ')
    await user.click(submitButton())

    expect(client.requests).toHaveLength(0)
  })

  it('focuses the first empty field', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([]) })

    await user.click(submitButton())
    expect(identifierField()).toHaveFocus()

    await user.type(identifierField(), 'someone@pacco.io')
    await user.click(submitButton())
    expect(passwordField()).toHaveFocus()
  })

  it('applies no email-shape check in the browser: a non-email identifier still reaches the edge', async () => {
    const user = userEvent.setup()
    const client = recordingClient([statusResponse(400, { code: 'invalid_email' })])
    renderLogin({ client })

    await user.type(identifierField(), 'not-an-email')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())

    await waitFor(() => expect(client.requests).toHaveLength(1))
    expect(client.requests[0].email).toBe('not-an-email')
  })
})

describe('Submit lock', () => {
  it('issues exactly one request for five rapid activations', async () => {
    const user = userEvent.setup()
    const client = pendingClient()
    renderLogin({ client })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')

    const button = submitButton()
    await user.click(button)
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await user.click(screen.getByRole('button', { name: LOGIN_COPY.submitProcessing }))
    }

    expect(client.requests).toHaveLength(1)
    client.resolveWith(okResponse(authDto()))
    await waitFor(() => expect(SessionStore.read()).not.toBeNull())
  })

  it('marks the action busy and disabled and changes its accessible name while in flight', async () => {
    const user = userEvent.setup()
    const client = pendingClient()
    renderLogin({ client })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())

    const busy = screen.getByRole('button', { name: LOGIN_COPY.submitProcessing })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).toHaveAttribute('aria-disabled', 'true')

    client.resolveWith(okResponse(authDto()))
    await waitFor(() => expect(SessionStore.read()).not.toBeNull())
  })

  it('makes both fields read-only while in flight', async () => {
    const user = userEvent.setup()
    const client = pendingClient()
    renderLogin({ client })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())

    expect(identifierField()).toHaveAttribute('readonly')
    expect(passwordField()).toHaveAttribute('readonly')

    client.resolveWith(okResponse(authDto()))
    await waitFor(() => expect(SessionStore.read()).not.toBeNull())
  })

  it('releases the lock after a failure so a second attempt is possible', async () => {
    const user = userEvent.setup()
    const client = recordingClient([transportFailure(), okResponse(authDto())])
    renderLogin({ client })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())
    await screen.findByText(MESSAGE_REGISTRY.unavailable)

    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())

    await waitFor(() => expect(client.requests).toHaveLength(2))
  })
})

describe('Messaging', () => {
  it.each([
    [
      'wrong credentials',
      statusResponse(400, { code: 'invalid_credentials', reason: 'Invalid credentials.' }),
      MESSAGE_REGISTRY.credentials,
    ],
    [
      'an unusable identifier',
      statusResponse(400, { code: 'invalid_email', reason: 'Invalid email: someone@pacco.io.' }),
      MESSAGE_REGISTRY.credentials,
    ],
    ['a transport failure', transportFailure(), MESSAGE_REGISTRY.unavailable],
    [
      'an unexpected status',
      statusResponse(500, { message: 'Object reference not set' }),
      MESSAGE_REGISTRY.generic,
    ],
    ['a malformed success body', okResponse({ role: 'user' }), MESSAGE_REGISTRY.generic],
  ])('renders the registry string for %s', async (_label, response, expected) => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([response]) })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())

    await screen.findByText(expected)
    expect(screen.getByRole('alert')).toHaveTextContent(expected)
  })

  it('shows exactly one message, replaced rather than stacked', async () => {
    const user = userEvent.setup()
    renderLogin({
      client: recordingClient([
        transportFailure(),
        statusResponse(400, { code: 'invalid_credentials' }),
      ]),
    })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())
    await screen.findByText(MESSAGE_REGISTRY.unavailable)

    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())
    await screen.findByText(MESSAGE_REGISTRY.credentials)

    expect(screen.queryByText(MESSAGE_REGISTRY.unavailable)).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('clears the password and keeps the identifier after a failure', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([statusResponse(400, { code: 'invalid_credentials' })]) })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())
    await screen.findByText(MESSAGE_REGISTRY.credentials)

    expect(identifierField()).toHaveValue('someone@pacco.io')
    expect(passwordField()).toHaveValue('')
  })

  it('moves focus to the message and re-enables the action and the fields', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([transportFailure()]) })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())

    await screen.findByText(MESSAGE_REGISTRY.unavailable)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
    expect(submitButton()).toHaveAttribute('aria-disabled', 'false')
    expect(identifierField()).not.toHaveAttribute('readonly')
  })

  it('clears the message as soon as the user types again', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([transportFailure()]) })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())
    await screen.findByText(MESSAGE_REGISTRY.unavailable)

    await user.type(identifierField(), 'x')
    expect(screen.queryByText(MESSAGE_REGISTRY.unavailable)).not.toBeInTheDocument()
  })
})

describe('Password field', () => {
  it('is masked by default', () => {
    renderLogin({ client: recordingClient([]) })
    expect(passwordField()).toHaveAttribute('type', 'password')
  })

  it('reveals and re-masks via a toggle that names its action and reports its state', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([]) })

    const show = screen.getByRole('button', { name: LOGIN_COPY.showPassword })
    expect(show).toHaveAttribute('type', 'button')
    expect(show).toHaveAttribute('aria-pressed', 'false')

    await user.click(show)
    expect(passwordField()).toHaveAttribute('type', 'text')
    const hide = screen.getByRole('button', { name: LOGIN_COPY.hidePassword })
    expect(hide).toHaveAttribute('aria-pressed', 'true')

    await user.click(hide)
    expect(passwordField()).toHaveAttribute('type', 'password')
  })

  it('holds the password value in no other DOM node, attribute or accessible name', async () => {
    const user = userEvent.setup()
    const { container } = renderLogin({ client: recordingClient([]) })
    const secret = 'Correct-Horse-Battery-9'

    await user.type(passwordField(), secret)

    expect(passwordField()).toHaveValue(secret)
    // The value never becomes rendered text, and never reaches a second node.
    //
    // The password input itself is excluded from the attribute sweep: React
    // mirrors a controlled input's `value` onto `defaultValue`, which reflects
    // into the element's own `value` attribute. That is the field holding its
    // own value, not the value escaping to another node — which is what
    // LOW_LEVEL_SPEC-13652-wave-1.md §L.6.A.4 NEG-2 forbids.
    const password = passwordField()
    expect(container.textContent ?? '').not.toContain(secret)
    expect(container.querySelectorAll('input[type="hidden"]')).toHaveLength(0)
    for (const element of Array.from(container.querySelectorAll('*'))) {
      for (const attribute of Array.from(element.attributes)) {
        // On the password input alone, `value` is the field holding its own
        // value; everywhere else, any attribute carrying it is a leak.
        if (element === password && attribute.name === 'value') {
          continue
        }
        expect(attribute.value).not.toContain(secret)
      }
    }
    expect(password.getAttribute('aria-label')).toBeNull()
  })
})

describe('Session notice', () => {
  it('renders nothing in its region when no redirect reason was supplied', () => {
    renderLogin({ client: recordingClient([]) })
    expect(screen.getByTestId('session-notice')).toBeEmptyDOMElement()
  })

  it('renders the registry entry in a role="status" region when the router supplies the reason key', () => {
    renderLogin({
      client: recordingClient([]),
      initialEntry: { pathname: '/login', state: { reason: 'session_expired' } },
    })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(MESSAGE_REGISTRY.session_expired)
    expect(status).not.toHaveTextContent(MESSAGE_REGISTRY.credentials)
  })

  it('keeps the status region and the alert region distinct and never displaces one with the other', async () => {
    const user = userEvent.setup()
    renderLogin({
      client: recordingClient([statusResponse(400, { code: 'invalid_credentials' })]),
      initialEntry: { pathname: '/login', state: { reason: 'session_expired' } },
    })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.click(submitButton())
    await screen.findByText(MESSAGE_REGISTRY.credentials)

    expect(screen.getByRole('status')).toHaveTextContent(MESSAGE_REGISTRY.session_expired)
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE_REGISTRY.credentials)
  })
})

describe('Accessibility wiring', () => {
  it('describes each field by its helper text, and by its error when invalid', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([]) })

    expect(identifierField()).toHaveAccessibleDescription(LOGIN_COPY.identifierHelp)

    await user.click(submitButton())

    expect(identifierField()).toHaveAttribute('aria-invalid', 'true')
    expect(identifierField()).toHaveAccessibleDescription(
      `${LOGIN_COPY.identifierRequired} ${LOGIN_COPY.identifierHelp}`,
    )
    expect(passwordField()).toHaveAccessibleDescription(
      `${LOGIN_COPY.passwordRequired} ${LOGIN_COPY.passwordHelp}`,
    )
  })

  it('places the brand frame outside the tab order and gives every brand image an empty alt', () => {
    const { container } = renderLogin({ client: recordingClient([]) })
    for (const image of Array.from(container.querySelectorAll('img'))) {
      expect(image).toHaveAttribute('alt', '')
      expect(image).toHaveAttribute('aria-hidden', 'true')
    }
    expect(container.querySelectorAll('[tabindex]:not([tabindex="-1"])')).toHaveLength(0)
  })

  it('follows the documented focus order: identifier, password, reveal toggle, Sign in, Need help', async () => {
    const user = userEvent.setup()
    renderLogin({ client: recordingClient([]) })

    identifierField().focus()
    await user.tab()
    expect(passwordField()).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: LOGIN_COPY.showPassword })).toHaveFocus()
    await user.tab()
    expect(submitButton()).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: LOGIN_COPY.needHelp })).toHaveFocus()
  })

  it('submits when Enter is pressed in either field', async () => {
    const user = userEvent.setup()
    const client = recordingClient([
      statusResponse(400, { code: 'invalid_credentials' }),
      statusResponse(400, { code: 'invalid_credentials' }),
    ])
    renderLogin({ client })

    await user.type(identifierField(), 'someone@pacco.io')
    await user.type(passwordField(), 'secret-value')
    await user.type(identifierField(), '{Enter}')
    await waitFor(() => expect(client.requests).toHaveLength(1))

    await user.type(passwordField(), 'secret-value')
    await user.type(passwordField(), '{Enter}')
    await waitFor(() => expect(client.requests).toHaveLength(2))
  })
})
