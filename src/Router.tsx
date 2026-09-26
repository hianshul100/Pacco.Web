/**
 * Router.
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 5 step 2: `/` and `/login` BOTH
 * render `LoginRoute`. In wave-1 the root is always the anonymous sign-in form;
 * the `/` -> landing branch belongs to wave-2 (§L.2.3) and is not written here.
 *
 * 🚫 No route guard, no landing screen and no logout action is registered --
 * all three are explicitly out of scope for this wave.
 */
import { Route, Routes } from 'react-router-dom'

import { LoginRoute } from '@/features/login/LoginRoute'
import type { GatewayClient } from '@/gateway/gatewayClient'

export function Router({ client }: { readonly client: GatewayClient }) {
  return (
    <Routes>
      <Route path="/" element={<LoginRoute client={client} />} />
      <Route path="/login" element={<LoginRoute client={client} />} />
      {/*
        The post-sign-in path resolves to an empty centre in this wave. The
        landing screen is wave-2's to build; rendering invented placeholder
        chrome here would be a fabricated requirement.
      */}
      <Route path="*" element={null} />
    </Routes>
  )
}
