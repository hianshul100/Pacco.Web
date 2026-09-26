/**
 * AppShell -- boots the client.
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 5 step 1: the shell reads the
 * configuration ONCE and constructs the single `GatewayClient` from it. No call
 * site anywhere else in the application sees `gatewayBaseUrl` or
 * `signInTimeoutMs`.
 *
 * ADR-021 §5 rule 1: this is the standalone browser client. It is served from
 * its own local origin by its own process, never from a backend service image
 * and never by the gateway.
 */
import { useMemo } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { BrandFrame } from '@/components/BrandFrame'
import { Router } from '@/Router'
import type { AppConfig } from '@/config/appConfig'
import { readInjectedAppConfig } from '@/config/appConfig'
import { createGatewayClient } from '@/gateway/gatewayClient'

export function AppShell({ config }: { readonly config?: AppConfig }) {
  // Read once, at boot. `useMemo` keeps the single client identity stable so
  // `useSignIn`'s callback is not rebuilt on every render.
  const client = useMemo(() => createGatewayClient(config ?? readInjectedAppConfig()), [config])

  return (
    <BrowserRouter>
      {/* React 19 Document Metadata: the title is declared in the tree. */}
      <title>Sign in · Pacco</title>
      <meta name="description" content="Sign in to your Pacco account." />
      <BrandFrame>
        <Router client={client} />
      </BrandFrame>
    </BrowserRouter>
  )
}
