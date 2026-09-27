# REVIEW — JIRA 13652 test automation

Pacco.Web · Common Architecture · story *Pacco Login and Role-Aware Landing* ·
component `pacco-web-login`.

Source: `tests/cases/13652-testcases.csv` — 114 parsed records: a header, 112
functional rows and one trailing `REVIEW-NOTES` record, which is skipped.

**112 functional rows → 112 test methods.** Two of them (TC-111, TC-112) are
`test.fixme`, because the CSV marks them not automatable; they are declared so
the one-row-one-method contract holds and so a run reports them as *did not
run* rather than as passes.

This is the only narrative file in the suite. Everything else under
`tests/automation/13652/typescript-playwright/` is runnable code, configuration
or usage documentation.

---

## 1. How rows were routed

Nothing here was invented. Every title, acceptance-criteria tag, execution
intent and layer was transcribed from the CSV columns of the row it belongs
to. Two routing rules turn those columns into Playwright projects:

- the `@layer:` tag follows the CSV's **Automation Type**, except where **Type
  of testing** is `Accessibility`, in which case the row runs in the `a11y`
  project — that is how TC-057, TC-085…090, TC-095 and TC-112 land there while
  the CSV still calls them UI rows;
- rows whose steps require the running platform carry `@live` and are excluded
  from every offline project by `grepInvert`.

Rows that read the checkout rather than a browser carry `@layer:static`.

A row's tags are in its own title, so `--grep "@ac:AC-18"` selects by
acceptance criterion and `--grep "@intent:smoke"` by execution intent without
any list being maintained separately.

---

## 2. Coverage matrix

| Row | Project | Intent | Acceptance criteria | Spec file | Title |
| --- | --- | --- | --- | --- | --- |
| TC-13652-001 | ui | smoke | AC-1 | `specs/ui/login-screen.spec.ts` | Verify that one common Login screen is presented with no user-type selector |
| TC-13652-002 | ui | sanity | AC-1 | `specs/ui/login-screen.spec.ts` | Verify that the Login screen renders its approved copy word for word |
| TC-13652-003 | ui | sanity | AC-1 | `specs/ui/login-screen.spec.ts` | Verify that the identifier field is labelled, described and accepts typed input |
| TC-13652-004 | ui | sanity | AC-2 | `specs/ui/login-screen.spec.ts` | Verify that the password field is labelled, described and accepts typed input |
| TC-13652-005 | ui | smoke | AC-1 | `specs/ui/login-screen.spec.ts` | Verify that the Sign in action renders with its exact label and is enabled |
| TC-13652-006 | ui | sanity | AC-1 | `specs/ui/login-screen.spec.ts` | Verify that the Need help link renders and navigates nowhere outside the Login screen |
| TC-13652-007 | ui | regression | AC-7 | `specs/ui/login-screen.spec.ts` | Verify that no field on the Login screen is pre-filled when the screen loads |
| TC-13652-008 | ui | smoke | AC-2 | `specs/ui/login-screen.spec.ts` | Verify that the Password field masks its characters by default |
| TC-13652-009 | ui | sanity | AC-2 | `specs/ui/login-screen.spec.ts` | Verify that the password reveal control shows and then re-masks the typed value |
| TC-13652-010 | ui | regression | AC-2 | `specs/ui/login-screen.spec.ts` | Verify that the typed password appears in no DOM node other than its own input |
| TC-13652-011 | ui | regression | AC-3 | `specs/ui/login-validation.spec.ts` | Verify that submitting with both fields empty blocks the request and marks both fields |
| TC-13652-012 | ui | regression | AC-3 | `specs/ui/login-validation.spec.ts` | Verify that submitting with only the identifier empty blocks the request |
| TC-13652-013 | ui | regression | AC-3 | `specs/ui/login-validation.spec.ts` | Verify that submitting with only the password empty blocks the request |
| TC-13652-014 | ui | regression | AC-3 | `specs/ui/login-validation.spec.ts` | Verify that whitespace-only entries are treated as empty and block the request |
| TC-13652-015 | ui | regression | AC-4 | `specs/ui/login-validation.spec.ts` | Verify that five rapid activations of Sign in produce exactly one request |
| TC-13652-016 | ui | regression | AC-5 | `specs/ui/login-validation.spec.ts` | Verify that the submit lock is released after a failed request |
| TC-13652-017 | ui | regression | AC-4 | `specs/ui/login-validation.spec.ts` | Verify that the Sign in action announces its processing state during a request |
| TC-13652-018 | api | smoke | AC-6 | `specs/api/gateway-contract.spec.ts` | Verify that the browser client contacts only the local API Gateway address |
| TC-13652-019 | api | smoke | AC-6,AC-8 | `specs/api/gateway-contract.spec.ts` | Verify that the sign-in request body carries exactly the email and password fields |
| TC-13652-020 | static-analysis | regression | AC-6 | `specs/api/static-scans.spec.ts` | Verify that no host or port other than the configured gateway appears in source |
| TC-13652-021 | static-analysis | regression | AC-7 | `specs/api/static-scans.spec.ts` | Verify that a secret scan of the client source finds no credential |
| TC-13652-022 | static-analysis | regression | AC-7 | `specs/api/static-scans.spec.ts` | Verify that a secret scan of the built browser bundle finds no credential |
| TC-13652-023 | api | smoke | AC-8 | `specs/api/gateway-contract.spec.ts` | Verify that a successful sign-in establishes a session holding token, role and expiry |
| TC-13652-024 | api | regression | AC-8 | `specs/api/gateway-contract.spec.ts` | Verify that the refresh token is discarded and stored nowhere |
| TC-13652-025 | api | regression | AC-8,AC-17 | `specs/api/gateway-contract.spec.ts` | Verify that a mixed-case role from the platform is stored in lower case |
| TC-13652-026 | api | regression | AC-8,AC-18 | `specs/api/gateway-contract.spec.ts` | Verify that an unrecognised role value is stored verbatim and not replaced by a default |
| TC-13652-027 | ui | smoke | AC-8 | `specs/ui/login-messaging.spec.ts` | Verify that a successful sign-in takes the user to the Welcome screen |
| TC-13652-028 | api | smoke | AC-9 | `specs/api/error-mapping.spec.ts` | Verify that a rejected credential produces the fixed credentials message and no session |
| TC-13652-029 | api | regression | AC-10 | `specs/api/error-mapping.spec.ts` | Verify that an unrecognised address produces the same message as a wrong password |
| TC-13652-030 | api | regression | AC-12 | `specs/api/error-mapping.spec.ts` | Verify that an unrecognised platform error code produces the generic message |
| TC-13652-031 | api | regression | AC-12 | `specs/api/error-mapping.spec.ts` | Verify that an error response with no code field produces the generic message |
| TC-13652-032 | api | regression | AC-9 | `specs/api/error-mapping.spec.ts` | Verify that platform reason text never reaches the screen, storage or telemetry |
| TC-13652-033 | api | regression | AC-11 | `specs/api/error-mapping.spec.ts` | Verify that a server failure at the edge produces the temporarily-unavailable message |
| TC-13652-034 | api | regression | AC-11,AC-5 | `specs/api/error-mapping.spec.ts` | Verify that a refused connection produces the temporarily-unavailable message and releases the lock |
| TC-13652-035 | api | regression | AC-11 | `specs/api/error-mapping.spec.ts` | Verify that a request exceeding the configured timeout is aborted and reported as unavailable |
| TC-13652-036 | api | regression | AC-12 | `specs/api/error-mapping.spec.ts` | Verify that a success response with a malformed body creates no session |
| TC-13652-037 | api | regression | AC-12 | `specs/api/error-mapping.spec.ts` | Verify that a success response with an unusable token creates no session |
| TC-13652-038 | ui | regression | AC-9 | `specs/ui/login-messaging.spec.ts` | Verify that the Login screen shows one message at a time in an announced region |
| TC-13652-039 | ui | regression | AC-11 | `specs/ui/login-messaging.spec.ts` | Verify that the availability failure leaves the Login screen fully usable |
| TC-13652-040 | ui | regression | AC-12 | `specs/ui/login-messaging.spec.ts` | Verify that a malformed success keeps the user on the Login screen |
| TC-13652-041 | ui | regression | AC-13 | `specs/ui/login-messaging.spec.ts` | Verify that after a failure the address is kept, the password cleared, and retry succeeds |
| TC-13652-042 | ui | regression | AC-14 | `specs/ui/login-messaging.spec.ts` | Verify that the password never appears in the console, storage or telemetry |
| TC-13652-043 | static-analysis | regression | AC-14 | `specs/api/static-scans.spec.ts` | Verify that no client logging call site can emit a request body or token |
| TC-13652-044 | live-platform | regression | AC-15 | `specs/api/gateway-config.spec.ts` | Verify that all four gateway configuration files carry the identical single-origin policy |
| TC-13652-045 | live-platform | smoke | AC-16 | `specs/api/gateway-config.spec.ts` | Verify that a browser request from the allowed origin is accepted and echoed |
| TC-13652-046 | live-platform | regression | AC-16 | `specs/api/gateway-config.spec.ts` | Verify that a browser request from a different origin is refused by the cross-origin policy |
| TC-13652-047 | ui | smoke | AC-17 | `specs/ui/landing-role.spec.ts` | Verify that the role admin renders the administrator welcome message |
| TC-13652-048 | ui | regression | AC-17 | `specs/ui/landing-role.spec.ts` | Verify that the role Admin in mixed case renders the administrator welcome message |
| TC-13652-049 | ui | regression | AC-17 | `specs/ui/landing-role.spec.ts` | Verify that the role ADMIN in upper case renders the administrator welcome message |
| TC-13652-050 | ui | smoke | AC-18 | `specs/ui/landing-role.spec.ts` | Verify that the role user renders the ordinary welcome message |
| TC-13652-051 | ui | regression | AC-18 | `specs/ui/landing-role.spec.ts` | Verify that an empty role renders the ordinary welcome message |
| TC-13652-052 | ui | regression | AC-18 | `specs/ui/landing-role.spec.ts` | Verify that a whitespace-only role renders the ordinary welcome message |
| TC-13652-053 | ui | regression | AC-18 | `specs/ui/landing-role.spec.ts` | Verify that an absent role renders the ordinary welcome message without error |
| TC-13652-054 | ui | regression | AC-18 | `specs/ui/landing-role.spec.ts` | Verify that the role administrator does not render the administrator welcome message |
| TC-13652-055 | ui | regression | AC-18 | `specs/ui/landing-role.spec.ts` | Verify that the role superuser does not render the administrator welcome message |
| TC-13652-056 | ui | regression | AC-17 | `specs/ui/landing-role.spec.ts` | Verify that the heading and the role indicator always agree across every role value |
| TC-13652-057 | a11y | regression | AC-18 | `specs/ui/landing-role.spec.ts` | Verify that the role indicator conveys role as text, not colour or icon alone |
| TC-13652-058 | ui | regression | AC-19 | `specs/ui/landing-role.spec.ts` | Verify that an address beginning with admin does not produce the administrator welcome message |
| TC-13652-059 | static-analysis | regression | AC-19 | `specs/api/static-scans.spec.ts` | Verify that no presentation decision reads the identifier or negates the ordinary role |
| TC-13652-060 | ui | smoke | AC-20 | `specs/ui/landing-guard.spec.ts` | Verify that opening the landing address with no session redirects to the Login screen |
| TC-13652-061 | ui | regression | AC-20 | `specs/ui/landing-guard.spec.ts` | Verify that reloading the landing address with no session redirects to the Login screen |
| TC-13652-062 | ui | regression | AC-20 | `specs/ui/landing-guard.spec.ts` | Verify that returning to the landing address with no session redirects to Login |
| TC-13652-063 | ui | regression | AC-26 | `specs/ui/landing-guard.spec.ts` | Verify that a live session survives a landing screen reload with no network call |
| TC-13652-064 | ui | smoke | AC-21 | `specs/ui/landing-guard.spec.ts` | Verify that an expired session is discarded and reported with its own distinct notice |
| TC-13652-065 | ui | regression | AC-21 | `specs/ui/landing-guard.spec.ts` | Verify that the expiry decision is correct at its boundary and fails closed when unreadable |
| TC-13652-066 | ui | smoke | AC-22 | `specs/ui/landing-guard.spec.ts` | Verify that logging out clears the session entirely and contacts the platform not at all |
| TC-13652-067 | ui | regression | AC-23 | `specs/ui/landing-guard.spec.ts` | Verify that navigating back after logout does not restore the landing screen |
| TC-13652-068 | ui | regression | AC-23 | `specs/ui/landing-guard.spec.ts` | Verify that logout moves focus to the Login heading and a second sign-in succeeds |
| TC-13652-069 | live-platform | regression | AC-24 | `specs/api/gateway-config.spec.ts` | Verify that the gateway configuration change touches only the allowed-origin key |
| TC-13652-070 | live-platform | regression | AC-25 | `specs/api/gateway-config.spec.ts` | Verify that a non-browser caller sending no origin header still succeeds |
| TC-13652-071 | ui | smoke | AC-26 | `specs/ui/landing-guard.spec.ts` | Verify that the landing screen shows only its four permitted elements and calls nothing |
| TC-13652-072 | static-analysis | regression | AC-27 | `specs/api/static-scans.spec.ts` | Verify that the client source contains no renewal path or refresh route reference |
| TC-13652-073 | ui | regression | AC-27 | `specs/ui/landing-guard.spec.ts` | Verify that an idle session issues no traffic and simply ends when its expiry passes |
| TC-13652-074 | ui | regression | AC-21 | `specs/ui/landing-guard.spec.ts` | Verify that an expired session cannot return to the signed-in state without a fresh sign-in |
| TC-13652-075 | live-platform | smoke | AC-28,AC-18,AC-8 | `specs/ui/e2e-live-platform.spec.ts` | Verify that an ordinary user completes the whole journey against the running platform |
| TC-13652-076 | live-platform | smoke | AC-28,AC-17 | `specs/ui/e2e-live-platform.spec.ts` | Verify that an administrator completes the whole journey against the running platform |
| TC-13652-077 | live-platform | smoke | AC-9,AC-13 | `specs/ui/e2e-live-platform.spec.ts` | Verify that a wrong password against the running platform shows the credentials message |
| TC-13652-078 | live-platform | regression | AC-10 | `specs/ui/e2e-live-platform.spec.ts` | Verify that an unknown address against the running platform is indistinguishable from a wrong password |
| TC-13652-079 | live-platform | regression | AC-3 | `specs/ui/e2e-live-platform.spec.ts` | Verify that empty fields against the running platform produce no traffic at all |
| TC-13652-080 | live-platform | regression | AC-4 | `specs/ui/e2e-live-platform.spec.ts` | Verify that rapid activations against the running platform reach it exactly once |
| TC-13652-081 | live-platform | regression | AC-11 | `specs/ui/e2e-live-platform.spec.ts` | Verify that the client recovers when the backend sign-in service is stopped and restarted |
| TC-13652-082 | live-platform | smoke | AC-6,AC-8,AC-26 | `specs/ui/e2e-live-platform.spec.ts` | Verify that the full round trip contacts only the gateway port across every screen |
| TC-13652-083 | live-platform | regression | AC-22 | `specs/api/platform-regression.spec.ts` | Verify that a token captured before logout stays acceptable to the platform afterwards |
| TC-13652-084 | live-platform | regression | AC-17,AC-18,AC-20,AC-22,AC-28 | `specs/ui/e2e-live-platform.spec.ts` | Verify that the stitched journey covers both roles, reload, logout and re-entry |
| TC-13652-085 | a11y | regression | AC-1 | `specs/a11y/accessibility.spec.ts` | Verify that the Login screen has no automated accessibility violations |
| TC-13652-086 | a11y | regression | AC-26 | `specs/a11y/accessibility.spec.ts` | Verify that the landing screen has no automated accessibility violations |
| TC-13652-087 | a11y | regression | AC-1,AC-3 | `specs/a11y/accessibility.spec.ts` | Verify that the Login screen can be completed by keyboard in the documented order |
| TC-13652-088 | a11y | regression | AC-26,AC-22 | `specs/a11y/accessibility.spec.ts` | Verify that the landing screen is keyboard operable and focuses its heading on entry |
| TC-13652-089 | a11y | regression | AC-3,AC-21 | `specs/a11y/accessibility.spec.ts` | Verify that error and status messages are announced to assistive technology |
| TC-13652-090 | a11y | regression | AC-1,AC-26 | `specs/a11y/accessibility.spec.ts` | Verify that text on both screens meets the minimum contrast ratio |
| TC-13652-091 | ui | regression | AC-1 | `specs/ui/responsive.spec.ts` | Verify that the Login screen is usable at the narrowest supported width |
| TC-13652-092 | ui | regression | AC-1,AC-26 | `specs/ui/responsive.spec.ts` | Verify that both screens are usable on a typical mobile viewport |
| TC-13652-093 | ui | regression | AC-1,AC-26 | `specs/ui/responsive.spec.ts` | Verify that both screens are usable at the tablet breakpoint |
| TC-13652-094 | ui | regression | AC-1,AC-26 | `specs/ui/responsive.spec.ts` | Verify that both screens render correctly at the desktop width |
| TC-13652-095 | a11y | regression | AC-1,AC-26 | `specs/a11y/accessibility.spec.ts` | Verify that both screens remain usable at double magnification |
| TC-13652-096 | ui | regression | AC-14 | `specs/ui/input-and-analytics.spec.ts` | Verify that the sign-in analytics events carry no credential, token or platform error text |
| TC-13652-097 | ui | regression | AC-18 | `specs/ui/input-and-analytics.spec.ts` | Verify that the landing analytics events record the role outcome without the raw role value |
| TC-13652-098 | ui | regression | AC-9 | `specs/ui/input-and-analytics.spec.ts` | Verify that hostile and oversized input in the identifier field is handled safely |
| TC-13652-099 | api | regression | AC-14 | `specs/api/gateway-contract.spec.ts` | Verify that credentials never travel in the address, a header or the browser history |
| TC-13652-100 | api | regression | AC-16,AC-6 | `specs/api/gateway-contract.spec.ts` | Verify that the sign-in call is anonymous and carries no ambient credentials |
| TC-13652-101 | live-platform | regression | AC-24 | `specs/api/platform-regression.spec.ts` | Verify that the gateway still protects every other route exactly as before |
| TC-13652-102 | live-platform | regression | AC-25 | `specs/api/platform-regression.spec.ts` | Verify that the backend sign-in service still behaves exactly as before the change |
| TC-13652-103 | live-platform | regression | AC-25 | `specs/api/platform-regression.spec.ts` | Verify that a successful sign-in still publishes its notification on the existing message bus |
| TC-13652-104 | live-platform | regression | AC-6 | `specs/api/platform-regression.spec.ts` | Verify that the backend stack starts and works without the browser client running |
| TC-13652-105 | live-platform | regression | AC-6 | `specs/ui/e2e-live-platform.spec.ts` | Verify that the browser client runs as its own local process on its own origin |
| TC-13652-106 | live-platform | smoke | AC-28,AC-8,AC-17,AC-20 | `specs/ui/e2e-live-platform.spec.ts` | Verify that a real sign-in session drives the guard and the welcome message |
| TC-13652-107 | ui | sanity | AC-20 | `specs/ui/landing-guard.spec.ts` | Verify that the application root resolves correctly in both session states |
| TC-13652-108 | ui | regression | AC-4 | `specs/ui/input-and-analytics.spec.ts` | Verify that pressing Enter in either field submits the sign-in form |
| TC-13652-109 | ui | regression | AC-2 | `specs/ui/input-and-analytics.spec.ts` | Verify that the password field accepts a pasted value from a password manager |
| TC-13652-110 | ui | regression | AC-3 | `specs/ui/input-and-analytics.spec.ts` | Verify that browser autofill populates both fields and the form still validates |
| TC-13652-111 | ui (manual — `fixme`) | regression | AC-1 | `specs/manual/manual-review.spec.ts` | Verify that the rendered screens match the reference design by manual review |
| TC-13652-112 | a11y (manual — `fixme`) | regression | AC-1,AC-26,AC-3,AC-21 | `specs/manual/manual-review.spec.ts` | Verify that both screens are announced coherently in a manual screen-reader pass |

### Distribution

| Project | Rows |
| --- | ---: |
| `ui` | 58 |
| `live-platform` | 21 |
| `api` | 18 |
| `a11y` | 9 |
| `static-analysis` | 6 |
| **Total** | **112** |

Two of the 58 `ui` and 9 `a11y` rows are the `fixme` manual pair (TC-111 in
`ui`, TC-112 in `a11y`); they are reported as skipped, never as passes.

Every acceptance criterion named anywhere in the CSV — AC-1 through AC-28 —
appears on at least one method.

---

## 3. Review checklist

### A. Security and secrets

| # | Check | Outcome |
| --- | --- | --- |
| SEC-1 | No hardcoded credential, token, key or PII in any generated file | Met. Every account, password and canary is read from the environment. `support/env.ts` declares thirteen `REQUIRED_CREDENTIAL_VARS` with **no source default**, so an unset variable fails the run instead of falling back. |
| SEC-2 | `.env.example` lists every variable the suite reads | Met — 87 lines, grouped and commented. |
| SEC-3 | `.gitignore` excludes `.env`, `.env.*`, `secrets/`, `*.pem`, `*.key`, `*.p12`, `credentials.json`, `.idea/`, `.vscode/`, `.DS_Store` | Met by a suite-local `.gitignore`. The repository-root file is untouched. |
| SEC-4 | CI runs a secret scan | Met — gitleaks and TruffleHog, in a job that gates the rest. |
| SEC-5 | PII redaction wired into the logger | Met — `support/logger.ts` redacts by key and by pattern (e-mail, JWT, Bearer), and the failure-evidence fixture passes every attachment through it. |
| SEC-6 | TLS verification on by default | Met — `PACCO_IGNORE_HTTPS_ERRORS=false`. |
| SEC-7 | Generated tests do not weaken the product's security posture | Met. No test adds a route, relaxes a header or installs a permanent hook in the client. |

The fixture tokens in `support/jwt.ts` are unsigned strings minted inside the
test process with a placeholder signature. They are not credentials and cannot
authenticate anything.

### B. Observability and reporting

| # | Check | Outcome |
| --- | --- | --- |
| OBS-1 | Structured logging | Met — one JSON object per line, from `support/logger.ts`. |
| OBS-2 | Correlation id per test | Met — derived from the row id, on every log line and attached on failure. |
| OBS-3 | Failure evidence | Met — trace, screenshot and video on failure, plus network, navigation, console and telemetry attachments from an auto-use fixture. |
| OBS-4 | JUnit XML | Met — `reports/junit/results.xml`, published by `mikepenz/action-junit-report`. |
| OBS-5 | Human-readable report | Met — HTML report and `npm run report`. |
| OBS-6 | Failures name the thing that failed | Met — every non-obvious assertion carries a message naming the file, line, origin or value that broke it. |

### C. Quality gates and CI/CD

| # | Check | Outcome |
| --- | --- | --- |
| CI-1 | Lint and format configured and runnable | Met — ESLint flat config plus Prettier. |
| CI-2 | Type checking | Met — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`. |
| CI-3 | Dependencies pinned | Met — every dependency is an exact version, no ranges. See finding 4. |
| CI-4 | CI workflow present | Met — four jobs. See finding 5 for the activation step. |
| CI-5 | Container image | Met — `Dockerfile` on the pinned Playwright base image, running as `pwuser`. |
| CI-6 | Offline and live runs separated | Met — `npm run test:offline` needs no platform; `live-tests` is manual dispatch only. |

### D. Test data and environments

| # | Check | Outcome |
| --- | --- | --- |
| DATA-1 | No environment coupling in test code | Met — no spec or page object reads `process.env`; everything comes through the `env` fixture. |
| DATA-2 | Test data separated from logic | Met — `support/testData.ts`. |
| DATA-3 | Deterministic data | Met — no random values; the only entropy is the correlation id. |
| DATA-4 | No cross-test dependencies | Met — every test establishes its own state; the suite runs `fullyParallel`. |
| DATA-5 | Cleanup | Met — sessions live in `sessionStorage` and die with the context; TC-081 restores the service it stopped in a `finally`. |
| DATA-6 | No hardcoded base URLs | Met, and lint-enforced: an `^https?://` literal in suite code is an ESLint error. |
| DATA-7 | No hardcoded numeric timeouts | Met — every wait is configured. TC-035 derives its delay from the configured sign-in limit rather than writing 20000. |
| DATA-8 | No literal credentials in spec, page-object or step code | Met, and lint-enforced for both credential-shaped and e-mail-shaped literals. |
| DATA-9 | Configuration validated before the run | Met — `validateEnvConfig()` runs at config load and names every missing variable at once. |

### E. Format and structure

| # | Check | Outcome |
| --- | --- | --- |
| FORMAT-1 | One test method per functional CSV row | Met — 112 for 112, verified by id. |
| FORMAT-2 | Titles transcribed, not paraphrased | Met — each title is the CSV's own, followed by its tags. |
| FORMAT-3 | Suite confined to one deterministic root | Met — every file is under `tests/automation/13652/typescript-playwright/`. |
| REUSE-1 | Page Object Model discipline | Met, and lint-enforced: `pages/**` may not contain a click, fill, navigation or assertion. |
| REUSE-2 | Shared helpers, not copy-paste | Met — fixtures, actions, stubs, sweeps and scans are each defined once. |

### F. Fidelity to the CSV

| # | Check | Outcome |
| --- | --- | --- |
| CSV-1 | Parsed as RFC 4180, semicolon-delimited, UTF-8, 20 columns | Met. |
| CSV-2 | Continuation rows merged | Met — 2245 physical lines became 114 records. |
| CSV-3 | `REVIEW-NOTES` row skipped | Met. |
| CSV-4 | Every populated expectation asserted | Met — each row asserts its message, status, storage, traffic and navigation expectations, not merely the first of them. |
| CSV-5 | Negative rows keep their own status codes | Met — exact equality throughout, never a range and never a defaulted 400. The statuses asserted are the ones the CSV names: 200, 400, 401, 500, 502, 503, 504. |
| TRACE-1 | Acceptance criteria tagged from the CSV | Met. |
| TRACE-2 | Execution intent tagged from the CSV | Met. |
| TRACE-3 | No invented endpoints or payloads | Met — the only backend address in the suite is the configured gateway and its sign-in path. |
| Rule 8 | No fixed delays | Met — no `waitForTimeout`, no `setTimeout`, no hand-rolled sleep. Idle windows are observed with `watchForBackendTraffic`, which waits for a *request event* and treats the timeout as the passing outcome, so a failing run fails immediately instead of sitting out the window. The single timer in `support/responseDelay.ts` makes a stubbed response slow; it never synchronises a test. |

---

## 4. Open findings

These are honest statements about what this suite will and will not tell you.
None of them is a reason to change the generated tests; each is a reason to
read a particular result carefully.

**1. Roughly forty rows describe a screen the client does not have yet.**
`src/Router.tsx` is wave-1: it routes `/` and `/login`, and there is no
`/welcome`, no route guard and no logout control. Every landing, guard,
expiry and logout row — TC-047…058, 060…068, 071, 073…076, 084, 088, 097,
106, 107 among them — was generated faithfully from the CSV and will fail
against the current client. That is the correct outcome: the rows describe
the agreed behaviour, and the failures are the work remaining, not a defect
in the suite. They should pass unchanged once wave 2 lands.

**2. Client telemetry is not observable from a browser test.**
`src/platform/telemetry.ts` holds `let sink: TelemetrySink | null = null` and
`emit` returns early while that is so, so nothing the application emits can be
seen from outside. TC-096 and TC-097 are mitigated three ways: an init script
installs a collector and calls `window.__paccoInstallTelemetrySink__` if the
application ever offers one; the runtime sweeps cover storage, cookies,
IndexedDB, the DOM, the console and request bodies regardless of telemetry;
and TC-043 asserts the same property statically over the telemetry module's
call sites. Until a sink exists, the runtime half of those two rows inspects
an empty collection — the static and sweep halves still bite.

**3. TC-037's negative-`exp` case is expected to fail, and the failure is a
real finding.** The client's `readAccessTokenExpiry` accepts any integer,
including `-1`, so a token carrying `exp: -1` yields a session where the CSV
says none may exist. The test asserts the CSV's expectation. Fixing the client
to reject a non-future expiry would be the correct resolution.

**4. There is no lockfile.** One cannot be generated without network access,
so every dependency is pinned to an exact version instead and CI uses `npm ci`
when a lockfile is present, falling back to `npm install` when it is not. The
first maintainer with network access should run `npm install` here and commit
the resulting `package-lock.json`.

**5. The CI workflow needs one copy to activate.** Everything must live under
the suite root, but GitHub Actions reads only `.github/workflows/` at the
repository root. The workflow is therefore committed inside the suite with the
one-line copy command in README.md. It does nothing until copied.

**6. TC-083 records rather than gates.** A token captured before logout stays
acceptable to the platform afterwards. That is the accepted consequence of a
client-side logout: the browser discards the session, and the gateway performs
no revocation. The row attaches the observed status as evidence and asserts
only that the platform answered, because failing the pipeline would report a
documented design decision as a defect. **Stated plainly: logging out does not
invalidate the already-issued token at the platform level.** Anyone who needs
that guarantee needs a revocation mechanism, which this ticket deliberately
does not introduce — no new logout or revoke route was added, and the
gateway's JWT validation behaviour is unchanged.

**7. Five rows need a gateway checkout, including the two that only read
files.** TC-044 and TC-069 read the four Ntrada configuration files and diff
one of them against a baseline revision; TC-045, TC-046 and TC-070 put
requests through the running edge. All five carry `@live` so they run in the
job that has the checkout, rather than failing in an offline job that never
could have had it. TC-069 additionally needs history: in a shallow clone there
is no baseline to compare against, and the row says so rather than passing.

**8. TC-110 simulates autofill.** Chromium exposes no API for a test to
trigger its own credential autofill, so the row reproduces what autofill does
to the DOM — assigns through the native value setter and dispatches a single
`input` event, with no key events. That is a faithful model of the mechanism
the row cares about (validation must treat a value that arrived without
keystrokes as filled), but it is a model, not the browser feature itself.

**9. TC-022 requires a built bundle.** The row scans `dist/`. If the client has
not been built it fails with a message saying so, rather than passing on an
empty scan. CI builds the client before the offline projects for this reason.

**10. Two rows are not automated at all.** TC-111 (comparison against the
reference design) and TC-112 (a screen-reader pass) are `test.fixme` with the
reviewer's procedure in their annotations. A machine can confirm that a
heading has an accessible name; it cannot confirm that a screen reads
coherently.

---

## 5. Environment scope

There are currently no separate Dev, QA, Staging or Production frontend
environments. Every address this suite uses is a local process:
`PACCO_WEB_BASE_URL` for the browser client and `PACCO_GATEWAY_BASE_URL` for
the single local API Gateway. Origins, gateway addresses, DNS names and
deployment targets for other environments are to be defined later; when they
are, they belong in `.env` files, not in test code.

Two architectural facts the suite asserts rather than assumes:

- **Pacco.Web is a standalone browser client.** TC-105 checks that it is
  served from its own origin, that every asset comes from that origin, and
  that the gateway does not serve it. TC-104 checks that no compose service is
  the browser client and that the backend stack works with no client running.
- **Logout is a client-side session discard.** TC-066 checks that logging out
  clears every browser storage area and issues no backend request; TC-083
  records what the platform still thinks of the discarded token.
