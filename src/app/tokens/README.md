# Incentiv design tokens

Two sources, not one, as of 2026-08-18:

- `incentiv-design-system/tokens/` in the repo root — the export dropped in
  for the original [024] token swap. Still the source for `spacing.css` and
  `motion.css`, which are unchanged.
- The **live** `incentiv.finance/tools/*` pages — the ESOP Tax Calculator,
  the Funding Round & Dilution Simulator, and the `/tools` listing —
  measured directly (computed styles, both themes) and now the source for
  `colors.css`, `shape.css` and `typography.css`'s `--font-display`.

The bundle drifted from what actually shipped: it still gives light `--accent`
as `#1F4FFF`, an 8px button/input radius, a 12px card radius, and `--font-
display: 'Inter', ...` with no serif anywhere. The live site's own headings
render `'DM Serif Display', Georgia, serif`; its buttons and inputs are a flat
4px on every tool page; its cards are a soft 16px with a drop shadow on the
Funding Simulator specifically (the ESOP Tax Calculator's own panel is flatter
— the two tools disagree with each other, and 16px-plus-shadow was the
deliberate pick here, not an average of the two). None of that shows up in the
Figma-style export at all.

**This means `colors.css`/`shape.css`/`typography.css` are hand-edited now**,
which the rule below used to forbid. That rule is right in general — do not
let the alias layer drift from its source — but there is no fresher export to
re-copy, only a live page to re-measure, so hand-editing against a documented
measurement *is* the update this time. `globals.css`'s own header comment and
"THE SEAM" section carry the exact values, the exact accessibility corrections
made to two of them (the light accent, moved from a measured 3.35:1-against-
white to a placed `#0063e6` at 5.35:1; nothing else needed correcting), and
why. The day a fresh design-system export exists that actually matches
production, re-copying it wholesale is again the right move — until then,
treat the live-site values recorded in `globals.css` as the source of truth
for these three files, not this folder.

Updating `spacing.css`/`motion.css` is still a copy of the design-system
folder plus a read of the deviations listed here. Do not hand-edit those two —
change them in the design system and re-copy, or the alias layer starts lying
about where the number came from.

## What is vendored, and what is not

| Source file | Here | Why |
|---|---|---|
| `tokens/colors.css` | **re-sourced from the live site, 2026-08-18** | Same 12 tokens, 12 dark overrides — but re-measured off `incentiv.finance/tools/*` rather than copied from the design-system export; two values (light `--accent`, `--accent-hover`) are further adjusted for contrast. See the retune note above and `globals.css`. |
| `tokens/spacing.css` | verbatim | mostly unconsumed; see globals.css |
| `tokens/shape.css` | **re-sourced from the live site, 2026-08-18** | `--r-button`/`--r-input` are consumed, now at the live site's 4px; `--r-card` is now 16px, the Funding Simulator's own card radius. |
| `tokens/typography.css` | **minus the `@import url(...)`; `--font-display` re-sourced from the live site, 2026-08-18** | Inter arrives self-hosted through `next/font` in `layout.tsx` — keeping the Google Fonts import would add a render-blocking request and a second copy of the same typeface, so `--font-body` is re-pointed at the `next/font` family in `globals.css`. `--font-display` is left as `'DM Serif Display', Georgia, serif`, the live site's own value, and is *not* re-pointed at Inter any more — see `globals.css`. |
| `tokens/motion.css` | **`:root` only** | The source file also ships three `@keyframes` with no consumer here and a global `*{}` reduced-motion block. `globals.css` already carries an equivalent reduced-motion block; a vendored file emitting a global rule is a side effect, not a token. |
| `tokens/base.css` | **not vendored** | A reset, not tokens. It sets `body` font-size to `--t-body-size` (17px, against this app's 16px), underlines every `<a>`, and re-declares `:focus-visible` — all of which would change this app's rendering rather than its tokens. |
| `components/shared.css` | **not vendored** | Styling for Incentiv's own components (`.ids-nav`, `.ids-card`, …), none of which exist here. |
| `styles.css` | **not vendored** | An `@import` manifest for the two files above. |

## Theme selector

The design system flips on `[data-theme="dark"]`. This app's `ThemeProvider`
sets that attribute alongside the `.dark` class it already used, so the
vendored dark block and the app's own `.dark` block flip together.

## Tokens with no Incentiv answer

`globals.css` keeps literal values for `--warn`, `--warn-soft`, `--danger`,
`--danger-soft`, `--accent-soft` and `--returned`, and `lib/chartTheme.ts`
keeps six chart series values. Incentiv ships no status colour beyond
`--positive` and no chart palette at all. Each is marked at its declaration
and carried in PROJECT.md under Open items.

`--shadow-panel` moved out of this list on 2026-08-18: it now reads
`--panel-shadow`, a real measurement off the Funding Simulator's own card, in
both themes. What is still this tool's own invention is the *role* — a
distinct panel/card elevation, separate from `--shadow-overlay` — not the
value; Incentiv's live tool pages disagree with each other on whether cards
get a shadow at all (the ESOP Tax Calculator's panel has none), so which one
to follow was a decision, recorded in `globals.css`, not a lookup.
