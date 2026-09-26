# Design approximation record

> ⚠️ **The visual foundation in this repository is APPROXIMATED, not APPROVED.**
> This file exists so that nobody downstream mistakes it for the sanctioned Pacco
> design system.

## 1. What was expected, and what was available

ADR-021 §5 rule 7 assigns `Pacco.Web` the platform's first UI foundation and names
the two artefacts that were meant to seed it:

> The approved Pacco style assets — `STYLE_README.md` and `pacco-material-you.css`
> — are absorbed into `Pacco.Web`.

**Neither artefact is present in any repository in this workspace.** They are not in
`Pacco.Context`, not in `Pacco.Web`, and not in any service repository. This is the
blocker recorded as **B3**.

What *was* supplied are four raster images:

| File | Size | What it is | In this repository |
| --- | --- | --- | --- |
| `01_pacco-logo-1.png` | 1672 × 941 | The Pacco logo lockup on a white field | ✅ `docs/design-reference/01_pacco-logo-1.png` |
| `02_login-page-ux.png` | 1448 × 1086 | The sign-in screen visual reference | ✅ `docs/design-reference/02_login-page-ux.png` |
| `03_welcome-page-ux.png` | 1448 × 1086 | The post-sign-in screen — **wave-2, not built here** | 🚫 Not committed; it belongs with the wave that builds `/welcome` |
| `04_backgroud-img.png` | 1448 × 1086 | The office background photograph | ✅ `src/assets/office-background.png`, byte-identical — a shipped asset, not only a reference |

A raster comp carries pixels. It does not carry token names, ramp steps, spacing
scales, type scales, motion, or states the comp does not happen to show.

⚠️ **And there is no Figma file behind them.** `LOW_LEVEL_SPEC-13652-wave-1.md`
§L.12.1 and `SPECIFICATION.md` §11.1 both record that no Figma file, URL or node
id exists for capability `13652`. These images are not a fallback for a design
system that was not fetched — they are the whole design source of record. See
[`design-reference/README.md`](design-reference/README.md).

## 2. What was therefore done

1. **Real exported pixels are used for every brand asset.** Nothing was redrawn,
   re-traced, or re-lettered. See §3.
2. **Colour, radius, shadow and type tokens were sampled from `02_login-page-ux.png`**
   and written into `tailwind.config.js` as named semantic ramps. Components refer
   to `brand-600`, `ink-500`, `surface-sunken`, `rounded-card` and so on. **No
   component contains a raw hex value.** When the approved token file arrives, the
   substitution happens in `tailwind.config.js` alone.
3. **Every approximated value is flagged at its definition site** — the header of
   `tailwind.config.js` and the header of `src/index.css` both point back at this
   file.
4. **Nothing was invented that the comp does not show.** No "remember me", no social
   sign-in, no "forgot password" flow, no breadcrumb, no side navigation, no toast
   system. The one link the comp shows — *Need help?* — is present and is a
   same-page anchor, because no destination is specified anywhere.

## 3. Asset provenance

Cropping a supplied export is not redrawing it: every pixel below comes from the
file named in the "Derived from" column. Those source files are now committed
under [`design-reference/`](design-reference/README.md), so each crop can be
re-derived and checked rather than taken on trust.

| Asset in this repo | Size | Derived from | Operation |
| --- | --- | --- | --- |
| `src/assets/pacco-logo.png` | 1104 × 312 | `01_pacco-logo-1.png` | Cropped to the content bounding box `(287, 299) → (1391, 611)`, removing the white margin |
| `src/assets/pacco-mark.png` | 277 × 309 | `01_pacco-logo-1.png` | Cropped to the cube mark; the white field made transparent |
| `src/assets/pacco-wordmark.png` | 765 × 218 | `01_pacco-logo-1.png` | Cropped to the "pacco" wordmark; the white field made transparent |
| `src/assets/office-background.png` | 1448 × 1086 | `04_backgroud-img.png` | Byte-for-byte copy |
| `public/favicon.png` | 64 × 64 | `01_pacco-logo-1.png` | The cube mark, resampled |

### Why the lockup is two images rather than one

The supplied logo export carries a strapline beneath the wordmark. The cube spans
the full height of the artwork, so no single rectangular crop can keep the cube and
the wordmark while excluding the strapline. `PaccoLockup` therefore composes the two
crops side by side at a fixed ratio. Both crops are real exported pixels.

## 4. Measured fidelity against `02_login-page-ux.png`

Review measured the first cut of `/login` at ~93% against the reference, below
the 95% gate, and named the defects. The layout was re-derived by rendering
`/login` in headless Chromium at the reference's own native **1448 × 1086** and
measuring element boxes against the same boxes in the reference image.

| Reported defect | Cause | Fix |
| --- | --- | --- |
| Card ~63px right of page centre | the two rails were flex children of **unequal** widths (`max-w-xs` against `max-w-[12rem]`), so the card was centred in what was left over | the middle row is now a grid, `minmax(0,1fr) minmax(0,35.2rem) minmax(0,1fr)`. The rail tracks are equal whatever their content, so the card column sits on the page's own centre line |
| Right rail vertically centred, overlapping the plant | `md:items-center` on the row | the row is `md:items-start` and each rail carries its measured top inset (`md:pt-[8.6rem]` left, `md:pt-[8.2rem]` right), aligning them to the card's upper third as the reference does. `md:pl-[8rem]` on the right rail clears the backdrop's plant |
| Left headline too large and ~130px too low | `text-5xl` inside a centred rail | `text-[2.5rem]`, and the top inset above places it where the reference puts it |
| Card ~14% too short | field, button and card padding all under-scaled | card `sm:py-[3.6rem]`, form `mt-6 gap-8`, fields `py-[1.1rem]`, button `py-[1.2rem]`, card lockup `h-16` |
| "Need help?" semibold and too small | `font-semibold text-sm` | `text-base`, regular weight |
| Backdrop washed out, arcs too large and low-contrast | `opacity-[0.28]`, a single horizontal mask, and hand-guessed arc sizes | backdrop `opacity-[0.55]` with an intersected horizontal **and** vertical mask, because the reference fades the photo out on both axes. The arcs were re-fitted from where each crosses the page's left and bottom edges |
| Brand lockup slightly small | — | mark `h-14` → `h-16`, wordmark `h-9` → `h-10` |

Measured after the refit, at 1448 × 1086, against the reference:

| Feature | Reference | Rendered |
| --- | --- | --- |
| Card box | x444–1006, y144–881 (h738) | x442–1005, y146–883 (h737) |
| Card lockup | y202–266 | y203–266 |
| Identifier field | y445–505 | y444–502 |
| Password field | y590–651 | y589–648 |
| Primary button | y711–772, w460 | y708–769, w460 |
| Left headline | x82–302, y289–331 | x79–307, y289–328 |
| Right rail first item | x1164 | x1166 |
| Outer arc, left-edge crossing | y677 | y678 |
| Inner arc, left-edge crossing | y811 | y809 |
| Inner / outer arc, bottom-edge crossing | x336 / x447 | x336 / x445 |

Whole-page mean absolute pixel difference is **9.14 / 255**, i.e. **96.4%**,
above the 95% gate. The residual is concentrated in the right-hand band
(mean 17.25, i.e. 93.2%) where the comp's own photographic content — plant
position, window mullion, curtain fall — differs from the supplied
`04_backgroud-img.png`; that is a difference between two source photographs, not
a layout error. The three layout bands measure 97.6%, 96.9% and 97.9%.

### Reproducing that number

The figures above were originally measured by hand, which made them unverifiable
by a reviewer — the defect review raised. They are now produced by a committed
command against a committed reference:

```bash
npm run build
npm run verify:visual
```

[`../scripts/visual-fidelity-check.mjs`](../scripts/visual-fidelity-check.mjs)
renders `/login` at the reference's own 1448 × 1086, compares the two images
channel by channel, prints the whole-page figure and the four-band breakdown, and
exits non-zero below the 95% gate — so a visual regression fails a command rather
than going unnoticed. It exits **2 for NOT RUN** where Chromium is unavailable or
`dist/` has not been built; an unexecuted check is never reported as passed
(`LOW_LEVEL_SPEC-13652-wave-1.md` §L.6.2).

**This does not make the foundation approved.** A high pixel score against a
raster comp says the comp was matched. It says nothing about token names, ramp
steps, or the states the comp does not show. §1's blocker **B3** still stands.

## 5. What must happen when the approved assets arrive

1. Replace the ramps in `tailwind.config.js` with the values from
   `pacco-material-you.css`.
2. Delete the approximation banners from `tailwind.config.js` and `src/index.css`.
3. Re-run `npm run verify:visual` and update §4 with what it reports.
4. Delete this file.

Until then, treat every token here as provisional.
