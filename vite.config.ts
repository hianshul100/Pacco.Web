import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { DEV_SERVER_ORIGIN } from './src/config/devServerOrigin'

/**
 * Pacco.Web is a standalone browser client. It is never bundled into a backend
 * service image and is never served by Ntrada -- per ADR-021 §5 rule 1
 * ("Pacco.Web is the Pacco platform's standalone browser client ... is never
 * bundled into a backend service image and is never served by the gateway").
 *
 * The dev-server port is PINNED (`strictPort`) because the gateway's
 * `extensions.cors.allowedOrigins` names this origin exactly -- per ADR-021 §5
 * rule 4 ("The edge names its browser caller exactly ... the exact Pacco.Web
 * local origin -- scheme, host and port, for example `http://localhost:3000`,
 * matching whichever port Pacco.Web actually serves"). If Vite were allowed to
 * fall back to another port the allowed origin would silently stop matching.
 *
 * The port itself is NOT 3000 -- that is the ADR's example, and 3000 is taken by
 * Grafana in the Compose backend this client is required to run beside. See
 * `src/config/devServerOrigin.ts` for the full reasoning; the constant there is
 * the single source of truth and is the only place the value is written.
 */
export const DEV_SERVER_PORT = Number(new URL(DEV_SERVER_ORIGIN).port)

export default defineConfig({
  plugins: [
    react({
      babel: {
        // React 19 Compiler. No dependency here participates in authentication,
        // session handling, JWT parsing or error presentation -- per
        // LOW_LEVEL_SPEC-13652-wave-1.md §L.7.2 rule 4.
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: 'localhost',
    port: DEV_SERVER_PORT,
    strictPort: true,
  },
  preview: {
    host: 'localhost',
    port: DEV_SERVER_PORT,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
