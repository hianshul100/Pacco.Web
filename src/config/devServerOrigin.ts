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
 * ## Why 5173 and not the 3000 of the ADR's example
 *
 * `3000` is explicitly an EXAMPLE in the rule quoted above -- "matching
 * whichever port `Pacco.Web` actually serves" -- and ADR-021 blocker `B1`
 * records it as "the example in the intent, not a committed value". Picking the
 * real one is this repository's call, and it cannot be 3000:
 *
 * - ADR-021 §4 requires this client to run "as a local process beside the
 *   Compose backend", and `Pacco/compose/infrastructure.yml:34` publishes host
 *   port `3000` for Grafana. That is the file the Pacco README's runbook starts
 *   (`docker-compose -f infrastructure.yml up -d`), so the backend holds 3000
 *   for as long as a developer is working against it.
 * - The dev server below is pinned with `strictPort: true` on purpose, so that
 *   the origin the gateway allowlists cannot silently stop matching. A pinned
 *   port that is already taken does not fall back -- `npm run dev` simply fails.
 *
 * `5173` is Vite's own default, is published by no file in `Pacco/compose`, and
 * is outside the platform's `5000`-`5009` service block, which ADR-021 §6.3
 * item 1 keeps this client out of. The gateway's
 * `scripts/verify-cors-config.sh` asserts both properties against its four
 * `ntrada*.yml` files, so the two repositories cannot drift back into collision.
 *
 * ⚠️ This is the local development origin only. ADR-021 §5 rule 6: there are
 * currently no separate Dev, QA, Staging or Production frontend environments, so
 * no second origin and no environment matrix is introduced here.
 */
export const DEV_SERVER_ORIGIN = 'http://localhost:5173'
