# Pacco.Web — JIRA 13652 automation suite

TypeScript + Playwright. One test method per functional row of
`tests/cases/13652-testcases.csv` — 131 rows, 131 methods.

This suite is self-contained: it has its own `package.json`, its own
`node_modules`, and its own `.gitignore`. It never builds, serves or embeds the
browser client. The client runs as its own local process; the suite drives it.

---

## Install

```bash
cd tests/automation/13652/typescript-playwright
npm ci
npm run install:browsers
```

Node 20.19 or newer is required (`engines` in `package.json`).

`package-lock.json` is committed, so `npm ci` is the install command everywhere
— locally, in the Docker image and in CI. `package.json` also pins
`playwright-core` through `overrides`; without that pin `@axe-core/playwright`
pulls in a second copy and the suite stops typechecking.

## Configure

Copy the template and edit the copy. `.env` is git-ignored; `.env.example` is
the committed record of every variable the suite reads.

```bash
cp .env.example .env
```

Fourteen variables have **no default** — the suite refuses to start without
them rather than falling back to a credential baked into source. They are the
synthetic account addresses and passwords, the wrong-passphrase sequence
TC-13652-119 needs, and the three canary values. `playwright.config.ts` calls
`validateEnvConfig()` at load time and lists every missing name in one message.

The values shipped in `.env.example` are synthetic fixtures, not real
credentials. Replace them with whatever your local platform actually accepts
before running the `live-platform` project.

Addresses the suite needs:

| Variable                      | Meaning                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `PACCO_WEB_BASE_URL`          | Where the browser client is served locally              |
| `PACCO_GATEWAY_BASE_URL`      | The single local API Gateway                            |
| `PACCO_SIGN_IN_PATH`          | The gateway's sign-in route                             |
| `PACCO_PROTECTED_ROUTE_PATH`  | Any route the gateway protects, for the regression rows |
| `PACCO_DISALLOWED_ORIGIN_URL` | An origin the gateway must refuse                       |

There are currently no separate Dev, QA, Staging or Production frontend
environments. Everything here points at local processes; other origins,
gateway addresses and DNS names are to be defined when those environments
exist.

Timing and repetition counts are configuration too, so a slower machine is
tuned rather than patched. `PACCO_TELEMETRY_HOLD_MS` and
`PACCO_IN_FLIGHT_HOLD_MS` say how long a stubbed response is held open while a
mid-flight state is read; `PACCO_SHORT_SESSION_SECONDS` and
`PACCO_CLOCK_ADVANCE_MS` drive the expiry rows; `PACCO_LATENCY_SAMPLES`,
`PACCO_FAILED_ATTEMPTS` and `PACCO_DUPLICATE_CLICKS` say how many times the
repetition rows repeat. None of them is a sleep — every wait in the suite is
still an assertion or an event.

## Run

The suite is split into five Playwright projects. Each row's own CSV layer
decides which project runs it, through the `@layer:` tag in its title.

| Command                | Project           | What it runs                                         |
| ---------------------- | ----------------- | ---------------------------------------------------- |
| `npm run test:static`  | `static-analysis` | Rows that read the checkout, not a browser           |
| `npm run test:api`     | `api`             | The client↔gateway contract, against a stubbed edge |
| `npm run test:ui`      | `ui`              | The screens                                          |
| `npm run test:a11y`    | `a11y`            | axe scans, keyboard and contrast                     |
| `npm run test:offline` | all four above    | Everything that needs no running platform            |
| `npm run test:live`    | `live-platform`   | Rows tagged `@live`                                  |
| `npm test`             | all five          | Everything                                           |

### What each project needs

**`static-analysis`** reads `src/` and, for TC-13652-022, `dist/`. Build the
client first or that row will fail by design rather than pass on an empty
scan:

```bash
(cd ../../../.. && npm run build)
```

**`api`**, **`ui`** and **`a11y`** need the client served on
`PACCO_WEB_BASE_URL` and nothing else — the gateway is stubbed. Serve it in
another terminal:

```bash
(cd ../../../.. && npm run build && npx vite preview --port 5173 --strictPort)
```

Or let the suite start it for you by setting `PACCO_START_WEB_SERVER=true`.

**`live-platform`** needs three things running: the client, the Docker Compose
backend, and a gateway checkout on disk.

```bash
# in the platform checkout
docker compose -f infrastructure.yml -f services.yml up -d
```

Point the suite at the checkouts if they are not siblings of this repository:

| Variable                     | Used by                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `PACCO_COMPOSE_DIR`          | Starting and stopping services (TC-081, TC-103, TC-104) |
| `PACCO_GATEWAY_CONFIG_DIR`   | Reading the four Ntrada files (TC-044, TC-069)          |
| `PACCO_GATEWAY_BASELINE_REV` | The revision TC-069 diffs against                       |

TC-13652-081 stops and restarts `PACCO_SIGNIN_SERVICE_NAME` through
`docker compose`, then starts it again in a `finally` block. If it is
interrupted, bring the service back by hand before the next run.

### Selecting rows

Titles carry their own tags, so `--grep` works on any of them:

```bash
npx playwright test --grep "@ac:AC-18"        # one acceptance criterion
npx playwright test --grep "@intent:smoke"    # the CSV's execution intent
npx playwright test --grep "TC-13652-035"     # one row
```

## Reports

| Path                        | Contents                                      |
| --------------------------- | --------------------------------------------- |
| `reports/html/`             | The Playwright HTML report — `npm run report` |
| `reports/junit/results.xml` | JUnit XML for CI                              |
| `reports/json/results.json` | Machine-readable results                      |
| `reports/artifacts/`        | Traces, screenshots and videos from failures  |
| `reports/a11y/`             | `npm run a11y:scan` output                    |

A failing test attaches its correlation id, the requests it issued, the
addresses it visited, the console output and the telemetry it captured. All of
it passes through the redactor first, so a report never carries a password, a
token or an address.

## Accessibility scan on its own

```bash
npm run a11y:scan
```

Walks the pages in `config/a11y.config.ts`, writes `reports/a11y/results.json`
and `reports/a11y/summary.md`, and exits 1 when violations are found and
`A11Y_FAIL_ON_VIOLATIONS` is on. The level and tag list come from
`A11Y_WCAG_LEVEL` / `A11Y_WCAG_TAGS`, the same values the `a11y` project uses.

## Quality gates

```bash
npm run lint          # ESLint, including this suite's own rules
npm run format:check  # Prettier
npm run typecheck     # tsc --noEmit
```

The ESLint configuration enforces three suite rules beyond the usual set:

- no fixed delays anywhere — no `waitForTimeout`, no `setTimeout`, no
  hand-rolled sleep. `support/responseDelay.ts` holds the single exception, and
  it exists only to make a stubbed response _slow_, never to synchronise a test;
- no absolute addresses, credential-shaped literals or e-mail addresses in
  spec or page-object code — they belong in `.env`;
- page objects stay declarative. `pages/**` may expose locators and nothing
  else; every click, fill and navigation lives in `support/actions.ts`.

## Docker

```bash
docker build -t pacco-13652-suite .
docker run --rm --network host --env-file .env pacco-13652-suite
```

The image runs the four offline projects by default. Override the command to
choose another:

```bash
docker run --rm --network host --env-file .env pacco-13652-suite --project=a11y
```

The image contains only the suite. It never builds or serves the client.

## CI

`.github/workflows/test-automation-13652.yml` lives inside this suite so the
whole deliverable stays in one directory. GitHub Actions only reads workflows
from the repository root, so activate it with one copy:

```bash
mkdir -p .github/workflows
cp tests/automation/13652/typescript-playwright/.github/workflows/test-automation-13652.yml \
   .github/workflows/
```

Four jobs: a secret scan, the quality gates, the offline projects, and the
live projects behind a manual dispatch.

## Layout

```
config/a11y.config.ts     WCAG level, tags, pages, thresholds
pages/                    Locators only — no actions, no assertions
scripts/scan-and-report.ts  Standalone accessibility scan
specs/a11y/               Rows the CSV marks Accessibility
specs/api/                Rows the CSV marks API
specs/manual/             The two rows that are not automatable
specs/ui/                 Rows the CSV marks UI
support/                  Fixtures, actions, stubs, observers, scans
REVIEW.md                 Coverage matrix and open findings
```
