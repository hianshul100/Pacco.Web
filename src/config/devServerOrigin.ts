/**
 * The exact local origin this client serves from.
 *
 * ADR-021 §5 rule 4: "The edge names its browser caller exactly. The
 * `extensions.cors.allowedOrigins` list in the gateway configuration carries the
 * exact `Pacco.Web` local origin -- scheme, host and port, for example
 * `http://localhost:3000`, matching whichever port `Pacco.Web` actually serves
 * -- in place of `'*'`, with `allowCredentials: true` retained."
 *
 * The value is declared here so the dev server (`vite.config.ts`) and the
 * edge-configuration test assert against ONE constant rather than two literals
 * that could drift apart.
 *
 * ⚠️ This is the local development origin only. ADR-021 §5 rule 6: there are
 * currently no separate Dev, QA, Staging or Production frontend environments, so
 * no second origin and no environment matrix is introduced here.
 */
export const DEV_SERVER_ORIGIN = 'http://localhost:3000'
