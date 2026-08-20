# Incentiv design tokens

## 2026-08-20: the COMPLETE design system document is the source

`colors.css`, `typography.css`, `spacing.css` and `shape.css` are sourced from
the full Incentiv design system document (§1–§9). The 2026-08-19 pass had only
§1, which names the surfaces and the brand blue but ships none of the extended
palette, none of the dark-mode luminance ladder, none of the typography
hierarchy, and none of the component stylings. Everything below §2 is new to
this pass.

### What each section became

| Document section | Where it lands |
|---|---|
| §2 Colour palette & roles | `tokens/colors.css` — surfaces, text, brand, extended accents, status, gradients |
| §3 Typography hierarchy | `tokens/typography.css` + the named classes in `globals.css` |
| §4 Component stylings | the `.btn-*` / `.card-*` / `.badge` / `.icon-box` / `.persona-chip` / `.bg-*` / `.page-edge-lines` classes in `globals.css` |
| §5 Layout principles | `tokens/spacing.css` (8px scale, 1312px container, 80/40px sections) + `tokens/shape.css` |
| §6 Depth & elevation | `--shadow-elevated`, `--panel-shadow`, `--surface-elevated`, the dark luminance ladder |
| §8 Responsive behaviour | the stepped `@media` blocks under the type classes |

### §3's hierarchy, as classes

Every row of the document's own table is one class, all in `@layer
components` so a Tailwind utility at the call site can still override a single
property:

`.heading-hero` (30/36/48/60px), `.heading-section` (20/24/30/36px),
`.heading-sub`, `.text-body-lg`, `.text-body`, `.text-nav`, `.section-label`,
`.number-display` (20/24/28px), `.number-large` (32/40/48px), `.text-gradient`.

The responsive steps are the document's own two scaling tables, declared as
discrete sizes at the named breakpoints rather than as a `clamp()` — a clamp
would land between the specified steps at most viewport widths.

`.figure` is the one class here with no row in §3: it is the mono face at body
scale, for a table cell or an inline figure, where `.number-display` at 20px+
would be too large. It is the direct consequence of §3's "Monospace for
financial truth" principle applied below 20px.

### Where a document value could not be taken literally

Three, all of them a lightness move along the document's own hue, and all
forced by the contrast matrix this app's own test suite asserts
(`__tests__/ui-quality.test.ts`, WCAG 1.4.3 for text and 1.4.11 for control
boundaries and plotted marks, in both themes).

- **`--accent` in light is `#0063E6`, not `#3482ff`.** §4 puts the brand blue
  behind white button labels and §3 puts it on `.section-label`, which is
  **10px** type. `#3482ff` measures 3.63:1 on the white card and 3.54:1 on the
  cream page. `#0063E6` is the same hue (214°) at 45% lightness — 5.35 / 5.21 /
  4.79 across the three light surfaces. **In dark the document blue is used
  unmodified** (5.16:1 on the dark card), so dark mode carries the literal.
- **`--positive` in light is `#0F7A4A`, not `#22C55E`** (2.09:1 on white). Same
  hue, darkened to 5.38:1. The literal is kept as `--success-brand` for a
  non-text indicator dot.
- **`--danger` in light is `#c22626`, not `hsl(0 84% 60%)`** (3.76:1 on white).
  The document's literal is kept as `--destructive`, non-text only.

`--brand` and `--brand-2` carry `#3482ff` and `#D4715D` untouched, for the
places §2 and §7 reserve them where the 3:1 large-text / non-text floor
applies instead: the page-edge scan lines, the gradient's stops, and
display-scale brand moments. `lib/chartTheme.ts` deepens the terracotta to
`#b85c46` for the `returned` series, which is a small plotted mark and needs
3:1 as a mark plus real separation from the accent.

### Where the document disagrees with itself

§1's Key Characteristics list gives the dark card as `#0D0D0D`; §2's Background
Surfaces table gives it as `hsl(0 0% 7%)` = `#121212`. §2 is taken, because it
is the systematic palette section and because its value is part of a
deliberate 4% / 7% / 10% / 14% / 18% luminance ladder that §6 then names as the
dark-mode elevation mechanism. Taking §1's value would break the ladder's
even stepping.

The same rule settles `#FDFCF9` vs `hsl(40 33% 98%)` (`#FCFAF8`) and `#3482ff`
vs `hsl(214 100% 60%)` (`#338BFF`): where a hex and an `hsl()` are both given
for one role, the **hex** is taken, because it is what §2 leads with and what
§9's Quick Color Reference repeats.

### One documented behaviour not adopted

§4 Navigation says "Light **sticky** header". This app's header is
deliberately not sticky, and that predates the document: a sticky header over
a scrolling form painted over the first field label, verified by measuring
both elements' `getBoundingClientRect()` after a 300px scroll. The reasoning
is in `layout/Header.tsx`'s own comment. Every other line of §4's navigation
spec — the logomark, `.text-nav` links, the brand-blue CTA, the hairline
bottom separator — is implemented.

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
