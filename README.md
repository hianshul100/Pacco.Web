# Pacco.Web

The Pacco browser client. It is a **standalone browser application**: it is not
embedded in a backend service image, it is not served by the API Gateway, and it
runs as its own local process alongside the Docker Compose backend.

It reaches the platform through **one** URL — the local API Gateway at
`http://localhost:5000`. No browser code addresses `identity-service` or any other
service directly, and no container port appears anywhere in this repository
(ADR-021 §5 rule 3).

This wave delivers the **common sign-in experience**: one sign-in screen, one call
to `POST /identity/sign-in` through the gateway, and a browser session bounded by
the access token's own expiry.

---

## Scope of this runbook

⚠️ **Local development only.** There are currently no separate Dev, QA, Staging or
Production frontend environments. Environment-specific origins, gateway URLs, DNS
names and deployment targets are **defined later**, when those environments are
introduced (ADR-021 §5 rule 6). Nothing below is a build, release, deployment or
pipeline instruction, and none should be inferred from it.

---

## Prerequisites

- Node.js 20.19+ or 22.12+ (Vite 7 requirement) and npm
- Docker and Docker Compose, for the backend
- A checkout of `Pacco` (the compose repository) and of `Pacco.APIGateway`

---

## Running it

### 1. Bring up the backend

From the `Pacco` repository's `compose` directory:

```bash
docker-compose -f infrastructure.yml up -d
docker-compose -f services-local.yml up
```

`services-local.yml` **builds** the gateway from `../../Pacco.APIGateway`, which is
what makes the CORS change in step 3 take effect. (`services.yml` pulls the
published `devmentors/pacco.apigateway` image instead and would ignore local edits.)

The gateway is then listening on **`http://localhost:5000`**. Confirm it:

```bash
curl -i http://localhost:5000/identity/sign-in -X POST \
  -H 'content-type: application/json' -d '{"email":"","password":""}'
```

A `400` response means the edge is up and routing to the identity service. (A `000`
or connection refused means it is not.)

### 2. Run Pacco.Web as its own local process

From **this** repository:

```bash
npm install
npm run dev
```

It serves on **`http://localhost:3000`**, pinned with `strictPort: true` so it will
fail loudly rather than silently drift to another port — the port is half of the
CORS contract in step 3, so it must not move on its own.

Open `http://localhost:3000/login`.

### 3. Align the gateway's CORS origin with that port

The edge names its browser caller exactly (ADR-021 §5 rule 4). All four
configuration files in `Pacco.APIGateway/src/Pacco.APIGateway` carry an identical
CORS block and **must stay identical**:

- `ntrada.yml`
- `ntrada.docker.yml`
- `ntrada-async.yml`
- `ntrada-async.docker.yml`

Each now reads:

```yaml
  cors:
    allowCredentials: true
    allowedOrigins:
      - 'http://localhost:3000'
```

The wildcard `'*'` is gone, and `allowCredentials: true` is retained — a wildcard
origin and credentialed requests are mutually exclusive under the CORS
specification, so the previous pairing could never have worked from a browser.

The single source of truth for that origin in this repository is
[`src/config/devServerOrigin.ts`](src/config/devServerOrigin.ts). `vite.config.ts`
derives the dev-server port from it, and
[`tests/gateway/corsConfiguration.test.ts`](tests/gateway/corsConfiguration.test.ts)
asserts the four gateway files agree with it. **If you change the port, change that
one constant and the four gateway files together**, or the test will fail — which is
the point.

### 4. Restart the gateway so it re-reads its configuration

```bash
docker-compose -f services-local.yml up -d --build api-gateway
```

### 5. Verify

1. Load `http://localhost:3000/login`.
2. Submit valid credentials. The browser navigates to `/welcome` and the session
   appears in `sessionStorage` under the key `pacco.session`. **`/welcome` renders
   nothing in this wave** — the post-sign-in screen is wave-2 — so an intentionally
   empty page there is a pass, not a fault.
3. Submit wrong credentials. The screen should show *"The email or password you
   entered is incorrect."* and nothing from the backend response.
4. Stop the gateway and submit again. The screen should show *"Sign-in is
   temporarily unavailable. Please try again."*
5. In DevTools → Network, confirm the preflight `OPTIONS` and the `POST` both return
   `Access-Control-Allow-Origin: http://localhost:3000` (not `*`).

---

## Runtime configuration

Configuration is **injected, not embedded** (ADR-008). `index.html` loads
[`public/pacco-config.js`](public/pacco-config.js) before the application bundle:

```js
window.__PACCO_CONFIG__ = {
  gatewayBaseUrl: 'http://localhost:5000',
  signInTimeoutMs: 15000,
}
```

Exactly two keys, and no third. `signInTimeoutMs` is a **provisional** default and
is explicitly **not** an SLO: ADR-021 §8 N8 records that no availability target,
latency budget or error-rate objective is documented for this platform, so no number
here may be read as one.

**No secret, API key, token or credential belongs in this file, in this repository,
or in the bundle.** `tests/security/negativeAnchors.test.tsx` (NEG-3) scans for them
on every test run.

---

## Session and sign-out

- The session lives in `sessionStorage` under `pacco.session` and holds the access
  token, the role exactly as the backend returned it (lower-cased), and the expiry.
- **The refresh token is discarded unread.** No statement in this repository reads
  `refreshToken`; there is no renewal mechanism anywhere (ADR-022 §5 rules 1 and 5).
- Expiry is taken from the access token's own `exp` claim, never from
  `AuthDto.Expires` (ADR-022 §5 rule 2).
- **Sign-out is a client-side session discard only.** The sign-out *control* lands
  with the post-sign-in screen in a later wave and is not in this repository yet;
  what is settled here is the contract it will use. Discarding the session means
  clearing `pacco.session` and returning the browser to the sign-in screen. It calls
  no logout or revoke route — **none exists, and none was added to the gateway** —
  and it changes nothing about how the gateway validates tokens.

  ⚠️ **Limitation, stated rather than hidden:** the already-issued access token is
  **not** invalidated at the platform level. It remains acceptable to the gateway
  and to the domain services until it expires (ADR-021 §5 rule 5, §8 N6). Anyone who
  captured that token before sign-out can keep using it until `exp`.

---

## Error presentation

The browser reads exactly one field from a failure response: `code`. The `reason`
field is never rendered, never logged and never placed in telemetry. Messages come
from a **closed, client-owned set** in
[`src/session/messageRegistry.ts`](src/session/messageRegistry.ts); an unrecognised
code resolves to the generic message by construction, not by a catch-all branch
(ADR-023 §5).

`invalid_credentials` and `invalid_email` deliberately resolve to the **same**
message, so the screen cannot be used to discover whether an account exists.

This matters because the gateway's four configuration files all set
`customErrors.includeExceptionMessage: true`, so downstream exception text *does*
reach the browser. It is the browser's job not to show it.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on `http://localhost:3000` |
| `npm run build` | `tsc -b` then `vite build` |
| `npm run preview` | Serves `dist/` on `http://localhost:3000` |
| `npm run typecheck` | `tsc -b --force` |
| `npm run lint` | ESLint over the whole repository |
| `npm run format:check` | Prettier check |
| `npm test` | Jest + React Testing Library |
| `npm run test:coverage` | The same, with coverage thresholds enforced |

`tests/` mirrors `src/`. The security anchors run as a **named suite** in
`tests/security/negativeAnchors.test.tsx`, not as incidental assertions.

`tests/gateway/corsConfiguration.test.ts` reads the four `ntrada*.yml` files from a
sibling `hianshul100_Pacco.APIGateway` checkout. Where that checkout is absent the
suite **skips explicitly** rather than passing silently.

---

## Visual verification

The sign-in screen is checked against `.attachments/02_login-page-ux.png`:

```bash
npm run build
npx vite preview --port 3000 --strictPort &
chromium --headless --no-sandbox --disable-dev-shm-usage --disable-gpu \
  --screenshot=/tmp/login.png --window-size=1400,900 \
  --virtual-time-budget=10000 http://localhost:3000/login
```

Automated contrast checking is **not** covered by the jsdom accessibility suite:
axe-core's `color-contrast` rule is disabled there because jsdom applies no
stylesheet and implements no canvas, so it has no rendered colour to measure. It is
checked against the screenshot instead. Every other WCAG 2.1 A/AA rule runs in
`tests/a11y/login.a11y.test.tsx` and must report zero violations.

---

## ⚠️ The visual foundation is approximated, not approved

ADR-021 §5 rule 7 names two artefacts — `STYLE_README.md` and
`pacco-material-you.css` — as the approved Pacco style assets to be absorbed here.
**Neither exists in any repository in this workspace.** Tokens in
`tailwind.config.js` were sampled from the supplied comp instead.

See [`docs/DESIGN_APPROXIMATION.md`](docs/DESIGN_APPROXIMATION.md) for what was
sampled, where every brand asset came from, and what must be replaced when the
approved assets arrive.
