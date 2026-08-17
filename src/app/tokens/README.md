# Incentiv design tokens, vendored

Source: `incentiv-design-system/tokens/` in the repo root, the export dropped in
for the P14 token swap. These files are the **source of the visual language**;
`src/app/globals.css` aliases the app's semantic layer onto them and adds
nothing of its own except the values Incentiv does not ship (see below).

Updating the design system is a copy of this folder plus a read of the
deviations listed here. Do not hand-edit a value in these files — change it in
the design system and re-copy, or the alias layer starts lying about where the
number came from.

## What is vendored, and what is not

| Source file | Here | Why |
|---|---|---|
| `tokens/colors.css` | verbatim | 12 tokens, 12 dark overrides |
| `tokens/spacing.css` | verbatim | mostly unconsumed; see globals.css |
| `tokens/shape.css` | verbatim | `--r-button`/`--r-input` are consumed |
| `tokens/typography.css` | **minus the `@import url(...)`** | Inter arrives self-hosted through `next/font` in `layout.tsx`. Keeping the Google Fonts import would add a render-blocking network request and a second copy of the same typeface. `--font-display`/`--font-body` are re-pointed at the `next/font` family in globals.css — the substitution the design system's own README asks for. |
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
`--danger-soft`, `--accent-soft`, `--returned` and `--shadow-panel`, and
`lib/chartTheme.ts` keeps six chart series values. Incentiv ships no status
colours beyond `--positive` and no chart palette at all. Each is marked at its
declaration and carried in PROJECT.md under Open items.
