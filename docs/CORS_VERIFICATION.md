# FR-11 cross-origin change — verification record (client side)

SPECIFICATION.md §19 counts FR-11's verification obligation as **"1 four-file
byte-identity diff, plus 2 cross-origin browser checks"**.

| Obligation | Acceptance criterion | Discharged by | Status |
| --- | --- | --- | --- |
| four-file byte-identity diff | AC-15 (static) | `Pacco.APIGateway/scripts/verify-cors-config.sh` (guard of record) and `tests/gateway/corsConfiguration.test.ts` (second pair of eyes) | **PASSED** |
| 2 cross-origin browser checks | AC-16 (runtime) | `npm run verify:cors-browser` (`scripts/cors-browser-check.mjs`) | **NOT RUN** |

> **AC-16: not run — no Docker Compose stack available.**
>
> The two cross-origin browser checks need a gateway answering on
> `http://localhost:5000`, which means the Docker Compose stack. No such stack
> runs in this environment, so the checks did not execute. Per
> `LOW_LEVEL_SPEC-13652-wave-1.md` §L.6.2, an affected §L.6.A row in this
> situation is reported as **"not run"** and **never as passed**. AC-16 is
> therefore open, and this section is the explicit disclosure of that.

## `npm run verify:cors-browser` — the two browser checks

`scripts/cors-browser-check.mjs` stands up two tiny static origins and drives
headless Chromium at each:

- **check 1 — allowed origin** (`DEV_SERVER_ORIGIN`, the single entry now in
  every `ntrada*.yml` `allowedOrigins` list): the cross-origin
  `POST /identity/sign-in` must be **ACCEPTED** by the browser.
- **check 2 — disallowed origin** (`http://localhost:3999` by default): the same
  request must be **REJECTED** by the browser. This is the check a surviving
  wildcard would fail, so it is what actually proves the wildcard is gone at
  runtime rather than only in the YAML.

It adds no dependency — no Puppeteer, no Playwright. It invokes whatever
Chromium or Chrome binary is on `PATH` (or `$CHROMIUM_BIN`) with `--dump-dom`
and reads the verdict the page wrote into its own DOM.

Exit codes: **0** both checks passed, **1** a check failed, **2 NOT RUN**.
2 is deliberately distinct from 1 so no CI wrapper can mistake an absent stack
for a pass.

### Output in this environment: NOT RUN

```
$ npm run verify:cors-browser
AC-16 / FR-11 cross-origin browser checks
  gateway           http://localhost:5000
  allowed origin    http://localhost:5173     (expect ACCEPTED)
  disallowed origin http://localhost:3999  (expect REJECTED)

  chromium          chromium

AC-16 (FR-11) NOT RUN
  reason: no gateway answering at http://localhost:5000 — start the Docker Compose stack first
  The two cross-origin browser checks did not execute, so AC-16 is NOT
  discharged. It must be reported as "not run", never as passed
  (LOW_LEVEL_SPEC-13652-wave-1.md §L.6.2).

$ echo $?
2
```

### The checker itself was proven to discriminate

AC-16 is about the real gateway, and the real gateway was never reached — see
the disclosure above. What *was* verified is that the tool is not a rubber
stamp. It was pointed at two throwaway stand-in servers on
`http://localhost:5000` (kept outside both repositories):

Stand-in that echoes **only** the exact allowed origin — the behaviour the
patched `ntrada*.yml` should produce:

```
  check 1  http://localhost:5173 -> ACCEPTED status=400
  check 2  http://localhost:3999 -> REJECTED Failed to fetch

  AC-16 PASSED: both cross-origin browser checks behaved as specified.
  exit=0
```

Stand-in that echoes **any** origin — the over-broad behaviour this change
removes:

```
  check 1  http://localhost:5173 -> ACCEPTED status=400
  check 2  http://localhost:3999 -> ACCEPTED status=400

  check 2 FAILED: the non-allowlisted origin http://localhost:3999 was ACCEPTED
  (ACCEPTED status=400). A wildcard or an over-broad origin is still in effect.
  exit=1
```

So the check separates the two cases it is supposed to separate. It remains
**NOT RUN against the actual gateway**, and a green run against a stand-in is
not evidence about the gateway.

## AC-15 — the static half: PASSED

The guard of record is `Pacco.APIGateway/scripts/verify-cors-config.sh`, which
lives with the files it guards and runs from that repository's `scripts/test.sh`
with no toolchain. `tests/gateway/corsConfiguration.test.ts` re-checks the same
contract from here, because this is where `DEV_SERVER_ORIGIN` — the value the
origin must equal — is defined.

```
$ npm test
Test Suites: 15 passed, 15 total
Tests:       199 passed, 199 total
```

Two things about that suite were fixed after review:

1. **It no longer hard-codes a sibling directory name.** The gateway checkout is
   resolved by `tests/gateway/gatewayConfigDir.ts` through
   `$PACCO_GATEWAY_CONFIG_DIR` first, then a list of known sibling names. The
   old single hard-coded path broke the moment a workspace laid the checkout out
   differently.
2. **A missing checkout can no longer read as a pass.** The previous revision
   flipped to `describe.skip` and then asserted `typeof available === 'boolean'`
   — a tautology that reported green while checking nothing. The suite now runs
   unconditionally whenever `CI` is set, and the availability test throws with
   the full search path either way:

```
$ CI=true PACCO_GATEWAY_CONFIG_DIR=/tmp/definitely-not-here npx jest tests/gateway/corsConfiguration.test.ts

  ● gateway configuration availability › locates the four ntrada*.yml files, or fails with the full search path

    The Pacco.APIGateway checkout holding the four ntrada*.yml files was not found.
    Looked for src/Pacco.APIGateway under hianshul100_Pacco.APIGateway, Pacco.APIGateway,
    pacco.apigateway beside <workspace root>,
    and at $PACCO_GATEWAY_CONFIG_DIR (unset or incomplete).
    AC-15 is therefore NOT discharged by this run. Set PACCO_GATEWAY_CONFIG_DIR, or run
    the gateway's own guard: Pacco.APIGateway/scripts/verify-cors-config.sh.

Tests:       26 failed, 26 total
```

With the override pointed at the real checkout, the same 26 tests pass.

## Full client toolchain

```
$ npm run build          # tsc -b && vite build      -> built
$ npm run lint           # eslint .                  -> clean
$ npm run format:check   # prettier --check          -> All matched files use Prettier code style!
$ npm run test:coverage  # jest --coverage           -> 15 suites, 199 tests, all passed
```

## Out of scope, stated so it is not mistaken for an omission

- **Sign-out is a client-side session discard.** No logout, sign-out or revoke
  gateway route is added and JWT validation and revocation behaviour is
  unchanged, so the already-issued token is **not invalidated at the platform
  level** and stays valid until it expires. Both the gateway guard and this
  repository's suite assert that no such route appeared.
- **No Dev, QA, Staging or Production origins are configured.** No such frontend
  environments exist yet; their origins, gateway URLs, DNS names and deployment
  targets are to be defined later. The single allowlisted origin is this
  client's local development origin, `DEV_SERVER_ORIGIN`.
