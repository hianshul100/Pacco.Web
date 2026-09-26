# Design reference images

These are the **design source of record** for this repository, committed so that
the visual result can be verified from a checkout alone.

## Why they are here

Review of the first delivery raised that the visual result was unverified,
because the only references lived at the workspace root under `.attachments/` —
outside every repository. A reviewer with the pull request in front of them had
nothing to compare the rendered screen against, and the agreement figure in
[`../DESIGN_APPROXIMATION.md`](../DESIGN_APPROXIMATION.md) §4 could not be
reproduced. Committing the two images this wave consumed closes that: run
`npm run verify:visual` and the measurement repeats.

## ⚠️ There is no Figma file to fetch

`LOW_LEVEL_SPEC-13652-wave-1.md` §L.12.1 records it in as many words:

> 🚫 **No Figma file, Figma URL or node id exists for capability `13652`.** The
> design source is four static reference images supplied with the ticket.

`SPECIFICATION.md` §11.1 says the same, and `intents/13652.md` records
`Design References: None stated in the source ticket`. So a note that the UI was
"generated without a live Figma fetch" names something that does not exist for
this capability — there is no frame to open and no node to re-query. **These
images are the authority.** They are the layout and copy source; they are 🚫 not
a token source (§L.12.5, and [`../DESIGN_APPROXIMATION.md`](../DESIGN_APPROXIMATION.md)).

## Inventory

| File | Size | What it shows | Used by |
| --- | --- | --- | --- |
| `01_pacco-logo-1.png` | 1672 × 941 | The Pacco logo lockup — cube mark, wordmark, strapline | The provenance source of every brand asset in `src/assets/`; committed so each crop can be re-derived and checked |
| `02_login-page-ux.png` | 1448 × 1086 | The complete sign-in screen | The reference `npm run verify:visual` measures `/login` against |

Both are byte-for-byte copies of the supplied attachments. 🚫 Nothing was
redrawn, re-traced or re-lettered.

### The two images that are deliberately not duplicated here

| Supplied image | Where it is instead | Why |
| --- | --- | --- |
| `03_welcome-page-ux.png` | 🚫 Not in this repository | It is the Welcome screen, which `LOW_LEVEL_SPEC-13652-wave-2.md` §L.2.2 assigns to wave-2 together with `/welcome`, `RequireSession`, `TopBar`, `WelcomeCard` and `LogoutAction`. It belongs with the wave that builds that screen |
| `04_backgroud-img.png` | [`../../src/assets/office-background.png`](../../src/assets/office-background.png) | Already committed, byte-identical (`md5 d6b29d33c31c22b31cf8f4d73f8f9c91`), because it is a shipped asset and not only a reference. Copying it twice into the repository would double 1.4 MB for nothing |

## Verifying against them

```bash
npm run build
npm run verify:visual
```

`scripts/visual-fidelity-check.mjs` serves `dist/`, screenshots `/login` in
headless Chromium at the reference's own 1448 × 1086, and reports whole-page
agreement plus a four-band breakdown against a 95% gate. It exits **2 for NOT
RUN** — distinct from 1 for failed — when Chromium is unavailable or `dist/` has
not been built, because `LOW_LEVEL_SPEC-13652-wave-1.md` §L.6.2 requires an
unexecuted check to be reported as "not run" and never as passed.
