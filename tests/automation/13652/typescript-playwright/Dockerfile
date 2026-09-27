# ---------------------------------------------------------------------------
# Runner image for the JIRA 13652 Playwright suite.
#
# This image contains ONLY the test suite. It does not build, bundle or serve
# the Pacco.Web client, and it is not a base for any backend service image:
# per ADR-021 the client stays a standalone local process on its own origin and
# the platform is reached only through the API Gateway.
#
# 🚫 No secret is baked in. Every credential arrives at run time from an env
#    file or the CI secret store:
#
#   docker build -t pacco-13652-tests .
#   docker run --rm --env-file .env --network host \
#     -v "$PWD/reports:/suite/reports" pacco-13652-tests
# ---------------------------------------------------------------------------

# Pinned by digest-bearing tag so a rebuild cannot silently change the browser.
FROM mcr.microsoft.com/playwright:v1.49.1-noble

ENV NODE_ENV=test \
    CI=true \
    npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false

WORKDIR /suite

# Dependency layer first so source edits do not re-resolve the tree.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-package-lock; fi

COPY tsconfig.json playwright.config.ts eslint.config.js .prettierrc.json ./
COPY config ./config
COPY support ./support
COPY pages ./pages
COPY specs ./specs
COPY scripts ./scripts

# Drop root before anything executes; the base image ships this account.
RUN mkdir -p /suite/reports && chown -R pwuser:pwuser /suite
USER pwuser

ENTRYPOINT ["npx", "playwright", "test"]
CMD ["--project=static-analysis", "--project=api", "--project=ui", "--project=a11y"]
