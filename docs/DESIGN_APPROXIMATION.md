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

| File | Size | What it is |
| --- | --- | --- |
| `01_pacco-logo-1.png` | 1672 × 941 | The Pacco logo lockup on a white field |
| `02_login-page-ux.png` | 1448 × 1086 | The sign-in screen visual reference |
| `03_welcome-page-ux.png` | 1448 × 1086 | The post-sign-in screen — **wave-2, not built here** |
| `04_backgroud-img.png` | 1448 × 1086 | The office background photograph |

A raster comp carries pixels. It does not carry token names, ramp steps, spacing
scales, type scales, motion, or states the comp does not happen to show.

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
file named in the "Derived from" column.

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

## 4. What must happen when the approved assets arrive

1. Replace the ramps in `tailwind.config.js` with the values from
   `pacco-material-you.css`.
2. Delete the approximation banners from `tailwind.config.js` and `src/index.css`.
3. Re-run the screenshot comparison in `README.md` §"Visual verification".
4. Delete this file.

Until then, treat every token here as provisional.
