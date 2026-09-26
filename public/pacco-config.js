/*
 * Pacco.Web runtime configuration -- exactly two keys.
 *
 * LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 4 ("Configuration"): the client holds
 * ONE gateway URL and no per-service URL and no container port anywhere.
 *
 *   gatewayBaseUrl   The local API Gateway origin. ADR-021 §5 rule 3: "Pacco.Web
 *                    is configured with the single local gateway URL
 *                    http://localhost:5000 -- not with per-service URLs and not
 *                    with container ports."
 *   signInTimeoutMs  A named configuration key with a PROVISIONAL default.
 *                    ⚠️ It is explicitly NOT an SLO: ADR-021 §8 N8 records that
 *                    "no availability target, latency budget or error-rate
 *                    objective is documented" anywhere on this platform, so no
 *                    number here may be read as one.
 *
 * ⚠️ Local development only. There are currently no separate Dev, QA, Staging or
 * Production frontend environments -- ADR-021 §5 rule 6: those "environment-
 * specific origins, gateway URLs, DNS names and deployment targets are defined
 * later, when those environments are introduced."
 *
 * No secret, API key or credential belongs in this file or in the bundle.
 */
window.__PACCO_CONFIG__ = {
  gatewayBaseUrl: 'http://localhost:5000',
  signInTimeoutMs: 15000,
}
