import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'node:util'

// jsdom does not ship TextEncoder/TextDecoder; `src/session/jwt.ts` needs the
// decoder to read the access token's payload segment.
if (typeof globalThis.TextDecoder === 'undefined') {
  Object.assign(globalThis, { TextDecoder, TextEncoder })
}

// No test may reach the network. Any unstubbed `fetch` is a test defect, not a
// silent pass.
beforeEach(() => {
  globalThis.fetch = jest.fn(() => {
    throw new Error('Unexpected network call: every test must stub the gateway boundary.')
  }) as unknown as typeof fetch
})

afterEach(() => {
  jest.restoreAllMocks()
  window.sessionStorage.clear()
})
