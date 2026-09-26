import { render, screen } from '@testing-library/react'

import { AppShell } from '@/AppShell'
import { LOGIN_COPY } from '@/features/login/copy'

describe('AppShell', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/login')
  })

  it('boots the client and resolves /login to the sign-in form', () => {
    render(<AppShell config={{ gatewayBaseUrl: 'http://localhost:5000', signInTimeoutMs: 1000 }} />)
    expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument()
  })

  it('resolves the root path to the same anonymous form', () => {
    window.history.pushState({}, '', '/')
    render(<AppShell config={{ gatewayBaseUrl: 'http://localhost:5000', signInTimeoutMs: 1000 }} />)
    expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument()
  })

  it('reads the injected configuration when none is supplied', () => {
    window.__PACCO_CONFIG__ = { gatewayBaseUrl: 'http://localhost:5000', signInTimeoutMs: 2000 }
    render(<AppShell />)
    expect(screen.getByRole('heading', { name: LOGIN_COPY.heading })).toBeInTheDocument()
    delete window.__PACCO_CONFIG__
  })

  it('declares the document title through the React tree', () => {
    render(<AppShell config={{ gatewayBaseUrl: 'http://localhost:5000', signInTimeoutMs: 1000 }} />)
    expect(document.title).toBe('Sign in · Pacco')
  })
})
