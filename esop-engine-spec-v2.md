# ESOP Pool Engine: corrected spec v2

Supersedes the math in the Magic Patterns prompt. This is the source of truth for the backend. Where the front-end prompt disagrees, this file wins.

Status of law and data: current as at 14 August 2026.

---

## 0. What changed from v1, ranked

| # | Issue | Severity |
|---|---|---|
| 1 | Grant basis fork (% of equity vs ₹ value) was never modelled. Two legitimate market conventions, wildly different answers. | Fatal |
| 2 | Options needed divided by price per share. Should divide by the spread, or by fair value, depending on strike policy. | Fatal |
| 3 | No funding round schedule. The pool shuffle is the number founders actually want. | Fatal |
| 4 | Tax deferral attributed to DPIIT recognition. Wrong. Needs DPIIT plus IMB certificate. Section numbers and window also changed on 1 April 2026. | Wrong, and embarrassing on an equity infra site |
| 5 | Private company scheme approval stated as special resolution. It is an ordinary resolution for private companies. | Wrong |
| 6 | Exercised options were never converted into issued shares, so the authorised capital check was measuring the wrong thing. | Material |
| 7 | Benchmark bands too low and the wrong shape for India. Observed India data runs opposite to the advisory consensus. | Material |

---

## 1. The grant basis fork (build this first)

Two conventions exist in the Indian market and the tool must make the founder pick one.

**Basis A, percent of equity.** Grants quoted as a % of fully diluted equity per hire. Advisory ranges: CXO or VP 0.3 to 1.5%, senior IC 0.15 to 0.3%, mid IC 0.05 to 0.15%, junior 0.02 to 0.1%. Common at pre-seed and seed in India.

**Basis B, rupee value.** Grants quoted as a ₹ number, converted to options at the price per share on the grant date. Common at Series A and beyond, and by anyone benchmarking against cash comp.

Why this is the whole ballgame: under Basis A, pool consumption is completely independent of valuation. Valuation growth changes nothing about how big the pool must be. Under Basis B, valuation growth is the single largest driver, because a fast-growing price per share means each rupee of grant value buys fewer options every year. Same company, same hiring plan, two very different recommended pools.

Default Basis A for pre-seed and seed, Basis B for Series A and later. Show the other basis as a comparison line. Never silently pick one.

---

## 2. Denominator, by strike policy

Under Basis B, what you divide the rupee grant value by depends on what "grant value" is being promised.

- **Notional value** (most Indian offer letters): `options = value / PPS_t`
- **Realisable value** (what the employee actually banks): `options = value / (PPS_t - X_t)` where `X_t` is the exercise price at grant
- **Fair value** (Ind AS 102, and the only honest basis when the strike is set at the last round price): `options = value / (theta_t * PPS_t)` where theta is the Black-Scholes value ratio. Default theta 0.55 for a 4 year expected life, 60% volatility, strike at FMV. Theta approaches 1 as the strike approaches zero.

Indian practice on strike price has converged on two poles: face value (₹10) at early stage, which minimises the employee's perquisite exposure, or the last round price at growth stage. The Companies Act leaves the exercise price to the company subject to accounting standards, with face value the practical floor.

Engine requirement: take `strikePolicy` as an input (`faceValue` | `lastRoundPrice` | `discountToFMV` with a %) and compute all three value bases. Display notional as the headline, realisable underneath. A tool that shows only notional is doing what every bad offer letter in India already does.

---

## 3. Notation

```
FD_t    fully diluted shares at end of year t, including unallocated pool
V_t     post-money valuation
PPS_t   V_t / FD_t
X_t     exercise price per option granted in year t
H_t,b   hires in year t at band b
G_b     grant value (₹ under Basis B) or grant % (under Basis A) for band b
i       comp inflation on grant values, default 8%
a_b     annual attrition at band b
lambda  share of vested options not exercised after exit
c       cliff in months, k vesting years
T       horizon
```

---

## 4. Engine

### 4.1 New hire grants
```
Basis A:  N_t = sum_b [ H_t,b * pct_b * FD_t ]
Basis B:  N_t = sum_b [ H_t,b * G_b * (1+i)^t / D_t ]
          D_t = PPS_t | (PPS_t - X_t) | theta_t * PPS_t   per section 2
```

### 4.2 Refresh grants
```
R_t = Eligible_t * refreshRate * refreshSize * Gbar * (1+i)^t / D_t
Eligible_t = employees with tenure >= refreshEligibility (default 24 months)
```

### 4.3 Cohort tracking (required, do not approximate)

Track every grant cohort by year and band. For a cohort granted in year s, at time t:
```
age = t - s
v = 0                                        if age < c/12
v = clamp((age - c/12) / (k - c/12), 0, 1)   otherwise
leavers_from_cohort = a_b * O_cohort
  unvested forfeited = leavers * (1 - v)          -> returns to pool if recycling on
  vested lapsed      = leavers * v * lambda       -> returns to pool if recycling on
  vested exercised   = leavers * v * (1 - lambda) -> LEAVES the pool permanently
                                                     and becomes issued shares
```
Plus exercises by continuing employees, default 0 pre-liquidity in India (assume nobody exercises without a liquidity event unless the founder says otherwise).

The exercised leg matters: those shares hit paid-up capital and consume authorised capital headroom. v1 ignored this.

### 4.4 Roll forward
```
Available_t = Available_(t-1) + TopUp_t - N_t - R_t + Returned_t
```
Exhaustion = first t where Available_t < 0, interpolated to a month on that year's grant run rate.

### 4.5 Recommended pool, fixed point
```
K = (sum_t (N_t + R_t - Returned_t)) * (1 + buffer)
pool% = (K - existingUnallocated) / (FD_0 + max(0, K - existingUnallocated))
```
K depends on PPS_t, which depends on FD_t, which contains the pool. Iterate from 10%, tolerance 0.01 percentage points, max 25 iterations, return iteration count. Round the displayed figure up to the nearest 0.5%.

Under Basis A the fixed point still applies, because pct_b is applied to FD_t which grows with the pool.

### 4.6 Funding round schedule and the pool shuffle

This is the highest value output in the tool. For each modelled round r:

```
inputs: year, pre-money Vpre, raise R, investor-required post-round pool % (pi)
S_ex = shares excluding unallocated pool, pre-round
U    = existing unallocated pool, pre-round

Post-round fully diluted:
T = S_ex / (1 - pi - R/(Vpre + R))

Investor shares  I  = T * R/(Vpre+R)
New pool shares  dP = pi*T - U
Investor price per share = Vpre / (S_ex + pi*T)
```
Founder dilution attributable to the pool = dP / T, and its cash cost at that round's price per share. If the pool is created post-money instead, recompute with the pool added after the investor shares and show the delta. That delta, in rupees, is the number the founder is actually buying the tool for.

---

## 5. Compliance rules (India, as at August 2026)

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

---

## 6. Defaults v2

| Assumption | v1 | v2 | Why |
|---|---|---|---|
| Attrition | 18% | 15%, band and sector overrides | India overall was 16.2% in 2025 and is projected around 13-14% for 2026; IT services 13-15%, e-commerce 25-28%. Carta puts startup employees holding equity at a 17.5% median. |
| Vested options never exercised | 35% | 50%, range 30-70%, linked to the exercise window input | Pre-liquidity exercise in India is rare because of the cash plus perquisite tax at exercise. One 2021 estimate put 70-80% of vested options in unicorns going unexercised. Treat as an assumption, never as data. |
| Post-termination exercise window | not modelled | 90 days default; options 30 days, 90 days, 1 year, 5 years | Directly drives the lapse rate. Longer windows are becoming a differentiator. |
| Strike policy | not modelled | face value default at seed, last round price at Series A+ | Changes the denominator. |
| Continuing-employee exercises | not modelled | 0 pre-liquidity | Realistic for unlisted India. |
| Benchmark bands (advisory) | 5-10 / 10-15 / 10-15 / 12-18 | pre-seed 5-8, seed 8-12, Series A 12-15, Series B 15-18, C+ 15-20 | Matches Indian advisory consensus. |
| Benchmark bands (observed) | none | show separately | The Trifecta Capital study of 45 leading Indian companies found most Series A companies below 10%, most Series B below 10%, and growth-round pools averaging 7.5-8%, versus 16-17% at Series C/D in the US. Indian pools shrink with stage because investors hold target ownership. Label as dated and directional. |

Everything above is an editable estimate. None of it is measured data on the founder's own company. Mark it in the UI the same way the valuation calculator marks provisional benchmarks.

---

## 7. Outputs the engine must return

1. Recommended pool, in % of fully diluted and in options, under the selected grant basis, plus the same figure under the other basis.
2. Exhaustion month for the current pool.
3. Top-up needed in percentage points at the next round.
4. Cost of the pool to founders at the next round, in rupees and in percentage points, pre-money versus post-money.
5. Year by year roll forward, including exercised shares and closing issued capital.
6. Cap table before and after, and after the modelled round.
7. Authorised capital headroom, in shares and in the rupee increase required.
8. Estimated annual ESOP expense under Ind AS 102.
9. Compliance flags per section 5.
10. Benchmark comparison against both the advisory band and the observed band.
11. Value to a median employee at horizon, notional and realisable after exercise cost and perquisite tax.

---

## 8. Guardrails

- Never present advisory blog consensus as data. Two separate benchmark tracks, labelled.
- Never output a pool % without naming the grant basis and the strike policy that produced it.
- Never claim DPIIT recognition gives a tax deferral.
- Never present the Corporate Laws (Amendment) Bill 2026 as in force.
- Every compliance line carries "general information, not legal advice."
- If the founder enters a strike at FMV and a notional value basis, warn: the number overstates what the employee receives.

---

## 9. Scope boundary

Incentiv already ships a Funding Round Simulator that stacks SAFEs, notes, CCPS and priced rounds and shows who dilutes. This tool should answer how big, how long, and how many hires. Where the founder wants full instrument-level dilution, link across rather than rebuild. Overlap between the two tools is the main product risk here, not the math.
