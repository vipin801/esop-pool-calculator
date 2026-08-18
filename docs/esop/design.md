# ESOP Pool Sizing Experience — design.md

**Confirmed 2026-08-18.** D10 (PROJECT.md) locks the approach in §1 below: a sequential
three-screen onboarding is not the mode switch D8 forbids, provided tiering never depends on
screen and every field becomes simultaneously visible in `Your model` once results are reached.
Everything in this file is now the working spec for implementation, not a proposal.

UX/IA source of truth: this file. Model source of truth: unchanged, [ENGINE_SPEC.md](./ENGINE_SPEC.md). Product decisions: unchanged, [PROJECT.md](./PROJECT.md) (see D10).

---

## 1. What this changes, and what it can't

A redesign brief asked for two input experiences: a short, sequential, 3-screen founder
journey, and afterwards a single continuous report with a sticky "Your model" panel that edits
in place. Neither exists today. What exists today is **one locked decision, D8, that exists
specifically to forbid a mode split**, and **D7**, which forbids showing a result before every
currently-required field is filled. Both are still correct about the *problem* they solve; the
brief's request changes the *shape* of the solution.

**The conflict, stated exactly:**

- **D8** (2026-08-17): *"There is one form, never a Simple/Advanced toggle or a renamed variant
  of one. Every field is always on screen or absent based on the founder's own choices... never
  behind a mode switch."* This was written to kill a Simple/Advanced toggle on **one page** of
  fields. A 3-screen sequential wizard is a different shape of problem — it does not hide fields
  behind a mode switch, it walks a founder through **disjoint groups of fields in sequence**,
  matching the master prompt's own three groups (company, hiring, grant economics) to the
  existing card groups almost one for one. D8's *substance* — no field is ever hidden by a mode
  a founder didn't choose, tiering is the only thing that hides a field — survives intact. Its
  *wording* — "never behind a mode switch" — has to be narrowed to mean "never a second reading
  of the same fields," not "never more than one screen."
- **D7** (2026-08-15, amended by D9): *"No result... renders until every field currently on
  screen has been entered."* This still holds screen by screen: a founder cannot advance from
  Company to Hiring, or Hiring to Grants, with a `drivesPool` field on that screen blank. The
  final "Calculate pool" action is exactly D7's existing gate, just evaluated once at the end of
  three screens instead of once at the bottom of one.
- **D9** (2026-08-17): *"The form requires only the inputs no honest default exists for."* This
  is the one piece of engineering this redesign leans on hardest — D9's tiering is what makes a
  3-screen journey possible at all. Fewer than 12 fields are ever `drivesPool` in the states the
  brief asks to design for (measured: 9–12 required fields across the states D9 already pinned
  in `visibility.test.ts`). D9 is not touched by this redesign; it is the reason the redesign is
  small.

**Resolution, locked as D10 in PROJECT.md (2026-08-18):** a new decision that narrows D8's
wording without reopening its substance. D7, D8, D9 are not superseded; D10 sits beside them as
the fourth locked decision this redesign is built on. Nothing in `src/lib/esop` changes to
support any of this — every field named below already exists on `EsopInputs` today (per the
input-UI audit), and every tier already resolves through `lib/visibility.ts`.

**What does not change:** the engine (`src/lib/esop`, frozen surface `calculateEsopPool`), the
tiering logic in `lib/visibility.ts`, the required-field semantics in `lib/completeness.ts`, the
seed-input assembly in `lib/seedInputs.ts`, the design tokens in `src/app/tokens/`, and every
PROJECT.md prohibition (never a pool % without grant basis + strike policy on screen, never
DPIIT-alone implies the deferral, etc. — see PROJECT.md § Prohibitions). This is a UI
re-architecture over an unchanged model, exactly as the brief itself asked for.

---

## 2. Product principles

Adopted from the brief, restated against what this repo already has:

- **Minimal founder input.** D9 already measured this: 9–12 required fields depending on grant
  basis and whether recycling/refresh/a round are on. The wizard's job is sequencing those
  fields into three short screens, not reducing them further.
- **Recommendation first.** The six questions the brief lists (what pool, what do I hold, how
  much more, how long does it last, how many hires does it cover, why) map directly onto fields
  already computed by `calculateEsopPool`: `recommended.openingPoolPctOfFullyDiluted`,
  `current.openingPoolOptions`, `TopUpRequirement`, `current.exhaustion`,
  `current.exhaustion.hiresSupported`, and the existing `HowCalculated` bullets. No new engine
  output is needed for the hero.
- **Progressive disclosure**, already built: the four-tier system (`drivesPool` / `minor` /
  `reportOnly` / `hidden`) is the mechanism. This redesign changes *where* tiers are read (three
  screens, then one panel) and never changes what a tier means.
- **Facts vs. estimates vs. calculations.** Already distinguished in code:
  `RequiredMarker`/blank-until-touched = founder fact; `EstimateMarker` = `minor`-tier seeded
  default (D6); engine output = calculated. The redesign's job is making this distinction visible
  in the results workspace too, not just in the input rail.
- **All model context stays visible after calculation.** This is the one genuinely new
  requirement — today, once results appear, the rail sits beside them (already true), but it is
  the same 7-card rail as before results, not reorganised around "what you entered" vs. "what
  we assumed." `Your model` (§6) is that reorganisation.
- **Results page becomes the modelling workspace.** Structurally true already —
  `EsopPoolSizeClient.tsx`'s `reachedResults` latch never sends a founder back to a blank form.
  What's missing is edit-in-place without opening the same 7 cards that built the input.

---

## 3. Architecture: two states, not two pages

No routing change. `EsopPoolSizeClient.tsx` keeps its existing `showResults`/`reachedResults`
latch pattern — State A becomes a 3-step wizard instead of one scrolling column; State B becomes
the results workspace with `Your model` instead of the sticky rail. The engine call, the input
shape, the completeness gate: unchanged.

```
STATE A — onboarding (replaces today's single scrolling rail)

  01 Company          02 Hiring plan       03 Grant economics
  ┌────────────┐      ┌────────────┐       ┌────────────┐
  │ stage      │  →   │ horizon    │   →   │ (branches on grant basis,
  │ pool       │      │ hires      │       │  see §4.3/§4.4)
  │ grant basis│      │ timing     │       │                    │
  └────────────┘      │ profile    │       └────────────┘
                       │ leadership │
                       └────────────┘
                                                    ↓
                                          [ Calculate pool ]
                                                    ↓
STATE B — results workspace (replaces today's rail + 6-tab result object)

  ┌──────────────────────────────────────────┬───────────────────┐
  │ ESOP Pool Recommendation      [Download] │                   │
  ├──────────────────────────────────────────┤   YOUR MODEL      │
  │ Hero (recommendation, why, runway)       │                   │
  │ Hiring coverage                          │   You entered      │
  │ Hiring economics                         │   ─────────────    │
  │ Benchmarks                               │   Estimated        │
  │ Year-by-year                             │   assumptions      │
  │ Cap table                                │   ─────────────    │
  │ Funding-round impact (optional)          │   [Recalculate]    │
  │ Employee economics                       │   sticky, lg:      │
  │ Compliance                               │   top-4            │
  └──────────────────────────────────────────┴───────────────────┘
```

- **State trigger**: unchanged mechanism — a latch, not a route. Today's `reachedResults` boolean
  is renamed in intent only (it now also controls whether the wizard or the workspace renders)
  and gains one more source: reaching the end of screen 03 and pressing "Calculate pool" sets it,
  exactly as today reaching `complete && outcome.ok` does. The two are the same event now: D7's
  gate *is* the "Calculate pool" button's enabled state.
- **Breakpoint**: reuse the existing `lg` (1024px) threshold that already separates the rail
  from stacking (`EsopPoolSizeClient.tsx`'s `lg:grid-cols-[360px_minmax(0,1fr)]`). `Your model`
  replaces the 360px rail at the same breakpoint, same sticky mechanism
  (`lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)] lg:overflow-y-auto`).
- **The 6-tab result object is retired.** `ResultTabs.tsx`'s WAI-ARIA tabs pattern (roving
  tabindex, lazy panel render) is a real, working, accessible component — it is not deleted for
  being broken, it's deleted because the brief's whole point is that switching between six
  isolated panels prevents a founder from reading "why this number" next to "here's the runway"
  in one continuous scroll. Its content becomes ordered `<section>`s in one scrolling report;
  its sticky compact anchor row survives as a `nav` that scrolls-to rather than switches-to (see
  §5).

**"Two states, not two pages" is scoped to the calculator's own flow, and does not forbid
companion pages (2026-08-18, split into two the same day).** `/tools/esop-pool-size/how-it-works`
and `/tools/esop-pool-size/faqs` are two genuine additional routes, not one combined page —
`page.tsx` + a client component each, both built on the new `layout/InfoPageShell.tsx`, which
holds the `Header`/`Footer`/`ThemeProvider` and breadcrumb/H1/subtitle/back-link chrome once
rather than duplicating it per page. Neither page shares state with `EsopPoolSizeClient.tsx` or
with each other; each links to the other from `InfoPageShell`'s own footer row. They exist
because "how it works" and the FAQs are read-once, share-a-link, keep-open-in-another-tab
content, none of which State A/B's single-page latch pattern serves. `layout/HelpLinksBand.tsx`
is a new section in `EsopPoolSizeClient.tsx`, mounted above `Footer` in both states, naming each
page as its own tile ("How it works" / "FAQs") — additional to, not a replacement for,
`Footer.tsx`'s own existing "How this works" link. Neither page nor the band touches
`showResults`/`reachedResults` or any engine call.

---

## 4. Input flow

### 4.1 Screen 01 — Company

Fields, in order, all already on `EsopInputs`:

| Field | Path | Tier today | Control (reuse) |
|---|---|---|---|
| Stage | `company.stage` | `drivesPool` | `SelectField` or a row of `SegmentedControl`-style stage chips (5 options fit one row past `sm`) |
| Current unallocated pool | `company.existingUnallocatedOptions` (+ existing `poolUnit` %/shares toggle) | `drivesPool` | `NumberField` with the existing unit toggle; "No pool yet" shortcut sets it to 0 and skips the field |
| Grant basis | `grantPolicy.grantBasis.kind` | `drivesPool` | Two-card choice (percent-of-equity / rupee-value), each card carrying the example string from the brief ("0.20% equity" / "₹20 lakh worth of ESOPs") and a "Recommended for your stage" hint on whichever `DEFAULT_GRANT_BASIS_BY_STAGE[stage]` picks |

**Not on this screen, deliberately:** post-money valuation. It is a real `drivesPool` field
today only under Basis B (`reportOnly` under Basis A per D9/`lib/visibility.ts`) — asking every
founder for it regardless of basis would ask a percent-of-equity founder a question their answer
never uses. It lives on screen 03B only (§4.4), where it is genuinely required.

**On this screen, in a compact "About your company" block that appears inline once grant basis
is chosen:** fully diluted shares and granted-and-outstanding options (+ opening cohort band/age
if above zero). Both are `drivesPool` regardless of grant basis (granted-and-outstanding
conditionally, on recycling/refresh — same rule as today), so unlike valuation they belong on
the one screen every founder sees. This keeps D7's gate (nothing on this screen is skipped) while
keeping the three named screens matching the brief's IA exactly.

### 4.2 Screen 02 — Hiring plan

| Brief's control | Engine field(s) it must produce | Control (reuse) |
|---|---|---|
| Planning horizon | `hiring.horizonYears` | `SegmentedControl` (2/3/4/5 years — see §4.3 for why the option set changes from today's 3/4/5/6) |
| Total ESOP-eligible hires | *(new UI-only field — see §4.3)* | `NumberField` |
| Hiring timing | *(new UI-only field, feeds the §4.3 translation)* | `SegmentedControl` (Earlier / Evenly spread / Later) |
| Team profile | `hiring.seniorityMix.*` via a preset (see §4.3) | 4 stacked choice rows (Mostly junior / Balanced / Senior-heavy / Custom) |
| Leadership hires | folded into `hiring.seniorityMix.leadership` (see §4.3) | `NumberField` |

"Custom mix" expands the existing `SeniorityMix` component inline — it already owns the
100%-rebalance behaviour (`lib/seniorityMix.ts`) and needs no change. "Enter hiring by year" is
a secondary link that reveals per-year `NumberField`s (`hiring.hiresPerYear.{i}`) seeded from the
§4.3 translation, so a founder who opens it is editing the real values, not a separate model.

### 4.3 The hiring-plan translation (deterministic, documented here per the brief's own
instruction not to bury a magic mapping in a component)

The engine has exactly two hiring-shaped inputs: `hiring.hiresPerYear` (one number per plan year)
and `hiring.seniorityMix` (one percentage split, for the whole horizon — not per year; per
LOG [025], a per-year mix needs an engine type change and is explicitly out of scope). The
simple screen collects four things and must produce both, with no hidden judgment calls:

**Hires per year, from total + horizon + timing.** For horizon `n` and total hires `H`, each
year `i` (1-indexed) gets a weight:

```
Evenly spread:  weight_i = 1                  for every i
Earlier:        weight_i = (n - i + 1)        (year 1 heaviest, year n lightest)
Later:          weight_i = i                  (year n heaviest, year 1 lightest)

hires_i = round(H * weight_i / sum(weight_1..weight_n))
```

Rounding uses the largest-remainder method (assign the floor of each `hires_i`, then hand the
leftover few hires, one each, to the years with the largest fractional remainder) so
`sum(hires_i) == H` exactly, never off by a rounding unit. This is a pure function
(`lib/translateHiringPlan.ts`, new) taking `{ totalHires, horizonYears, timing }` and returning
`number[]`, unit-tested against hand-computed tables the way `lib/seniorityMix.ts` already is.

**Seniority mix, from team profile + leadership hires.** Three fixed presets (percentages sum to
100, `leadership`/`senior`/`mid`/`junior`):

```
Mostly junior:   2 / 13 / 35 / 50
Balanced:        5 / 20 / 45 / 30   (identical to today's DEFAULTS.seniorityMixPct — unchanged)
Senior-heavy:   10 / 30 / 40 / 20
```

The leadership-hires field then overrides the preset's leadership share, and the other three
bands are rescaled proportionally to still sum to 100:

```
leadershipPct = round(100 * leadershipHires / totalHires, 1)     // clamped to [0, 100]
remainingPct  = 100 - leadershipPct
scale         = remainingPct / (preset.senior + preset.mid + preset.junior)
seniorPct     = preset.senior * scale
midPct        = preset.mid   * scale
juniorPct     = preset.junior * scale
```

If `leadershipHires` is 0, `leadershipPct` is 0 and the other three bands are scaled up to fill
100% in the preset's own ratio — never a silent "leadership stays at the preset's 5% anyway."
This is also a pure function (`lib/translateHiringPlan.ts`), independent of the hires-per-year
translation, and it feeds the *existing* `hiring.seniorityMix` field — `SeniorityMix.tsx` and
`lib/seniorityMix.ts`'s rebalance-to-100 behaviour need no change, because the translation always
produces a mix that already sums to 100.

**Horizon option set.** Today's UI offers 3/4/5/6 years; the brief's mock offers 2/3/4/5. Neither
is an engine constraint — `hiring.horizonYears` accepts any positive integer, and
`hires_i`/`DEFAULTS.hiresPerYear` already handle horizons shorter or longer than the 5-entry
default by trimming or repeating the last value (per `buildSeedInputs`). Adopt the brief's 2–5
range for the new wizard, since a 2-year horizon is a real pre-seed answer the old 3–6 range
couldn't express.

### 4.4 Screen 03A / 03B — Grant economics (branches on grant basis chosen in screen 01)

**03A, Basis A (percent of equity):**

| Field | Path | Tier today | Control |
|---|---|---|---|
| Grant philosophy | *(new UI-only selector)* | drives `grantPolicy.grantBasis.grantPctByBand.*` | 3-way `SegmentedControl` (Conservative / Market / Generous) |
| Per-band percentages | `grantPolicy.grantBasis.grantPctByBand.*` | `minor` | read-only preview rows, `[Customize grants]` reveals the existing 4 `NumberField`s |

Three grant-philosophy presets, each a full `{leadership, senior, mid, junior}` set drawn from
the spec's own advisory ranges (ENGINE_SPEC.md §1: CXO/VP 0.3–1.5%, senior 0.15–0.3%, mid
0.05–0.15%, junior 0.02–0.1%) rather than invented: Conservative = each band's low end,
Market = `DEFAULTS.grantPctByBand` (already the M1 midpoint), Generous = each band's high end.
No valuation or valuation-growth field appears on this screen — `grantPolicy.growth.*` stays
`hidden` under Basis A today and continues to.

**03B, Basis B (rupee value):**

| Field | Path | Tier today | Control |
|---|---|---|---|
| Current post-money valuation | `company.postMoneyValuation` | `drivesPool` (Basis B only) | `NumberField`, ₹ crore |
| Expected valuation growth | `growth.valuationGrowthPctPerYear` | `drivesPool` (Basis B only) | `SliderField` with the existing 3 presets, plus the trajectory readout below |
| Grant philosophy | *(new UI-only selector)* | drives `grantPolicy.grantBasis.grantValueByBand.*` | 3-way `SegmentedControl` |
| Per-band ₹ values | `grantPolicy.grantBasis.grantValueByBand.*` | `minor` | read-only preview, `[Customize grants]` reveals the existing 4 `NumberField`s |

The trajectory readout ("Today ₹X Cr → Year 1 ₹Y Cr → …") is a pure display transform of
`company.postMoneyValuation * (1 + growth)^year` for `year` in `0..horizonYears` — no new engine
call, computed the same way `GrantCostChart.tsx` already derives its valuation series. Per §14
of the brief, since this repo has no internal ₹-grant market-rate source (`grantValueByBand`'s
provisional defaults are the only figures in the codebase, tagged `provisional` per M2, meaning
"a placeholder, not verified"), the three philosophy presets for Basis B use those provisional
defaults scaled (×0.7 / ×1 / ×1.4 for Conservative/Market/Generous) rather than inventing new
unsourced rupee figures, and the labels say "Estimated, not sourced" rather than implying a
market survey backs them. This is a limitation to flag to a founder in copy, not to paper over.

Strike policy, value basis, theta: stay off both screens 03A/03B. They default from
`DEFAULT_STRIKE_POLICY_BY_STAGE[stage]` (already stage-aware) and surface in `Your model` →
Grant assumptions, exactly as `minor`/conditionally-`drivesPool` fields do today. The one case
where strike policy is genuinely `drivesPool` (Basis B + realisable value basis) means a founder
who picks "Realisable" as their value basis in `Your model` after the wizard may reopen a
requirement — handled by the same `incompleteCount` mechanism `ResultsPanel.tsx` already has.

---

## 5. Results workspace — report section order

Replacing `ResultTabs.tsx`'s six panels with one scrolling `<article>` of `<section>`s, each
with a stable `id` for the compact anchor nav to scroll to (`scrollIntoView({behavior: 'smooth'
})`, downgraded by the browser under `prefers-reduced-motion` exactly as `MobileSummaryBar`
already relies on today):

1. **Hero** — recommendation, current pool, top-up, runway, hires supported (§5.1)
2. **Why this number** — founder inputs vs. model assumptions, split explicitly (§5.2)
3. **Current pool & runway** — reuses `PoolRunwayChart`, adds the exhaustion timeline treatment (§5.3)
4. **Hiring coverage** — reuses `HiresSupportedChart`
5. **Hiring economics** — reuses `GrantCostChart`, gains the plain-English takeaway line
6. **Benchmarks** — reuses `BenchmarkStrip` largely as-is (already separates the two tracks)
7. **Year-by-year** — reuses `YearTable`, fixes the unclamped-negative-% cell (§7)
8. **Cap table** — reuses `CapTablePanel`'s three tables, adds the ownership-impact summary (§5.4)
9. **Funding-round impact** — optional, reuses the round section of `reportModel.ts`'s logic live on screen instead of PDF-only
10. **Employee economics** — reuses `MedianEmployeeValue`, adds the "not economically rational" state (§7)
11. **Compliance** — reuses `ComplianceChecks`, regrouped by status (§5.5)

Order matches the brief exactly and matches `reportModel.ts`'s existing PDF order almost one for
one — the PDF was already built in this sequence; the screen has been the one place still using
tab order (Overview/Runway/Hiring cost/Year-by-year/Cap table/Compliance) instead.

### 5.1 Hero states (four, not one)

Today's `Headline.tsx` has one layout for every case and leans on a small "Last stable value"
badge for non-convergence — the audit's §10 finding. Four explicit states, same underlying data:

- **Normal** — today's layout, unchanged content.
- **Adequate current pool** (`current.exhaustion.exhausted === false` for the full horizon, or
  a converged `TopUpRequirement` of zero) — headline reframes from "Top-up needed" to "Your
  current pool already covers this plan," top-up stat becomes a confirmation line rather than a
  ₹0 stat that looks like every other case.
- **Top-up needed** — today's default case.
- **Extreme / impractical** — triggered by `!result.solver.converged` (the actual engine signal
  for "no practical answer in range," per the solver audit — the spec's 99.9% cap is the reason
  non-convergence is the correct trigger, not a separate ">100%" check the engine doesn't
  surface). Full-width replacement of the stat grid with the brief's §19 treatment: "Model
  requirement > {last stable value}%", a bulleted list of the largest drivers (read off which
  `drivesPool`/`minor` fields are furthest from their default — see below), and a
  `[Review assumptions]` action that opens `Your model` scrolled to the first flagged field. The
  raw last-stable-iterate figure stays visible below, labelled "mathematical output" against the
  hero's "practical recommendation" framing, per the brief's own required distinction. "Largest
  drivers" is a simple ranked list, not a new statistical model: rank the `drivesPool`/`minor`
  numeric fields by how many multiples their current value sits from `DEFAULTS`, descending.
- A **soft-warning** variant (converged, but the recommended pool sits above 1.5× the top of the
  advisory benchmark band for the founder's stage) gets a smaller inline callout under the hero,
  not the full block — distinct severity for a distinct condition, per the brief's own
  instruction not to conflate "unusual" with "no answer."

### 5.2 Why this number

**Narrowed 2026-08-18, after the section below first shipped.** The two-list split is
unchanged in shape — founder inputs on the left, model assumptions on the right — but the
right-hand list is no longer a second, free-standing disclosure. As first built it named every
`minor`-tier field the founder hadn't touched — buffer, attrition, the leaver assumptions,
vesting, strike, theta, refresh — with a `View all assumptions` link straight into `Your model`.
None of that was ever gated, so a founder could read every one of those values off this card for
free, which is a narrower reading of D3 ("results are never gated, only the report download is")
than the report gate itself gets: the report requires a name and a work email, this card
required nothing. `WhyThisNumber.tsx` carries the full rationale at its own definition; this
section is corrected to match what shipped rather than left describing the earlier plan.

- **You told us**: stage, current pool, grant basis, planning horizon, total hires, leadership
  hires, and — under Basis B — valuation and valuation growth. Every one of these is read
  straight off `EsopInputs`, not gated on `touched` — with one exception. Leadership hires comes
  from `hiring.seniorityMix.leadership`, a `minor` field that carries a non-zero seeded default
  (`DEFAULTS.seniorityMixPct`), so a bare "is it non-zero" check would credit a founder with a
  figure they never entered whenever they left the mix at its default. That one line is gated on
  `touched` as well — `touched.has(META_LEADERSHIP_HIRES) || touched.has('hiring.seniorityMix.leadership')`
  — covering both the onboarding wizard's "How many leadership hires?" question and a direct edit
  of the band in `Your model`. Every other line here reads a `drivesPool` field (D9), required
  before a result exists at all, so it needs no touched check to be genuinely founder-supplied.
- **Model assumptions**: a fixed set of opaque, `aria-hidden` bars — no field name, no value, not
  even a count that would let a reader infer how many assumptions exist. `View all assumptions`
  is gone; nothing here opens `Your model` early, since doing so is exactly the leak this section
  exists to close. The only way past the lock is `Download full report`, the same lead-gated
  action (D3) every other report surface already sits behind.

This is still a read over `EsopInputs` (plus, now, `touched`) — no new engine state, no change
to `lib/visibility.ts`'s tiers. Only the right-hand list, and the one line named above on the
left, changed behaviour from the plan first written here.

### 5.3 Runway timeline

Replaces the audit's flagged gap (raw negative percentages, an "0 months" floor with no
explanation) with the brief's plain-English treatment: "Expected to run out around Month N" for
an exhausted current pool, "Lasts the full plan" when it doesn't exhaust, never a bare month
number with no framing. A simple horizontal timeline (today ── Month N ── horizon end) sits
under the existing `PoolRunwayChart`, not replacing it — the chart is the detailed view, the
timeline is the one-glance answer the brief's §30 asks for.

### 5.4 Ownership impact

New small table above the existing three `CapTablePanel` tables (which stay, as the "detailed
tables beneath" the brief explicitly asks to retain): Founders/Investors/Pool rows, Today /
After pool / Change columns, computed from `capTables.before` and `capTables.after` — both
already returned by the engine, so this is a display transform, not a new calculation.

**Locked in part, D13 (2026-08-18).** `CapTablePanel`'s "After the recommended pool is
reserved" table is now a locked placeholder, because its Founders/Investors split reads
`company.founderOwnershipPctOfFullyDiluted`, an invented `reportOnly` seed (D9) until a founder
fills in section 07, and showing it next to a modelled pool recommendation reads as computed
fact when it is not. The title and the real column headers (`Holder`/`Shares`/`% of fully
diluted`) still render — they name no company or figure — and the body is one `aria-hidden` bar
standing in for the rows, not five, so nothing about row count or content leaks either; the
outer card clips its own rounded corners (`overflow-hidden`) so the blur can't bleed past them.
This table's own Founders/Investors "After pool" and "Change" cells in `OwnershipImpact` are
locked the same way and for the same reason; its "Today" column and the Pool row throughout stay
open — see D13 for why each side of that line falls where it does. `capTables.before` ("Today")
and `afterModelledRound` are unaffected by this pass.

### 5.5 Compliance regrouped

`ComplianceChecks.tsx`'s flat list becomes three named groups by `status`
(`blocked`→"Action required", `warn`→"Check or confirm", `pass`→"Looks okay"), with a one-line
summary row above ("3 passed, 2 need attention, 1 missing detail" — a `reduce` over
`result.complianceChecks`, no engine change) and each row's statutory reference demoted to a
smaller/fainter line under an expandable detail, rather than sitting at the same weight as the
finding. The per-row disclaimer stays on every row — that's a structural PROJECT.md prohibition,
not a styling choice, and it survives this regrouping unchanged.

**Collapsed by default (2026-08-18).** The whole panel is now a native `<details>`, matching
`HowCalculated.tsx`'s existing pattern: the heading and the pass/attention summary line sit in
`<summary>`, always visible and readable at a glance from the anchor nav, and the three grouped
lists only render once a founder opens it. This is progressive disclosure, not a D12/D13-style
gate — no lead form, no download, one click either way.

---

## 6. `Your model` — the shared editor

One component tree, two shells: a sticky `lg:` column (reusing the exact sticky/scroll mechanism
`EsopPoolSizeClient.tsx`'s rail already has) and a full-screen sheet below `lg:`, opened by a
"View / edit model" action from the mobile summary bar. Same state, same fields, same draft
mechanism, in both.

### 6.1 Groups (accordion sections, reusing `CollapsibleSection`)

| Group | Fields (existing paths, unchanged) |
|---|---|
| Company | `company.stage`, `company.existingUnallocatedOptions`, `grantPolicy.grantBasis.kind`, `company.fullyDilutedShares`, `company.grantedOutstandingOptions` (+ opening cohort), `company.postMoneyValuation` |
| Hiring | `hiring.horizonYears`, `hiring.hiresPerYear.*`, `hiring.seniorityMix.*`, plus the 4 UI-only translation inputs from §4.2/4.3 kept alongside so re-editing "total hires" re-runs the same translation rather than desyncing from the per-year array |
| Grant economics | `growth.valuationGrowthPctPerYear` (Basis B), grant-philosophy selector + per-band values |
| Grant assumptions | `grantPolicy.bufferPct`, `grantPolicy.compInflationPctPerYear`, `grantPolicy.valueBasis`, `grantPolicy.strikePolicy.*`, `grantPolicy.fairValue.theta` |
| Workforce behaviour | `attrition.sector`, `attrition.baseAnnualPct`, `attrition.byBand.leadership`, `exercise.vestedNeverExercisedPct`, `exercise.recycleForfeited` |
| Refresh & recycling | `grantPolicy.refresh.enabled/ratePct/sizePct` |
| Vesting & exercise | `vesting.cliffMonths`, `vesting.vestYears`, `vesting.frequency`, `exercise.exerciseWindowDays`, `exercise.continuingEmployeeExercisePctPerYear` |
| Company / cap table | `company.faceValuePerShare`, `company.authorisedCapitalShares`, `company.founderOwnershipPctOfFullyDiluted` |
| Funding round | `rounds.0.*` |
| Compliance | `compliance.*`, `employeeValue.marginalTaxRatePct` |

This is exactly today's 7 cards' fields, regrouped into the brief's 10 named groups — no field
is added, dropped, or given a different tier. `EstimateMarker`/`RequiredMarker` render exactly as
they do today; a `minor` field still always shows its live value, a `reportOnly` field still
starts blank. Collapsed groups show their summary values inline (e.g. "Buffer 15%, Comp
inflation 8%" on the closed "Grant assumptions" row) so scanning the collapsed panel still
answers "what assumptions produced this" without opening anything, per the brief's §23.

### 6.2 Draft state and Recalculate

This is the one real behavioural change from today's live-recompute-on-every-blur model.
`EsopPoolSizeClient.tsx` currently treats `inputs` as both the live draft and the source the
engine reads on every render. `Your model` introduces a second buffer:

- `inputs` (unchanged): the last **applied** state — what the results workspace is showing.
- `draftInputs`: a working copy, created by cloning `inputs` the moment a founder edits anything
  inside `Your model`. Same `setGroup`-style setters, same `NumberField`/`SelectField` etc.,
  now writing into `draftInputs` instead of `inputs`.
- A sticky action row appears the moment `draftInputs !== inputs` (shallow per-group compare, or
  simpler: a dirty boolean flipped on first edit and cleared on Discard/Recalculate):
  `"{n} changes not applied"` with `[Discard]` (drops `draftInputs`, reverts to `inputs`) and
  `[Recalculate]` (promotes `draftInputs` to `inputs`, which is what actually re-triggers
  `calculateEsopPool` — the existing `useMemo` keyed on `inputs` needs no change, since it
  already only recomputes when the object it's keyed on changes identity).
- **The onboarding wizard is unaffected** — it still writes directly to `inputs` with no draft
  step, since D7's screen-by-screen gate is exactly the sort of immediate feedback a draft step
  would hurt. The draft/Recalculate pattern is `Your model`-only, i.e. post-results only.
- Change feedback ("10.5% → 12.0%, +1.5 pp") is a simple before/after diff computed once,
  immediately after a successful Recalculate, held in a small piece of state cleared on the next
  edit — not an animated transition, per the brief's "don't animate excessively" instruction.

### 6.3 Mobile

`lg:hidden` summary bar (reusing `MobileSummaryBar.tsx`'s existing pattern almost unchanged:
pool %, current pool, top-up) gains one more action, "View / edit model", which is the one
new piece of chrome this redesign needs: a full-screen sheet. No drawer/sheet primitive exists
in this codebase or in `incentiv-design-system/components/` today (confirmed in the design-system
audit) — this is the one net-new primitive the redesign requires, built from the tokens already
in `src/app/tokens/` (`--r-card`, `--shadow-overlay` — the one Incentiv shadow token, reserved
for overlays exactly as its own guidelines say, and currently unused anywhere in this tool) with
standard focus-trap/`Escape`-to-close/return-focus behaviour, matching `LeadModal.tsx`'s existing
bespoke-modal pattern for the a11y mechanics rather than inventing a second convention.

---

## 7. Extreme and edge states — explicit list

Beyond §5.1's four hero states:

| State | Where handled | Treatment |
|---|---|---|
| `existingPoolIsEnough` | Hero | New "adequate pool" state (§5.1) — today this silently renders as a 0-value top-up with no distinct message |
| Non-convergence | Hero | New "extreme" state (§5.1) — today a small badge only |
| Negative running balance in the year-by-year table | Year-by-year section | `YearTable`'s "% of fully diluted" column changes from the raw unclamped `formatPct` to a founder-facing "Exhausted" label once `closingAvailable < 0`, with the signed raw share figure (already correctly signed via `formatSignedShares`) kept as the number of record; the underlying value is never clamped, only the *display* of the percentage column changes |
| `PoolPctChart`'s current-pool line going deeply negative | Runway/coverage charts | Same treatment: the line is clipped at a floor with a small "pool exhausted" annotation at the clip point (chart data itself unchanged, only the rendered range + one annotation), rather than the axis silently stretching to accommodate e.g. −156% |
| Negative/irrational realisable employee value | Employee economics section | New copy branch: "Exercising would not be economically rational under current assumptions," with the raw figures behind a details toggle — mirrors the report's own non-convergence prose branch (already exists in `reportModel.ts`, today absent from the live screen) |
| Zero hires planned | Screen 02 / hiring coverage | Total-hires field has a floor validation message ("Enter your planned hires, even if it's zero") rather than silently producing an all-zero `hiresPerYear` array with no explanation downstream |
| No current valuation under Basis B | Screen 03B | Local field-level validation ("Enter your current valuation to model ₹-value grants"), blocking only that screen's advance — reuses D7's existing per-field gate mechanism |
| Missing/incomplete compliance data | Compliance section | Already partly handled — `reportOnly` fields render blank; the regrouped view (§5.5) adds a "1 detail missing" count to the summary line so it's visible without opening the section |

Nothing here changes what the engine computes or clamps. Every treatment above is a display
decision layered on values the engine already returns signed, unclamped, and warned
(`converged`, `EngineWarningId`), per M20/M23's own reporting contract.

---

## 8. Chart and table rules (applied to §5's retained charts)

- Every retained chart keeps its question-as-title (`PoolRunwayChart` → "Will your current pool
  run out, and when?", etc. — already the pattern in `ChartFrame.tsx`).
  `PoolPctChart` gains the exhaustion-floor annotation from §7's table above; no chart is removed.
- `GrantCostChart`'s dual-axis (Basis B only) keeps its existing explicit axis labelling; its
  existing percent-of-equity fallback caption is kept verbatim.
- Tables: `YearTable`, `CapTablePanel`'s three tables, and the new ownership-impact summary all
  reuse the existing Indian-format helpers (`formatIndian`, `formatSignedShares`,
  `displayPoolPct`) — no new formatting convention introduced.

---

## 9. Copy

Reuse `lib/labels.ts`/`lib/describe.ts` where wording already exists (e.g.
`currentPoolRunwayLabel`). New copy needed for: the three grant-philosophy presets' names and one-
line descriptions, the hero's four state variants, the hiring-timing/team-profile option labels,
and `Your model`'s group summaries. All new copy stays under the existing 25-word budget already
enforced by `__tests__/ui-quality.test.ts`'s scanner — extend that scanner's scope to the new
components rather than exempting them.

---

## 10. Component map

| Component | Action | Reason |
|---|---|---|
| `EsopPoolSizeClient.tsx` | Modify | Add wizard-step state pre-results; add `draftInputs`/dirty-flag state post-results; `showResults`/`reachedResults` latch logic reused, not rewritten |
| `InputRail.tsx`, `InputCard.tsx` | Replace | Superseded by the 3-screen wizard (pre-results) and `Your model`'s grouped accordion (post-results); the underlying cards' *field* JSX (labels, controls, conditionals) is reused, just re-parented |
| `GrantBasisCard.tsx`, `CompanyTodayCard.tsx`, `HiringCard.tsx`, `SeniorityMix.tsx`, `GrantPolicyCard.tsx`, `LeaversAndRecyclingCard.tsx`, `FundingRoundCard.tsx`, `ReportOnlyCard.tsx` | Modify (split/regroup) | Field-level JSX and conditionals reused; each card's contents redistributed across the 3 wizard screens and the 10 `Your model` groups per §4/§6's tables — no field logic rewritten |
| `ui/*` (Button, Field, NumberField, SelectField, RadioGroup, SegmentedControl, SliderField, ToggleSwitch, CollapsibleSection, EstimateMarker, RequiredMarker, Abbr) | Reuse, unmodified | Every control named in §4/§6 is one of these; no new form primitive is needed |
| `ResultTabs.tsx` | Remove | Superseded by the single scrolling report + anchor nav (§5); its a11y pattern (roving tabindex) has no replacement need since there's no longer a tablist, only same-page anchor links |
| `ResultsPanel.tsx` | Replace | Becomes the report `<article>` assembling §5's 11 sections plus `Your model`, instead of assembling a tab strip |
| `Headline.tsx` | Modify | Gains the 4-state branch (§5.1); existing stat-grid JSX reused inside "Normal"/"Top-up needed" |
| `BenchmarkStrip.tsx`, `YearTable.tsx`, `CapTablePanel.tsx`, `ComplianceChecks.tsx`, `MedianEmployeeValue.tsx`, `HowCalculated.tsx`, all four chart components, `ScenarioStrip.tsx` | Modify (light) | Become `<section>`s instead of tab panels; `YearTable`/`PoolPctChart` gain the exhaustion-floor treatment (§7); `ComplianceChecks` gains the 3-group summary (§5.5) and is now collapsible; `CapTablePanel` gains the ownership-impact table above it (§5.4) and its "after" table is locked (D13); `ScenarioStrip`'s Slow/Fast detail blocks are locked the same way, Base is not (D14); all four charts render blurred and non-interactive on screen via `ChartFrame`'s new `locked` prop (heading and a "Download the report" message stay unblurred), but never in `ReportCharts.tsx`'s off-screen PDF render (D15, 2026-08-18) |
| `IncompleteResultPlaceholder.tsx` | Remove | No longer reachable — the wizard's own per-screen gate replaces the "keep scrolling past a blank rail" state entirely |
| `MobileSummaryBar.tsx` | Modify | Gains the "View / edit model" action opening the new mobile sheet |
| *(new)* `ModelPanel.tsx` (+ `ModelPanelGroup.tsx`) | New | The shared `Your model` editor, §6 — one component tree, rendered as a sticky column `lg:` and inside a new sheet below it |
| *(new)* `ui/Sheet.tsx` | New | The one net-new primitive (§6.3) — full-screen mobile sheet, focus-trapped, built from existing tokens, no equivalent in this codebase or the reference design system |
| *(new)* `lib/translateHiringPlan.ts` | New | §4.3's two pure functions (hires-per-year distribution, seniority-mix-from-profile-and-leadership), unit-tested the way `lib/seniorityMix.ts` already is |
| *(new)* `layout/OnboardingWizard.tsx` (+ per-screen components) | New | Screens 01/02/03A/03B; composes existing card-level field JSX pulled out of the cards being replaced |
| `lib/reportModel.ts`, `lib/reportPdf.ts` | Modify (light) | Section order already matches §5 almost exactly — only the ownership-impact table and the 4-state hero framing need adding so the PDF and the live screen stop diverging (the audit's §10 finding: today the PDF has prose the screen lacks for non-convergence) |
| `src/lib/esop/*` (the engine) | **No change** | Every field named anywhere in this document already exists on `EsopInputs`/`EsopResult` |

---

## 11. Responsive

No new breakpoint tokens — reuse Tailwind's default `lg` (1024px), already the one structural
breakpoint this route uses. Wizard screens are single-column at every width (`max-w-[680px]`,
matching today's State A). Results workspace: `lg:` two-column with sticky `Your model`; below
`lg:`, single column, `Your model` becomes the mobile sheet (§6.3) opened from the summary bar.

## 12. Accessibility

Carried forward unchanged: `ui-quality.test.ts`'s contrast matrix, the 3:1/4.5:1 floors, named
form controls, no positive tabindex. New surfaces need the same pass before shipping: the sheet
(§6.3) needs focus-trap + return-focus + `Escape`, the anchor nav (§5) needs `aria-current` on
the in-view section's link, and the wizard's step transitions need an announced step change
(`aria-live="polite"` on the step heading) since there is no longer a single static `<h1>` the
way today's one-page form has.

---

## 13. Implementation status (2026-08-18)

Phases 4–7 are built, tested and verified live in the browser. Recording exactly what shipped
against what §10 planned, and what real bugs manual testing (not the automated suite alone)
caught — the same discipline this project's own LOG holds every session to.

**Deviations from the plan above, each a deliberate simplification, not a scope cut:**

- `Your model` ships as **8 groups**, not the 10 named in §6.1, and as **one file**
  (`ModelPanel.tsx`), not split into a separate `ModelPanelGroup.tsx`. Reusing
  `GrantPolicyCard`/`CompanyTodayCard` wholesale (via two small `hide*` props, `hideGrantPerHire`/
  `hideStrikeAndTheta`/`hideValuationAndGrowth`) rather than surgically decomposing them into
  10 groups avoided duplicating a field behind two different controls, at the cost of a coarser
  taxonomy than §6.1 sketched. `ScreenHiring`/`ScreenGrants` are reused directly inside `Your
  model` too (wrapped in a plain `InputCard`), not rebuilt.
- The wizard's `htmlFor`/`group` split on `Field` surfaced two real accessibility bugs
  (`ScreenCompany`'s stage field and `ScreenHiring`'s horizon field both wrapped a
  `SegmentedControl`, a multi-button group, with `htmlFor` instead of `group` — caught by
  widening `ui-quality.test.ts`'s `INPUT_CARDS` scan to `/layout/onboarding/`, not written down
  in advance). Fixed; see `git log` for the exact commits once this lands.
- `reportModel.ts`/`reportPdf.ts` (§10's "light" PDF update) is **not yet touched** — the PDF
  still reflects the pre-redesign screen. The live screen and the PDF now diverge more than they
  did before this session (the PDF has no `Your model`, no anchor nav, no 4-state hero), which is
  a real gap to close before this ships, not an oversight to paper over.
- `ResultTabs.tsx`, `InputRail.tsx`, `HiringCard.tsx`, `IncompleteResultPlaceholder.tsx` are
  **deleted**, not merely superseded — confirmed zero remaining importers (`grep` before each
  deletion) and the two tests that read `ResultTabs.tsx`'s source directly were updated to assert
  the new single-scroll invariant instead of deleted outright, since the invariant they protected
  (a pool % never appears without grant basis + strike policy on the same screen) still matters
  and is now checked against the new architecture.

**Real bugs manual/live verification found, each fixed before moving on** (per this project's own
rule that a test never seen to fail is not yet a test):

1. A stale-closure read of `touched` inside `ScreenHiring.setTotalHires` silently no-op'd the
   hiring-plan translation on the *first* entry of "total hires" — `markTouched` and `setState`
   are both async, so checking `touched.has(path)` in the same synchronous handler that just
   called `markTouched(path)` still saw the pre-update set. Fixed by reading a `hasEnteredHires`
   flag off `meta` (synchronous, no lag) instead of the dot-path `touched` set for this one
   internal check.
2. Strike policy was unreachable from `Your model` for any founder who never needed it during
   onboarding, because `ScreenGrants`'s visibility condition (`!isBlank || isRequired`) was
   copied verbatim from the wizard, where hiding an untouched `reportOnly` field is correct —
   D2 requires it to "remain visible and editable" everywhere, always. Fixed with an
   `alwaysShowStrikeAndTheta` prop, true only when `ScreenGrants` is embedded in `Your model`.
3. Opening the mobile sheet mounted a second `ModelPanel` (and so a second `id="buffer"`, etc.)
   alongside the CSS-hidden (`hidden lg:block`) desktop copy, which was still mounted, just
   invisible. `hidden` only hides; it does not unmount. Fixed with `useIsDesktop()`, a
   `matchMedia`-backed hook mirroring `lib/theme.tsx`'s own SSR-then-correct pattern, so the two
   surfaces are mutually exclusive in the DOM, not just visually.
4. The two `Field`/`SegmentedControl` `htmlFor` bugs above.

**Input audit** (master brief §59.C — every pre-redesign input's new home):

| Old input / state | New status |
|---|---|
| Every field on the old 7-card rail (`GrantBasisCard`, `CompanyTodayCard`, `HiringCard`, `GrantPolicyCard`, `LeaversAndRecyclingCard`, `FundingRoundCard`, `ReportOnlyCard`) | **Split**: `drivesPool` fields not conditional on Basis B live on wizard screen 01/02; Basis-B-only `drivesPool` fields (valuation, growth) on screen 03B; every field, in every tier, reachable again post-results via `Your model` (§6.1, 8 groups) |
| `HiringCard`'s per-year `hires-y{i}` fields | **Derived**, then **advanced/override**: `ScreenHiring`'s "Enter hiring by year" disclosure exposes the same paths directly, seeded by the total-hires translation |
| `SeniorityMix`'s 4 band fields | **Derived**, then **advanced/override**: team-profile + leadership-hires presets by default (§4.3); "Custom mix" reveals the original component unchanged |
| Grant-per-hire fields (both bases) | **Estimated (preset)** on the wizard (grant-philosophy 3-way choice, §4.4), **advanced/override** via "Customize grants" or via `Your model`'s `GrantPolicyCard` reuse |
| Strike policy, theta, value basis, buffer, comp inflation, refresh, recycling, attrition, vesting/cliff, exercise window | **Estimated** (unchanged `minor`-tier defaults, D9 untouched) — reachable in `Your model`, never on the wizard (design.md §4.4) |
| `ReportOnlyCard`'s fields (founder ownership, face value, authorised capital, compliance toggles, incorporation date, company type, tax rate) | **Unchanged, `reportOnly`**: still blank until touched, still live in `Your model`'s last group, per D9 §5's own reasoning (these are invented-example company facts, not assumptions to pre-fill) |
| `FundingRoundCard`'s round fields | **Unchanged, `reportOnly`**: still in `Your model`; the live report gained a "Funding round impact" section reading the *same* fields' output (`FundingRoundImpact.tsx`), where previously only the PDF showed this |
| Removed because unused | **None** — every existing `EsopInputs` path is still reachable from some UI surface; nothing was dropped |

**Engine audit**: unchanged. `git status src/lib/esop` is empty for this entire redesign, matching
the LOG's own convention for reporting this. No new engine export, no default changed, no formula
touched. Every figure this redesign shows was already computed by `calculateEsopPool`; the work
was entirely presentation, sequencing and re-grouping.

**Edge-state QA pass, post-build**: normal/adequate/extreme/soft-warning hero states and the
authorised-capital and missing-compliance-data edge cases were each driven through a real browser
session against live `calculateEsopPool` output (not just the unit-level `hero-state.test.ts`
cases). Three further defects surfaced, none in the engine, all fixed and re-verified live:

5. `Headline.tsx`'s "Pool to create" stat concatenated `formatShares(...)` directly against the
   following `<span>` with no whitespace between them, rendering e.g. "1,62,059 2.0% of FD" as a
   single run with no space before the percentage in some layouts — a plain adjacent-JSX-node
   gap, not a data bug. Fixed with an explicit `{' '}`; re-confirmed by rendering the exact
   Seed/₹-value/20-hires scenario and reading the DOM text.
6. `ScreenHiring`'s total-hires field had no copy telling a founder that entering `0` is itself a
   valid, meaningful answer (as opposed to leaving the field blank) — a founder planning zero
   hires had no signal that `0` would still unlock the per-year plan below. Fixed with a `helper`
   string on the field.
7. `ScreenGrants`'s valuation field (Basis B only) gave no reason for asking, so a founder using
   percent-of-equity grants who switched to see what ₹-value grants would look like had no context
   for why a blank, `required` valuation field had appeared. Fixed with a `helper` string;
   considered `error` styling first but chose `helper` to keep the tone consistent with this
   file's other estimate/required copy (neither is a validation failure, both are just unset).

**§12 accessibility, closed out:**

- `aria-live="polite"` on the wizard's step heading was already in place (`OnboardingWizard.tsx`,
  an `sr-only` live region announcing "Step N of 3: {label}") — nothing to add.
- `aria-current="location"` on the anchor nav's in-view section is now implemented
  (`ResultsPanel.tsx`'s `useActiveSection`, an `IntersectionObserver` keyed off the same
  `scroll-mt` offsets the sections already use). Its geometry was hand-verified against
  `getBoundingClientRect()` at several scroll positions and matched the intended detection band
  exactly, but the sandbox's Browser pane does not composite frames while backgrounded or on a
  bare `resize`/`scrollTo` (confirmed directly by the `screenshot` tool's own error: "the page is
  not compositing frames"), so `IntersectionObserver`'s *live* re-fire on scroll could not be
  watched end-to-end in this session — only its initial-mount evaluation and its input geometry.
  Worth a real-device or Playwright check before shipping, not just a compositing-limited sandbox.

**Responsive, 768px (tablet) spot-check — clean, with one sandbox false alarm:**

- A resize of an *already-mounted* page from desktop to 768px produced a real-looking horizontal
  scrollbar (`recharts-wrapper` SVGs stuck at a stale ~773px width). Reloading fresh at 768px
  instead made it vanish entirely (`scrollWidth === clientWidth === 753`) — the same
  compositing/`ResizeObserver` limitation as above: recharts' own resize-driven remeasurement
  never got a callback, not a real layout bug. Confirmed by testing both ways rather than trusting
  the first result.
- A fresh 768px load (full wizard → results flow) is otherwise clean: single-column throughout,
  desktop `Your model` column correctly `display: none` below `lg:`, the mobile "Edit model"
  trigger present, and the sheet opens full-width with no overflow.

**Still open, honestly flagged rather than fixed silently:**

- `reportModel.ts`/`reportPdf.ts` — unchanged (see §10 row above); the PDF and the live screen now
  diverge more than before this session.
- The `aria-current` scroll-spy above needs a real (non-sandboxed) browser or automated a11y test
  before shipping, per the compositing caveat.
