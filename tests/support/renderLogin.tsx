import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { BrandFrame } from '@/components/BrandFrame'
import { Router } from '@/Router'
import type { GatewayClient } from '@/gateway/gatewayClient'

export interface RenderLoginOptions {
  readonly client: GatewayClient
  /** Initial location. Accepts a path, or a path plus a redirect reason key. */
  readonly initialEntry?: string | { pathname: string; state: { reason: string } }
}

/**
 * Renders the same tree `AppShell` renders, with `MemoryRouter` in place of
 * `BrowserRouter` so a route's redirect reason key can be supplied directly.
 */
export function renderLogin({ client, initialEntry = '/login' }: RenderLoginOptions): RenderResult {
  return render(
    <MemoryRouter initialEntries={[initialEntry as never]}>
      <BrandFrame>
        <Router client={client} />
      </BrandFrame>
    </MemoryRouter>,
  )
}

export function renderInRouter(node: ReactElement): RenderResult {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}
