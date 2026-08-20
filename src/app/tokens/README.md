# Incentiv design tokens

## 2026-08-19: the design system document is now the source

`colors.css`, `shape.css` and `typography.css` are re-sourced from the
**Incentiv design system document** (`DESIGN.md` §1 — "Visual Theme &
Atmosphere" plus its Key Characteristics list). That document supersedes both
the `incentiv-design-system/` export and the 2026-08-18 live-site measurement
described below, because it states the system as *rules* rather than as
whatever a given page happened to render on a given day:

| What the document states | Where it lands |
|---|---|
| Light: `#FDFCF9` page, `#F5F2ED` surface, `#FFFFFF` card | `--bg`, `--surface-2`, `--surface` |
| Dark: `#0A0A0A` page, `#0D0D0D` card, `#1A1A1A` surface | `--bg`, `--surface`, `--surface-2` |
| Warm borders `#E5E2DC`, "never cool gray" | `--line` |
| Brand blue `#3482ff` / `hsl(214 100% 60%)` | `--brand`, and `--accent` in dark |
| Terracotta `#D4715D`, gradient's second stop | `--brand-2` |
| Semantic green `#22C55E` for positive values | `--positive` (corrected, see below) |
| Radius uniformly 4px, "precision over friendliness" | `--r-card`/`--r-button`/`--r-input` |
| DM Serif Display, **always italic**, tracking -0.03em | `--font-display`, `--tracking-display`, `.display` |
| Inter with `"cv02" "cv03" "cv04" "cv11"` for all UI text | `--font-body`, `body { font-feature-settings }` |
| IBM Plex Mono **weight 300** for stats and financial figures | `--font-mono`, `.figure`/`.figure-display` |
| Animated page-edge scan lines as the infrastructural signature | `.page-edge-lines` in globals.css |

### The two departures from a literal document value

Both are a lightness move along the document's own hue. Neither is a
different colour, and both exist because the app's own contrast matrix
(`__tests__/ui-quality.test.ts`) asserts WCAG 1.4.3/1.4.11 on every
foreground/surface pair in both themes.

- **`--accent` in light is `#0063E6`, not `#3482ff`.** The document blue is
  3.63:1 on the white card and 3.54:1 on the cream page — under the 4.5:1
  floor for text at this app's sizes, and the accent here is a link, a
  section label and a button label, not only a fill. `#0063E6` is the same
  hue (214°) at 45% lightness: 5.35:1 / 5.21:1 / 4.79:1 across the three
  surfaces. **In dark the document blue is used unmodified** — it measures
  5.35:1 on `#0D0D0D` — so dark mode carries the literal brand colour and
  `globals.css` no longer overrides the accent in either theme.
- **`--positive` in light is `#0F7A4A`, not `#22C55E`.** The document green is
  2.09:1 on white, which would put a financial figure below the floor on the
  surface it is most often read against. Same hue, darkened to 5.38:1. Dark
  takes a lifted mint (`#34D399`, 10.11:1) for the mirror-image reason.

`--brand` and `--brand-2` carry the document's literal `#3482ff` and
`#D4715D` untouched, reserved for display-scale use only — the scan lines,
the gradient headline, decorative rules. Both clear the 3:1 large-text floor
at the ≥24px sizes they appear at; nothing smaller may take them.
`lib/chartTheme.ts` deepens the terracotta to `#b85c46` for the `returned`
series, which is a plotted mark at small size and needs 3:1 as a mark plus
real separation from the accent — the note in that file has the measurements.

## Earlier: the 2026-08-18 live-site measurement

Superseded for `colors.css`/`shape.css`/`typography.css` by the document
above, and kept here because it explains why the `incentiv-design-system/`
export is still not the source for those three files.

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

`--shadow-panel` moved out of this list on 2026-08-18: it reads
`--panel-shadow`, originally a measurement off the Funding Simulator's own
card. On 2026-08-19 that value was rebuilt rather than re-measured: the
document's uniform 4px radius retires the 16px-plus-soft-shadow card the
measurement came from, and a 16px drop shadow under a 4px corner reads as a
mistake. `--panel-shadow` is now a tight two-stop warm shadow that separates
the white card from the cream page and does nothing else. The *role* — a
panel elevation distinct from `--shadow-overlay` — is still this tool's own,
as it always was.

Two classes in `globals.css` are this tool's reading of a document rule
rather than a token the document ships: `.eyebrow` (11px uppercase Inter at
0.11em tracking, for the micro-labels that name every zone) and
`.figure-display` (Plex Mono at -0.05em, because the face's code-column
advance widths open "7.0%" into three glyphs at 48–80px). Both are recorded
at their declaration. The document names the *roles* — "section labels", "IBM
Plex Mono weight 300 for stats" — without specifying metrics, so the metrics
are ours.
