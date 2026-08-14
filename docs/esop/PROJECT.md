# ESOP Pool Calculator

Product source of truth. Read this first, every session, before anything else.

Route: `/tools/esop-pool-size` on incentiv.finance
Branch: `main`
Stack: Next.js 16 (App Router), React 19, TypeScript strict, pnpm, Vitest
Model source of truth: [ENGINE_SPEC.md](./ENGINE_SPEC.md)
Log: [LOG.md](./LOG.md)

---

## What this is

A tool that tells an Indian startup founder how big their ESOP pool should be, sized against their hiring plan rather than a rule of thumb, and how long an existing pool will last. It lives at `/tools/esop-pool-size` on incentiv.finance/tools, next to the ESOP Tax Calculator and the Funding Round Simulator. Results are free and ungated. The detailed report is gated on name and work email, and the CTA pitches Tabulate.

## The one job

A founder gets a defensible pool number in under 90 seconds and under 12 interactions, and understands what drove it.

## Locked product decisions

Numbered D1, D2, D3… Never renumber. Never delete. If a decision is reversed, add a new one that supersedes it and mark the old one superseded.

| # | Decision | Locked |
|---|---|---|
| D1 | Grant basis is a visible founder-facing control, not an internal assumption. Percent-of-equity or rupee-value. It decides whether valuation growth affects the answer at all. | 2026-08-15 |
| D2 | Strike price policy is a visible control. Face value or last round price. It decides the denominator. | 2026-08-15 |
| D3 | Results are never gated. Only the report download is. | 2026-08-15 |
| D4 | Two separate compliance toggles: DPIIT recognition and IMB certification under Section 80-IAC. Never one. | 2026-08-15 |
| D5 | Two benchmark tracks are always shown together: advisory consensus and observed India data. Neither is presented as the truth. | 2026-08-15 |
| D6 | Every default is an editable estimate, marked as such in the UI, and never presented as sourced data. | 2026-08-15 |

## Locked model decisions

The math lives in [ENGINE_SPEC.md](./ENGINE_SPEC.md) and is not restated here. If code or UI copy ever disagrees with the spec, the code changes, not the spec.

This section records only decisions the spec leaves open, as they get made. Numbered M1, M2, M3… Never renumber.

| # | Decision | Made |
|---|---|---|
| M1 | Where the spec gives a range and the form needs a point, the default is the midpoint of that range, tagged `estimate`. Applies to the Basis A grant percentages and the sector attrition overrides. | 2026-08-15 |
| M2 | Provenance has exactly two tiers. `estimate` means the spec states the value or it is advisory consensus. `provisional` means the spec sets no v2 value and this is a placeholder, or the figure is a dated third-party observation we have not verified. Every `provisional` is a to-do before launch. | 2026-08-15 |
| M3 | Statutory limits and the fixed-point solver parameters carry no provenance tag. They are law and algorithm respectively, not estimates, and tagging them would be a category error under D6. They live in `STATUTORY` and `SOLVER`, outside the defaults table. | 2026-08-15 |
| M4 | The band vocabulary is leadership, senior, mid, junior, mapping to the spec's CXO-or-VP, senior IC, mid IC, junior. | 2026-08-15 |
| M5 | `exerciseWindowDays` is a closed union of the four options the spec names: 30, 90, 365, 1825. A founder cannot enter an arbitrary window until we decide to open it. | 2026-08-15 |
| M6 | Neither benchmark ladder is a partition, so overlapping bands are carried as data, not forbidden. Each track declares its stage trend and its known overlaps, and the tests assert the found overlaps equal the declared ones exactly. The advisory ladder overlaps at Series B against Series C+; the observed India ladder overlaps at three pairs, because "below 10%" is a ceiling and not a band. | 2026-08-15 |

## Compliance facts, current as at August 2026

Scheme approval: Section 62(1)(b) Companies Act 2013 with Rule 12 of the Companies (Share Capital and Debentures) Rules 2014. **Private companies pass an ordinary resolution** under the MCA exemption notification of 5 June 2015. Unlisted public companies pass a special resolution. MGT-14 within 30 days.

Separate resolution required for: grants to employees of a holding, subsidiary or associate company, and grants to an identified employee in any one year equal to or above 1% of issued capital (excluding outstanding warrants and conversions) at the time of grant.

Vesting: minimum one year between grant and vesting, Rule 12(6)(a). Block any input below 12 months.

Eligibility: permanent employees in or outside India, and directors other than independent directors. Excluded: promoters and the promoter group, and directors holding more than 10% directly or indirectly. DPIIT-recognised startups are exempt from those exclusions for 10 years from incorporation, per GSR 127(E) dated 19 February 2019.

Authorised capital: must cover issued capital plus the pool at scheme adoption. If short, increase under Section 61(1)(a) by ordinary resolution, after checking the AoA has an enabling clause (if not, amend the AoA by special resolution under Section 14 with its own MGT-14), then file SH-7 within 30 days. Stamp duty and ROC fees vary by state, so quote the share shortfall and the rupee increase needed, not a fee estimate.

Allotment on exercise: PAS-3 within 30 days. Maintain the option register in SH-6. Rule 12(9) disclosures in the Directors' Report.

**Tax, and this is where v1 was wrong.** The Income Tax Act 2025 took effect 1 April 2026. Perquisite at exercise is (FMV minus exercise price) times shares, taxed at slab. The deferral now sits at Section 392(3) read with Section 289(3), succeeding Section 192(1C) of the 1961 Act. It requires the employer to be an eligible startup under Section 140 (successor to Section 80-IAC), which needs **DPIIT recognition plus an Inter-Ministerial Board certificate**. DPIIT recognition alone does not qualify: roughly 4,000 of about 1.97 lakh DPIIT-recognised startups hold IMB certification. The window is 60 months from the end of the tax year of allotment for shares allotted on or after 1 April 2026, up from 48. Triggers are window expiry, sale of shares, or cessation of employment, whichever is earliest. Rate is locked to the year of allotment.

The tool therefore needs two separate toggles, not one: `dpiitRecognised` (drives the Rule 12 promoter exemption) and `imbCertified80IAC` (drives the tax deferral). Collapsing them into one DPIIT toggle is the error.

Accounting: Ind AS 102 fair value, or the ICAI Guidance Note intrinsic value basis for companies not on Ind AS. Expense amortised over the vesting period. Unvested lapses reverse the expense; expense on vested-but-lapsed options is not reversed through P&L. Show estimated annual ESOP expense in the report, because it surfaces in diligence and founders are routinely blindsided by it.

Pending, not law: the Corporate Laws (Amendment) Bill 2026 was introduced in the Lok Sabha on 23 March 2026 and referred to a Joint Parliamentary Committee, whose report was tabled in early August 2026 backing the Bill. It would recognise RSUs and SARs under Section 62(1)(b) and liberalise buybacks. Build an `instrument` field now (ESOP, RSU, SAR) but expose only ESOP, and do not present the Bill as law anywhere in the UI or report.

**These facts must be re-verified before any public launch, and re-checked every quarter after.**

## Prohibitions

- Never state or imply that DPIIT recognition alone gives the perquisite tax deferral. It requires DPIIT plus IMB certification under Section 140 of the Income Tax Act 2025, successor to Section 80-IAC.
- Never cite Section 192(1C) as current. It is Section 392(3) read with Section 289(3) from 1 April 2026, and the window is 60 months, not 48.
- Never state that a private company needs a special resolution to approve an ESOP scheme. It is an ordinary resolution under the MCA exemption notification of 5 June 2015.
- Never present the Corporate Laws (Amendment) Bill 2026 as law. It was referred to a Joint Parliamentary Committee whose report was tabled in August 2026. It is not in force.
- Never present advisory benchmark ranges as data.
- Never output a pool percentage without the grant basis and strike policy that produced it being visible on the same screen.
- Never let a compliance row appear without "General information, not legal advice."

## Copy conventions

Indian digit grouping throughout, with a lakh or crore readout on every money field. Sentence case. Active voice. No copy block over 25 words in the primary column. "Pool to create" when the founder holds nothing, "Top-up needed" only when they hold something.

## Scope boundary

This tool answers how big, how long, and how many hires. The Funding Round Simulator answers who dilutes across instruments. Cross-link, never rebuild.

## Standing rules for every session

1. Read PROJECT.md and LOG.md before writing any code.
2. One branch, `main`. Never open a sibling branch. Never leave work on an unmerged branch at the end of a session.
3. One canonical log at `docs/esop/LOG.md`. Never create a second log file anywhere.
4. Every commit gets a log entry, including commits made by hand. If you find an unlogged commit, log it before doing anything else.
5. End every session green: tests pass, `tsc` passes, production build passes. If you cannot, stop and say so rather than lowering a test expectation.
6. Never change a test expectation to make a test pass. Change the code, or raise the discrepancy.
7. Stay in the scope of the current prompt. Note anything else you spot in LOG.md under Open items and leave it.

## Open items

None.
